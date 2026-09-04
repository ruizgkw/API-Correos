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
        since_datetime: Optional[datetime] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Se conecta de forma asíncrona vía IMAP SSL, descifra credenciales en memoria,
        busca el correo más reciente recibido desde `sender_filter` posterior a `since_datetime`
        y devuelve el cuerpo del correo.
        """
        # Descifrar contraseña en memoria transitoria
        raw_password = security.decrypt_data(encrypted_credentials)
        if not raw_password:
            logger.error(f"No se pudieron descifrar las credenciales para {email_address}")
            return None

        imap_client = aioimaplib.IMAP4_SSL(host=imap_server, port=imap_port)
        
        try:
            await imap_client.wait_hello_from_server()
            login_res = await imap_client.login(email_address, raw_password)
            if login_res.result != "OK":
                logger.error(f"Fallo de autenticación IMAP para {email_address}: {login_res}")
                return None

            select_res = await imap_client.select("INBOX")
            if select_res.result != "OK":
                logger.error(f"Fallo al seleccionar INBOX para {email_address}")
                return None

            # Construir criterio de búsqueda IMAP flexible por remitente
            search_query = f'FROM "{sender_filter}"'

            search_res = await imap_client.search(search_query)
            
            # Si el filtro específico no trae nada (ej subdominio dinámico), traer los últimos correos del INBOX
            if search_res.result != "OK" or not search_res.lines or not search_res.lines[0]:
                logger.info(f"Filtro estricto {search_query} sin resultados en {email_address}. Ejecutando búsqueda general...")
                search_res = await imap_client.search("ALL")

            if search_res.result != "OK" or not search_res.lines or not search_res.lines[0]:
                return None

            msg_ids = search_res.lines[0].split()
            if not msg_ids:
                return None


            # Obtener el último correo (el ID más reciente)
            latest_id = msg_ids[-1].decode('utf-8')
            
            fetch_res = await imap_client.fetch(latest_id, "(RFC822)")
            if fetch_res.result != "OK":
                logger.error(f"Fallo al obtener el mensaje {latest_id}")
                return None

            # Parsear RFC822 con la librería nativa email
            raw_email_bytes = None
            for response_part in fetch_res.lines:
                if isinstance(response_part, bytes) and b"RFC822" not in response_part:
                    raw_email_bytes = response_part
                    break

            if not raw_email_bytes:
                # Caso donde la estructura es devuelta en lista tupla
                raw_email_bytes = fetch_res.lines[1] if len(fetch_res.lines) > 1 else None

            if not raw_email_bytes:
                return None

            msg = email.message_from_bytes(raw_email_bytes)
            subject = cls._decode_header_str(msg.get("Subject"))
            sender = cls._decode_header_str(msg.get("From"))
            date_str = msg.get("Date")

            bodies = cls._extract_body_from_msg(msg)

            await imap_client.logout()

            return {
                "message_id": latest_id,
                "subject": subject,
                "sender": sender,
                "date": date_str,
                "text_body": bodies["text"],
                "html_body": bodies["html"]
            }

        except Exception as e:
            logger.error(f"Excepción en IMAPService para {email_address}: {str(e)}")
            try:
                await imap_client.logout()
            except Exception:
                pass
            return None
