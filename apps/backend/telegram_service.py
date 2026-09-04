import os
import logging
import httpx
from typing import Dict, Any

logger = logging.getLogger("telegram_service")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

async def send_otp_message(telegram_chat_id: int, otp_code: str) -> bool:
    """
    Envía el código OTP al chat de Telegram del cliente.
    Si TELEGRAM_BOT_TOKEN no está presente, imprime el código en consola (Log mode para dev).
    """
    message_text = (
        f"🔐 *Código de Verificación - API Correos*\n\n"
        f"Tu código de acceso es: `{otp_code}`\n\n"
        f"⏰ Válido por 5 minutos. No lo compartas con nadie."
    )

    if not TELEGRAM_BOT_TOKEN:
        logger.warning(
            f" [DEV MODE] TELEGRAM_BOT_TOKEN no configurado. OTP para Telegram ID {telegram_chat_id} es: {otp_code}"
        )
        print(f"\n==========================================")
        print(f" [DEV OTP LOG] Telegram ID: {telegram_chat_id} | OTP: {otp_code}")
        print(f"==========================================\n")
        return True

    payload = {
        "chat_id": telegram_chat_id,
        "text": message_text,
        "parse_mode": "Markdown"
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(TELEGRAM_API_URL, json=payload)
            if response.status_code == 200:
                return True
            else:
                logger.error(f"Error de Telegram API ({response.status_code}): {response.text}")
                return False
        except Exception as e:
            logger.error(f"Excepción al conectar con Telegram: {str(e)}")
            return False
