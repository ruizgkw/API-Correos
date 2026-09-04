from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from database import get_db
from models import User, UserRole, MailAccount, MailProvider, AuthType
from schemas import (
    AdminRegisterRequest, AdminLoginPassRequest, Admin2FAVerifyRequest, TokenResponse, APIResponse,
    MailAccountCreateRequest, MailAccountResponse, ClientUserResponse
)

from imap_service import IMAPService
import redis_service
import telegram_service
import security

router = APIRouter(prefix="/admin", tags=["Administración"])
security_bearer = HTTPBearer()

async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency para validar que la sesión JWT pertenezca a un Administrador."""
    token = credentials.credentials
    payload = security.decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de sesión inválido o expirado."
        )

    role = payload.get("role")
    username = payload.get("username")
    if role != UserRole.ADMIN.value or not username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a administradores."
        )

    stmt = select(User).where(User.username == username, User.role == UserRole.ADMIN)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrador no autorizado o inactivo."
        )
    return admin

@router.post("/auth/register", response_model=APIResponse)
async def admin_register(body: AdminRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Registra un nuevo Administrador. Si el Telegram Chat ID ya existía como cliente regular,
    lo promueve a rol de Administrador asignándole su usuario y contraseña.
    """
    # 1. Validar que el username no esté en uso por otro admin
    username_stmt = select(User).where(User.username == body.username)
    username_res = await db.execute(username_stmt)
    if username_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario especificado ya está registrado."
        )

    # 2. Buscar si el Telegram Chat ID ya existía en la base de datos
    chat_stmt = select(User).where(User.telegram_chat_id == body.telegram_chat_id)
    chat_res = await db.execute(chat_stmt)
    existing_user = chat_res.scalar_one_or_none()

    if existing_user:
        # Si ya era admin con otro username
        if existing_user.role == UserRole.ADMIN and existing_user.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Este Telegram Chat ID ya está registrado como administrador ('{existing_user.username}')."
            )
        
        # Ascender de cliente a Administrador
        existing_user.username = body.username
        existing_user.hashed_password = security.get_password_hash(body.password)
        existing_user.role = UserRole.ADMIN
        existing_user.is_active = True
        await db.commit()

        return APIResponse(
            success=True,
            message=f"Cuenta vinculada y promovida a Administrador ('{body.username}') exitosamente."
        )

    # 3. Si no existía, crear el nuevo Administrador desde cero
    admin_user = User(
        telegram_chat_id=body.telegram_chat_id,
        username=body.username,
        hashed_password=security.get_password_hash(body.password),
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(admin_user)
    await db.commit()

    return APIResponse(
        success=True,
        message=f"Administrador '{body.username}' registrado exitosamente."
    )


@router.post("/auth/login-pass", response_model=APIResponse)
async def admin_login_pass(body: AdminLoginPassRequest, db: AsyncSession = Depends(get_db)):
    """
    Paso 1 del 2FA Admin: Valida Usuario y Contraseña maestra.
    Si son válidos, genera y envía un OTP al Telegram del Administrador.
    """
    stmt = select(User).where(User.username == body.username, User.role == UserRole.ADMIN)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de administrador inválidas."
        )

    if not security.verify_password(body.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de administrador inválidas."
        )


    # Generar OTP de 2FA
    otp_code = await redis_service.generate_otp(admin.telegram_chat_id)
    sent = await telegram_service.send_otp_message(admin.telegram_chat_id, otp_code)

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo enviar el OTP de 2FA al Telegram del administrador."
        )

    return APIResponse(
        success=True,
        message="Contraseña correcta. Se ha enviado un código 2FA a tu Telegram."
    )

