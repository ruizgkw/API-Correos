import re
import logging
import asyncio
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger("scraping_worker")

# User-Agents reales para evitar bloqueos por headless
DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
]

class ScrapingWorker:
    @classmethod
    async def extract_code_from_url(
        cls,
        url: str,
        platform_name: str = "Netflix",
        timeout_ms: int = 15000
    ) -> Dict[str, Any]:
        """
        Navega de forma autónoma a la URL extraída del correo, procesa la interfaz interactiva (Netflix),
        extrae el código visualizado en pantalla, borra cookies y cierra sesión.
        """
        if not url:
            return {"success": False, "error": "URL vacía no válida para scraping."}

        import random
        user_agent = random.choice(DEFAULT_USER_AGENTS)

        async with async_playwright() as p:
            # Lanzar Chromium headless con opciones anti-detección
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-infobars",
                    "--window-size=1280,800"
                ]
            )

            context = await browser.new_context(
                user_agent=user_agent,
                viewport={"width": 1280, "height": 800},
                locale="es-ES"
            )

            # Ocultar la propiedad navigator.webdriver
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            """)

            page = await context.new_page()

            try:
                logger.info(f"Navegando a enlace de {platform_name}: {url}")
                response = await page.goto(url, wait_until="networkidle", timeout=timeout_ms)

                if not response or response.status >= 400:
                    logger.warning(f"Respuesta HTTP sospechosa o errónea: {response.status if response else 'No response'}")

                # Esperar unos instantes a que renderice la página de código
                await page.wait_for_timeout(2000)

                # Extraer todo el contenido visible de texto de la página
                page_text = await page.inner_text("body")

                # Estrategia Regex para detectar el código en pantalla (Netflix suele mostrar 4 a 8 dígitos/letras)
                # Ejemplo de texto típico: "Tu código de acceso es 4819" o códigos destacados en elementos CSS
                code_match = None

                # 1. Buscar en elementos de texto grandes o destacados (h1, h2, div con clase code)
                code_elements = await page.query_selector_all("h1, h2, h3, .code, [data-uia*='code'], .access-code")
                for el in code_elements:
                    text = await el.inner_text()
                    match = re.search(r'\b([A-Za-z0-9]{4,8})\b', text.strip())
                    if match:
                        code_match = match.group(1)
                        break

                # 2. Si no se encontró en elementos destacados, buscar en el texto completo de la página
                if not code_match:
                    match_in_body = re.search(
                        r'(?:código|code|acceso|pin)[^\w]*([A-Za-z0-9]{4,8})\b',
                        page_text,
                        re.IGNORECASE
                    )
                    if match_in_body:
                        code_match = match_in_body.group(1)

                # 3. Fallback genérico: buscar cualquier secuencia de 4 a 6 dígitos en el cuerpo
                if not code_match:
                    digits_match = re.search(r'\b(\d{4,6})\b', page_text)
                    if digits_match:
                        code_match = digits_match.group(1)

                # Limpieza de seguridad: borrar cookies e invalidar la sesión interactiva
                await context.clear_cookies()
                await page.close()
                await browser.close()

                if code_match:
                    return {
                        "success": True,
                        "extracted_code": code_match.strip(),
                        "platform": platform_name,
                        "url_processed": url
                    }
                else:
                    return {
                        "success": False,
                        "error": "Página abierta correctamente pero no se encontró un código visualizable en pantalla.",
                        "url_processed": url
                    }

            except PlaywrightTimeoutError:
                logger.error(f"Timeout de navegación ({timeout_ms}ms) al abrir: {url}")
                await context.clear_cookies()
                await browser.close()
                return {
                    "success": False,
                    "error": f"Timeout al cargar la página de {platform_name}."
                }
            except Exception as e:
                logger.error(f"Error imprevisto en ScrapingWorker: {str(e)}")
                try:
                    await context.clear_cookies()
                    await browser.close()
                except Exception:
                    pass
                return {
                    "success": False,
                    "error": f"Error procesando la página: {str(e)}"
                }
