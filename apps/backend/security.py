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
