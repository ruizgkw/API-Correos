from pydantic import BaseModel, Field
from typing import Optional

class OTPRequest(BaseModel):
    telegram_chat_id: int = Field(..., description="ID numérico de chat de Telegram del cliente", example=123456789)

class OTPVerifyRequest(BaseModel):
    telegram_chat_id: int = Field(..., description="ID numérico de chat de Telegram del cliente", example=123456789)
    otp_code: str = Field(..., min_length=6, max_length=6, description="Código de 6 dígitos recibido", example="123456")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    telegram_chat_id: int

class APIResponse(BaseModel):
    success: bool
    message: str
