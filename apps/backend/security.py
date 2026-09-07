import os
from datetime import datetime, timedelta
from typing import Optional, Union, Any
from cryptography.fernet import Fernet
from jose import jwt, JWTError

SECRET_KEY = os.getenv("SECRET_KEY", "change_this_super_secret_key_in_production_32chars")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 días

# Generar una clave Fernet a partir del SECRET_KEY (debe ser base64 urlsafe de 32 bytes)
# Para desarrollo, derivemos una clave determinista de 32 bytes si no existe FERNET_KEY
FERNET_KEY_ENV = os.getenv("FERNET_KEY")
if FERNET_KEY_ENV and len(FERNET_KEY_ENV) >= 32:
    import base64
    # Si la clave dada no es base64 de 32 bytes pura, la ajustamos
    key_bytes = FERNET_KEY_ENV.encode('utf-8')[:32]
    fernet_key = base64.urlsafe_b64encode(key_bytes)
else:
    import base64
    key_bytes = SECRET_KEY.encode('utf-8').ljust(32, b'0')[:32]
    fernet_key = base64.urlsafe_b64encode(key_bytes)

fernet = Fernet(fernet_key)

def encrypt_data(plain_text: str) -> str:
    """Cifra una cadena de texto usando Fernet AES-256."""
    if not plain_text:
        return ""
    return fernet.encrypt(plain_text.encode('utf-8')).decode('utf-8')

def decrypt_data(cipher_text: str) -> str:
    """Descifra una cadena cifrada con Fernet AES-256."""
    if not cipher_text:
        return ""
    return fernet.decrypt(cipher_text.encode('utf-8')).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un token JWT de sesión."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodifica y valida un token JWT."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña en texto plano contra su hash."""
    if not plain_password or not hashed_password:
        return False
    return pwd_context.verify(plain_password[:72], hashed_password)

def get_password_hash(password: str) -> str:
    """Genera el hash seguro de una contraseña."""
    return pwd_context.hash(password[:72])


import httpx

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")

async def refresh_google_access_token(refresh_token: str) -> Optional[str]:
    """Intercambia un Refresh Token de Google por un Access Token fresco."""
    if not refresh_token:
        return None
    url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, data=payload)
            if res.status_code == 200:
                data = res.json()
                return data.get("access_token")
            else:
                print(f"[OAuth2 Error] Google refresh token falló ({res.status_code}): {res.text}")
                return None
    except Exception as e:
        print(f"[OAuth2 Exception] Error refrescando Google token: {e}")
        return None

async def refresh_microsoft_access_token(refresh_token: str) -> Optional[str]:
    """Intercambia un Refresh Token de Microsoft por un Access Token fresco."""
    if not refresh_token:
        return None
    url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    payload = {
        "client_id": MICROSOFT_CLIENT_ID,
        "client_secret": MICROSOFT_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "scope": "https://outlook.office.com/IMAP.AccessAsUser.All offline_access"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, data=payload)
            if res.status_code == 200:
                data = res.json()
                return data.get("access_token")
            else:
                print(f"[OAuth2 Error] Microsoft refresh token falló ({res.status_code}): {res.text}")
                return None
    except Exception as e:
        print(f"[OAuth2 Exception] Error refrescando Microsoft token: {e}")
        return None


