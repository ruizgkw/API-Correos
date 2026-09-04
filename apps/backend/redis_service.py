import os
import secrets
import redis.asyncio as redis
from typing import Optional

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

OTP_EXPIRE_SECONDS = 300  # 5 minutos
COOLDOWN_EXPIRE_SECONDS = 420  # 7 minutos

async def generate_otp(telegram_chat_id: int) -> str:
    """Genera un código OTP de 6 dígitos numéricos y lo guarda en Redis."""
    code = f"{secrets.randbelow(900000) + 100000}"
    key = f"otp:{telegram_chat_id}"
    await redis_client.set(key, code, ex=OTP_EXPIRE_SECONDS)
    return code

async def verify_otp(telegram_chat_id: int, input_code: str) -> bool:
    """Valida si el código OTP coincide. Si es válido, lo elimina de Redis."""
    key = f"otp:{telegram_chat_id}"
    stored_code = await redis_client.get(key)
    if stored_code and stored_code == input_code:
        await redis_client.delete(key)
        return True
    return False

async def set_cooldown(telegram_chat_id: int, platform_id: int, email: str) -> bool:
    """Establece un bloqueo/cooldown de 7 minutos para una consulta de correo y plataforma."""
    key = f"cooldown:{telegram_chat_id}:{platform_id}:{email.lower()}"
    return await redis_client.set(key, "locked", ex=COOLDOWN_EXPIRE_SECONDS, nx=True)

async def get_cooldown_remaining(telegram_chat_id: int, platform_id: int, email: str) -> int:
    """Devuelve los segundos restantes de cooldown. Retorna 0 si no hay cooldown activo."""
    key = f"cooldown:{telegram_chat_id}:{platform_id}:{email.lower()}"
    ttl = await redis_client.ttl(key)
    return max(0, ttl) if ttl > 0 else 0
