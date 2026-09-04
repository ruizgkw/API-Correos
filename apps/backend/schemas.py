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

class PlatformResponse(BaseModel):
    id: int
    name: str
    extraction_type: str
    is_active: bool

class ExtractionRequest(BaseModel):
    platform_id: int = Field(..., description="ID de la plataforma de streaming a consultar", example=1)
    email: str = Field(..., description="Correo electrónico de la cuenta a consultar", example="cliente@ejemplo.com")

class ExtractionResponse(BaseModel):
    success: bool
    platform_name: str
    extracted_code: Optional[str] = None
    cooldown_seconds: int = 420
    message: str

