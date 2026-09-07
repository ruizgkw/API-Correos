from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User, StreamingPlatform, MailAccount, ExtractionLog, LogStatus, ExtractionType
from schemas import PlatformResponse, ExtractionRequest, ExtractionResponse
from imap_service import IMAPService
from mail_parser import MailParser
from scraping_worker import ScrapingWorker
import redis_service
import security

router = APIRouter(prefix="/extraction", tags=["Extracción de Códigos"])
security_bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency para extraer y validar el usuario a partir del Token JWT."""
    token = credentials.credentials
    payload = security.decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de sesión inválido o expirado."
        )

    telegram_chat_id = payload.get("sub")
    if not telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido."
        )

    stmt = select(User).where(User.telegram_chat_id == int(telegram_chat_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo o no autorizado."
        )
    return user

@router.get("/platforms", response_model=List[PlatformResponse])
async def get_platforms(db: AsyncSession = Depends(get_db)):
    """Obtiene la lista de plataformas de streaming activas disponibles."""
    stmt = select(StreamingPlatform).where(StreamingPlatform.is_active == True)
    result = await db.execute(stmt)
    platforms = result.scalars().all()
    
    # Si la base de datos está vacía, sembrar las plataformas por defecto para desarrollo
    if not platforms:
        default_platforms = [
            StreamingPlatform(
                name="Disney+",
                extraction_type=ExtractionType.DIRECT_TEXT,
                sender_email="disneyplus.com",
                subject_filter="código"
            ),

            StreamingPlatform(
                name="HBO Max / Max",
                extraction_type=ExtractionType.DIRECT_TEXT,
                sender_email="support@hbomax.com",
                subject_filter="código"
            ),
            StreamingPlatform(
                name="Netflix",
                extraction_type=ExtractionType.WEB_SCRAPING,
                sender_email="info@account.netflix.com",
                subject_filter="inicio de sesión"
            )
        ]
        db.add_all(default_platforms)
        await db.commit()
        
        stmt = select(StreamingPlatform).where(StreamingPlatform.is_active == True)
        result = await db.execute(stmt)
        platforms = result.scalars().all()

    return [
        PlatformResponse(
            id=p.id,
            name=p.name,
            extraction_type=p.extraction_type.value,
            is_active=p.is_active
        )
        for p in platforms
    ]

@router.post("/extract-code", response_model=ExtractionResponse)
async def extract_code(
    body: ExtractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint principal para solicitar la extracción de código.
    Verifica Cooldown de 7 minutos, consulta IMAP, aplica Regex/Scraping y guarda log de auditoría.
    """
    request_timestamp = datetime.utcnow()

    # 1. Verificar Cooldown de 7 minutos en Redis
    cooldown_remaining = await redis_service.get_cooldown_remaining(
        current_user.telegram_chat_id, body.platform_id, body.email
    )
    if cooldown_remaining > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": f"Debes esperar antes de volver a solicitar un código para este correo.",
                "cooldown_remaining_seconds": cooldown_remaining
            }
        )

    # 2. Buscar datos de la Plataforma
    platform_stmt = select(StreamingPlatform).where(StreamingPlatform.id == body.platform_id)
    platform_res = await db.execute(platform_stmt)
    platform = platform_res.scalar_one_or_none()

    if not platform or not platform.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La plataforma seleccionada no existe o está inactiva."
        )

    # 3. Buscar la cuenta de correo en la BD (o crear una mock para desarrollo si no existe)
    mail_stmt = select(MailAccount).where(MailAccount.email == body.email.lower())
    mail_res = await db.execute(mail_stmt)
    mail_account = mail_res.scalar_one_or_none()

    if not mail_account or not mail_account.is_active:
        # Registrar log de fallo
        log_entry = ExtractionLog(
            user_id=current_user.id,
            platform_id=platform.id,
            queried_email=body.email.lower(),
            status=LogStatus.FAILED,
            extracted_code=None
        )
        db.add(log_entry)
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El correo especificado no está registrado en el sistema."
        )

    # 4. Iniciar consulta IMAP asíncrona
    email_data = await IMAPService.fetch_latest_email(
        imap_server=mail_account.imap_server or "imap.gmail.com",
        imap_port=mail_account.imap_port or 993,
        email_address=mail_account.email,
        encrypted_credentials=mail_account.encrypted_credentials,
        sender_filter=platform.sender_email,
        since_datetime=request_timestamp,
        auth_type=mail_account.auth_type.value,
        encrypted_refresh_token=mail_account.encrypted_refresh_token,
        provider=mail_account.provider.value
    )

    if not email_data:
        # Log de fallo por correo no encontrado
        log_entry = ExtractionLog(
            user_id=current_user.id,
            platform_id=platform.id,
            queried_email=body.email.lower(),
            status=LogStatus.FAILED,
            extracted_code=None
        )
        db.add(log_entry)
        await db.commit()

        return ExtractionResponse(
            success=False,
            platform_name=platform.name,
            extracted_code=None,
            cooldown_seconds=0,
            message="No se encontró ningún correo reciente de verificación para esta plataforma."
        )

    # 5. Parsear el correo traído
    parse_result = MailParser.parse_email(
        email_data=email_data,
        extraction_type=platform.extraction_type.value,
        custom_regex_pattern=platform.code_regex_pattern
    )

    if not parse_result.get("success"):
        log_entry = ExtractionLog(
            user_id=current_user.id,
            platform_id=platform.id,
            queried_email=body.email.lower(),
            status=LogStatus.FAILED,
            extracted_code=None
        )
        db.add(log_entry)
        await db.commit()

        return ExtractionResponse(
            success=False,
            platform_name=platform.name,
            extracted_code=None,
            cooldown_seconds=0,
            message=parse_result.get("error", "No se pudo interpretar el correo.")
        )

    extracted_code = None

    # 6. Evaluar Caso A o Caso B (Web Scraping)
    if parse_result.get("extraction_type") == "DIRECT_TEXT":
        extracted_code = parse_result.get("extracted_code")
    elif parse_result.get("extraction_type") == "WEB_SCRAPING":
        url_to_scrape = parse_result.get("extraction_url")
        scraping_result = await ScrapingWorker.extract_code_from_url(
            url=url_to_scrape,
            platform_name=platform.name
        )

        if scraping_result.get("success"):
            extracted_code = scraping_result.get("extracted_code")
        else:
            log_entry = ExtractionLog(
                user_id=current_user.id,
                platform_id=platform.id,
                queried_email=body.email.lower(),
                status=LogStatus.FAILED,
                extracted_code=None
            )
            db.add(log_entry)
            await db.commit()

            return ExtractionResponse(
                success=False,
                platform_name=platform.name,
                extracted_code=None,
                cooldown_seconds=0,
                message=scraping_result.get("error", "Error procesando el enlace con el navegador.")
            )

    # 7. Éxito: Establecer Cooldown de 7 minutos en Redis
    await redis_service.set_cooldown(
        current_user.telegram_chat_id, platform.id, body.email
    )

    # 8. Registrar Log de Éxito en BD
    log_entry = ExtractionLog(
        user_id=current_user.id,
        platform_id=platform.id,
        queried_email=body.email.lower(),
        status=LogStatus.SUCCESS,
        extracted_code=extracted_code
    )
    db.add(log_entry)
    await db.commit()

    return ExtractionResponse(
        success=True,
        platform_name=platform.name,
        extracted_code=extracted_code,
        cooldown_seconds=420,
        message="Código extraído exitosamente."
    )
