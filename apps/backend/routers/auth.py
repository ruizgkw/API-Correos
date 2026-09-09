from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import User
from schemas import OTPRequest, OTPVerifyRequest, TokenResponse, APIResponse
import redis_service
import telegram_service
import security

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/request-otp", response_model=APIResponse)
async def request_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Solicita un código OTP de 6 dígitos.
    El cliente debe existir registrado en la BD.
    """
    stmt = select(User).where(User.telegram_chat_id == body.telegram_chat_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta no autorizada. Contacta al administrador para solicitar acceso a la plataforma."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario se encuentra inactivo o bloqueado."
        )

    otp_code = await redis_service.generate_otp(body.telegram_chat_id)
    sent = await telegram_service.send_otp_message(body.telegram_chat_id, otp_code)

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo enviar el mensaje por Telegram."
        )

    return APIResponse(
        success=True,
        message=f"Código OTP generado y enviado al chat ID {body.telegram_chat_id}."
    )

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """
    Verifica el OTP e ingresa emitiendo un token JWT.
    """
    is_valid = await redis_service.verify_otp(body.telegram_chat_id, body.otp_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código OTP inválido o expirado."
        )

    # Generar JWT
    access_token = security.create_access_token(
        data={"sub": str(body.telegram_chat_id)}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        telegram_chat_id=body.telegram_chat_id
    )
