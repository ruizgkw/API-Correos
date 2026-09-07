import email
import logging
from email.header import decode_header
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import aioimaplib
import security

logger = logging.getLogger("imap_service")

class IMAPService:
    @staticmethod
    def _decode_header_str(header_value: Optional[str]) -> str:
        """Decodifica cabeceras RFC822 como Asunto o Remitente."""
        if not header_value:
            return ""
        decoded_fragments = decode_header(header_value)
        header_text = ""
        for fragment, encoding in decoded_fragments:
            if isinstance(fragment, bytes):
                header_text += fragment.decode(encoding or "utf-8", errors="ignore")
            else:
                header_text += str(fragment)
        return header_text

    @staticmethod
    def _extract_body_from_msg(msg: email.message.Message) -> Dict[str, str]:
        """Extrae el cuerpo en texto plano y en HTML de un objeto email.Message."""
        text_body = ""
        html_body = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))

                if "attachment" not in content_disposition:
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            charset = part.get_content_charset() or "utf-8"
                            decoded_content = payload.decode(charset, errors="ignore")
                            if content_type == "text/plain":
                                text_body += decoded_content
                            elif content_type == "text/html":
                                html_body += decoded_content
                    except Exception as e:
                        logger.error(f"Error extrayendo parte del cuerpo: {e}")
        else:
            try:
                payload = msg.get_payload(decode=True)
                if payload:
                    charset = msg.get_content_charset() or "utf-8"
                    decoded_content = payload.decode(charset, errors="ignore")
                    if msg.get_content_type() == "text/html":
                        html_body = decoded_content
                    else:
                        text_body = decoded_content
            except Exception as e:
                logger.error(f"Error extrayendo cuerpo simple: {e}")

        return {"text": text_body, "html": html_body}

    @classmethod
    async def fetch_latest_email(
        cls,
        imap_server: str,
        imap_port: int,
        email_address: str,
        encrypted_credentials: str,
        sender_filter: str,
        since_datetime: Optional[datetime] = None,
        auth_type: str = "APP_PASSWORD",
        encrypted_refresh_token: Optional[str] = None,
        provider: str = "GENERIC_IMAP"
    ) -> Optional[Dict[str, Any]]:
        """
        Se conecta de forma asíncrona vía IMAP SSL descifrando credenciales o refrescando el token OAuth2 XOAUTH2.
        """
        access_token = None
        raw_password = None

        if auth_type == "OAUTH2" or (encrypted_refresh_token and not encrypted_credentials):
            refresh_token = security.decrypt_data(encrypted_refresh_token)
            if provider == "OUTLOOK" or "hotmail" in email_address.lower() or "outlook" in email_address.lower():
                access_token = await security.refresh_microsoft_access_token(refresh_token)
            else:
                access_token = await security.refresh_google_access_token(refresh_token)

            if not access_token:
                logger.error(f"No se pudo obtener Access Token OAuth2 para {email_address}")
                return None
        else:
            raw_password = security.decrypt_data(encrypted_credentials)
            if not raw_password:
                logger.error(f"No se pudieron descifrar las credenciales para {email_address}")
                return None

        imap_client = aioimaplib.IMAP4_SSL(host=imap_server, port=imap_port)
        
        try:
            await imap_client.wait_hello_from_server()

            if access_token:
                # Construir trama SASL XOAUTH2: user=user@domain.com\x01auth=Bearer ACCESS_TOKEN\x01\x01
                auth_string = f"user={email_address}\x01auth=Bearer {access_token}\x01\x01"
                import base64
                encoded_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
                
                # Ejecutar comando XOAUTH2 con aioimaplib
                login_res = await imap_client.authenticate('XOAUTH2', lambda x: encoded_auth)
            else:
                login_res = await imap_client.login(email_address, raw_password)

            if login_res.result != "OK":
                logger.error(f"Fallo de autenticación IMAP ({auth_type}) para {email_address}: {login_res}")
                return None

            select_res = await imap_client.select("INBOX")
            if select_res.result != "OK":
                logger.error(f"Fallo al seleccionar INBOX para {email_address}")
                return None

            # Buscar por remitente
            search_query = f'FROM "{sender_filter}"'
            search_res = await imap_client.search(search_query)
            
            if search_res.result != "OK" or not search_res.lines or not search_res.lines[0]:
                search_query = f'HEADER FROM "{sender_filter}"'
                search_res = await imap_client.search(search_query)

            if search_res.result != "OK" or not search_res.lines or not search_res.lines[0]:
                logger.info(f"Filtro estricto {sender_filter} sin resultados en {email_address}. Ejecutando búsqueda general...")
                search_res = await imap_client.search("ALL")

            if search_res.result != "OK" or not search_res.lines or not search_res.lines[0]:
                await imap_client.logout()
                return None

            msg_ids = search_res.lines[0].split()
            if not msg_ids:
                await imap_client.logout()
                return None

            numeric_ids = sorted([int(mid) for mid in msg_ids if mid.isdigit()], reverse=True)
            if not numeric_ids:
                await imap_client.logout()
                return None

            # Limite de antigüedad: 10 minutos (600 segundos)
            MAX_AGE_SECONDS = 600
            now_utc = datetime.now(timezone.utc)

            # Recorrer los últimos 10 correos más recientes buscando uno válido y reciente
            for current_id in numeric_ids[:10]:
                fetch_res = await imap_client.fetch(str(current_id), "(BODY[])")
                if fetch_res.result != "OK":
                    fetch_res = await imap_client.fetch(str(current_id), "(RFC822)")
                    
                if fetch_res.result != "OK":
                    continue

                raw_email_bytes = None
                for part in fetch_res.lines:
                    if isinstance(part, bytes) and len(part) > 50 and not part.startswith(b'*'):
                        raw_email_bytes = part
                        break

                if not raw_email_bytes and len(fetch_res.lines) > 1:
                    raw_email_bytes = fetch_res.lines[1]

                if not raw_email_bytes:
                    continue

                msg = email.message_from_bytes(raw_email_bytes)
                subject = cls._decode_header_str(msg.get("Subject"))
                sender = cls._decode_header_str(msg.get("From"))
                date_str = msg.get("Date")

                # 1. Validar Filtro de Asunto (si se especificó uno)
                if since_datetime and isinstance(since_datetime, str):
                    # Si viene filtro de asunto en since_datetime como fallback
                    pass

                # 2. Validar Fecha/Antigüedad (< 10 minutos)
                email_dt = None
                if date_str:
                    try:
                        email_dt = email.utils.parsedate_to_datetime(date_str)
                    except Exception as e:
                        logger.warning(f"No se pudo parsear la fecha del correo '{date_str}': {e}")

                if email_dt:
                    # Normalizar a UTC si es naive
                    if email_dt.tzinfo is None:
                        email_dt = email_dt.replace(tzinfo=timezone.utc)
                    
                    age_seconds = (now_utc - email_dt).total_seconds()
                    logger.info(f"[EMAIL CHECK] ID {current_id} | Asunto: '{subject}' | Antigüedad: {int(age_seconds)}s")

                    # Si el correo tiene más de 10 minutos (600 s), descartar
                    if age_seconds > MAX_AGE_SECONDS:
                        logger.info(f"Correo ID {current_id} descartado por antigüedad ({int(age_seconds)}s > 600s).")
                        continue
                
                # Extraer cuerpo del correo válido
                bodies = cls._extract_body_from_msg(msg)
                await imap_client.logout()

                return {
                    "message_id": str(current_id),
                    "subject": subject,
                    "sender": sender,
                    "date": date_str,
                    "text_body": bodies["text"],
                    "html_body": bodies["html"]
                }

            await imap_client.logout()
            logger.info("No se encontró ningún correo que cumpla con el filtro de asunto y tiempo (< 10 min).")
            return None


        except Exception as e:
            logger.error(f"Excepción en IMAPService para {email_address}: {str(e)}")
            try:
                await imap_client.logout()
            except Exception:
                pass
            return None