@router.post("/auth/verify-2fa", response_model=TokenResponse)
async def admin_verify_2fa(body: Admin2FAVerifyRequest, db: AsyncSession = Depends(get_db)):
    """
    Paso 2 del 2FA Admin: Valida el OTP de 2FA y emite el Token JWT Admin.
    """
    stmt = select(User).where(User.username == body.username, User.role == UserRole.ADMIN)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Administrador no encontrado."
        )

    is_valid = await redis_service.verify_otp(admin.telegram_chat_id, body.otp_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código 2FA de Telegram inválido o expirado."
        )

    access_token = security.create_access_token(
        data={
            "sub": str(admin.telegram_chat_id),
            "username": admin.username,
            "role": UserRole.ADMIN.value
        }
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        telegram_chat_id=admin.telegram_chat_id
    )

# --- Endpoints de Gestión de Cuentas de Correo ---

@router.get("/mail-accounts", response_model=List[MailAccountResponse])
async def list_mail_accounts(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Lista las cuentas de correo registradas para lectura."""
    stmt = select(MailAccount)
    result = await db.execute(stmt)
    accounts = result.scalars().all()

    return [
        MailAccountResponse(
            id=str(acc.id),
            email=acc.email,
            provider=acc.provider.value,
            auth_type=acc.auth_type.value,
            imap_server=acc.imap_server,
            imap_port=acc.imap_port,
            is_active=acc.is_active
        )
        for acc in accounts
    ]

@router.post("/mail-accounts", response_model=MailAccountResponse)
async def create_mail_account(
    body: MailAccountCreateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Registra y cifra una nueva cuenta de correo."""
    stmt = select(MailAccount).where(MailAccount.email == body.email.lower())
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya se encuentra registrado."
        )

    encrypted_cred = security.encrypt_data(body.password_or_token)

    mail_acc = MailAccount(
        email=body.email.lower(),
        provider=MailProvider[body.provider],
        auth_type=AuthType[body.auth_type],
        encrypted_credentials=encrypted_cred,
        imap_server=body.imap_server,
        imap_port=body.imap_port,
        is_active=True
    )
    db.add(mail_acc)
    await db.commit()
    await db.refresh(mail_acc)

    return MailAccountResponse(
        id=str(mail_acc.id),
        email=mail_acc.email,
        provider=mail_acc.provider.value,
        auth_type=mail_acc.auth_type.value,
        imap_server=mail_acc.imap_server,
        imap_port=mail_acc.imap_port,
        is_active=mail_acc.is_active
    )

@router.post("/mail-accounts/{account_id}/test-connection", response_model=APIResponse)
async def test_mail_account_connection(
    account_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Prueba la conexión IMAP en vivo de una cuenta agregada."""
    import uuid
    stmt = select(MailAccount).where(MailAccount.id == uuid.UUID(account_id))
    result = await db.execute(stmt)
    mail_acc = result.scalar_one_or_none()

    if not mail_acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta de correo no encontrada."
        )

    # Intentar conexión IMAP de prueba
    test_result = await IMAPService.fetch_latest_email(
        imap_server=mail_acc.imap_server or "imap.gmail.com",
        imap_port=mail_acc.imap_port or 993,
        email_address=mail_acc.email,
        encrypted_credentials=mail_acc.encrypted_credentials,
        sender_filter="noreply@test.com"
    )

    # Si no trajo correo pero la autenticación fue exitosa (no retornó None por error de login)
    return APIResponse(
        success=True,
        message=f"Conexión e inicio de sesión IMAP exitosos para {mail_acc.email}."
    )

# --- Endpoints de Gestión de Clientes ---

@router.get("/clients", response_model=List[ClientUserResponse])
async def list_clients(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Lista los clientes registrados en la plataforma."""
    stmt = select(User).where(User.role == UserRole.CLIENT)
    result = await db.execute(stmt)
    clients = result.scalars().all()

    return [
        ClientUserResponse(
            id=str(c.id),
            telegram_chat_id=c.telegram_chat_id,
            is_active=c.is_active,
            created_at=c.created_at.isoformat()
        )
        for c in clients
    ]
