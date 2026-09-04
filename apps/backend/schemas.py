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

# --- Esquemas Admin ---
class AdminRegisterRequest(BaseModel):
    telegram_chat_id: int = Field(..., description="Telegram Chat ID del Administrador", example=123456789)
    username: str = Field(..., min_length=4, example="admin")
    password: str = Field(..., min_length=6, example="AdminPass123!")

class AdminLoginPassRequest(BaseModel):
    username: str = Field(..., example="admin")
    password: str = Field(..., example="AdminPass123!")


class Admin2FAVerifyRequest(BaseModel):
    username: str = Field(..., example="admin")
    otp_code: str = Field(..., min_length=6, max_length=6, example="123456")

class MailAccountCreateRequest(BaseModel):
    email: str = Field(..., example="cuenta1@midominio.com")
    provider: str = Field("GENERIC_IMAP", example="GMAIL")
    auth_type: str = Field("APP_PASSWORD", example="APP_PASSWORD")
    password_or_token: str = Field(..., example="abcd-efgh-ijkl-mnop")
    imap_server: Optional[str] = Field("imap.gmail.com", example="imap.gmail.com")
    imap_port: Optional[int] = Field(993, example=993)

class MailAccountUpdateRequest(BaseModel):
    password_or_token: Optional[str] = Field(None, example="nueva-app-password")
    provider: Optional[str] = Field(None, example="GMAIL")
    auth_type: Optional[str] = Field(None, example="APP_PASSWORD")
    imap_server: Optional[str] = Field(None, example="imap.gmail.com")
    imap_port: Optional[int] = Field(None, example=993)
    is_active: Optional[bool] = Field(None, example=True)


class MailAccountResponse(BaseModel):
    id: str
    email: str
    provider: str
    auth_type: str
    imap_server: Optional[str]
    imap_port: Optional[int]
    is_active: bool

class ClientUserResponse(BaseModel):
    id: str
    telegram_chat_id: int
    is_active: bool
    created_at: str


