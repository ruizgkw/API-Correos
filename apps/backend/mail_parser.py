import re
import logging
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup
from models import ExtractionType

logger = logging.getLogger("mail_parser")

class MailParser:
    @staticmethod
    def clean_html_to_text(html_content: str) -> str:
        """
        Limpia etiquetas HTML convirtiendo el cuerpo a texto plano.
        """
        if not html_content:
            return ""
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            # Remover scripts y estilos
            for script_or_style in soup(["script", "style"]):
                script_or_style.decompose()
            return soup.get_text(separator=" ", strip=True)
        except Exception as e:
            logger.error(f"Error al limpiar HTML: {e}")
            # Fallback simple con Regex
            clean_text = re.sub(r'<[^>]+>', ' ', html_content)
            return ' '.join(clean_text.split())

    @staticmethod
    def extract_links_from_html(html_content: str) -> list[str]:
        """
        Extrae todos los enlaces href válidos de una estructura HTML.
        """
        if not html_content:
            return []
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            links = []
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if href.startswith("http://") or href.startswith("https://"):
                    links.append(href)
            return links
        except Exception as e:
            logger.error(f"Error extrayendo enlaces HTML: {e}")
            return re.findall(r'https?://[^\s"<>]+\b', html_content)

    @classmethod
    def parse_email(
        cls,
        email_data: Dict[str, Any],
        extraction_type: str,
        custom_regex_pattern: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Procesa los datos del correo traídos por IMAPService y extrae el código o enlace según la estrategia.
        """
        if not email_data:
            return {
                "success": False,
                "error": "Datos de correo vacíos o no encontrados."
            }

        text_body = email_data.get("text_body", "")
        html_body = email_data.get("html_body", "")

        # Unificar texto plano y limpio de HTML
        clean_text_from_html = cls.clean_html_to_text(html_body)
        full_text = f"{text_body} {clean_text_from_html}"

        # ----------------------------------------------------
        # CASO A: EXTRACCIÓN DIRECTA DE CÓDIGO (Disney+, HBO, etc.)
        # ----------------------------------------------------
        if extraction_type == ExtractionType.DIRECT_TEXT or extraction_type == "DIRECT_TEXT":
            # 1. Si hay un patrón Regex personalizado en la BD, lo usamos primero
            if custom_regex_pattern:
                match = re.search(custom_regex_pattern, full_text, re.IGNORECASE)
                if match:
                    code = match.group(1) if match.groups() else match.group(0)
                    return {
                        "success": True,
                        "extraction_type": "DIRECT_TEXT",
                        "extracted_code": code.strip(),
                        "extraction_url": None,
                        "raw_subject": email_data.get("subject")
                    }

            # 2. Patrón Estándar Fallback: Código numérico de 6 dígitos
            # Evitamos números muy largos o dentro de URLs
            patterns = [
                r'(?:código|code|pin|verificación)[^\d]*(\d{6})\b',
                r'\b(\d{6})\b'
            ]

            for pattern in patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    code = match.group(1)
                    return {
                        "success": True,
                        "extraction_type": "DIRECT_TEXT",
                        "extracted_code": code.strip(),
                        "extraction_url": None,
                        "raw_subject": email_data.get("subject")
                    }

            return {
                "success": False,
                "error": "No se pudo localizar el código numérico en el cuerpo del correo."
            }

        # ----------------------------------------------------
        # CASO B: PRE-EXTRACCIÓN DE ENLACE DE NAVEGACIÓN (Netflix)
        # ----------------------------------------------------
        elif extraction_type == ExtractionType.WEB_SCRAPING or extraction_type == "WEB_SCRAPING":
            all_links = cls.extract_links_from_html(html_body)

            # Buscar enlaces de Netflix de confirmación/login
            netflix_link_pattern = r'https?://[^\s"<>]*(?:netflix\.com/account/login|verify|youraccount|action)[^\s"<>]*'

            for link in all_links:
                if re.search(netflix_link_pattern, link, re.IGNORECASE):
                    return {
                        "success": True,
                        "extraction_type": "WEB_SCRAPING",
                        "extracted_code": None,
                        "extraction_url": link.strip(),
                        "raw_subject": email_data.get("subject")
                    }

            # Fallback en texto plano si no había tags HTML <a>
            match_in_text = re.search(netflix_link_pattern, full_text, re.IGNORECASE)
            if match_in_text:
                return {
                    "success": True,
                    "extraction_type": "WEB_SCRAPING",
                    "extracted_code": None,
                    "extraction_url": match_in_text.group(0).strip(),
                    "raw_subject": email_data.get("subject")
                }

            # Si no encontró un enlace específico de Netflix, retorna el primer enlace HTTPS relevante
            if all_links:
                return {
                    "success": True,
                    "extraction_type": "WEB_SCRAPING",
                    "extracted_code": None,
                    "extraction_url": all_links[0].strip(),
                    "raw_subject": email_data.get("subject")
                }

            return {
                "success": False,
                "error": "No se encontró ningún enlace interactivo válido en el correo para web scraping."
            }

        return {
            "success": False,
            "error": f"Tipo de extracción desconocido: {extraction_type}"
        }
