import pytest
from mail_parser import MailParser

def test_extract_code_disney_direct():
    html_sample = """
    <html>
        <body>
            <h1>Bienvenido a Disney+</h1>
            <p>Tu código de verificación de 6 dígitos es:</p>
            <h2> 849201 </h2>
            <p>Este código expira en 15 minutos.</p>
        </body>
    </html>
    """
    email_data = {
        "subject": "Tu código de verificación de Disney+",
        "text_body": "",
        "html_body": html_sample
    }

    result = MailParser.parse_email(email_data, extraction_type="DIRECT_TEXT")
    assert result["success"] is True
    assert result["extracted_code"] == "849201"
    assert result["extraction_type"] == "DIRECT_TEXT"

def test_extract_netflix_link():
    html_sample = """
    <html>
        <body>
            <h1>Inicio de sesión en Netflix</h1>
            <p>Haz clic en el siguiente enlace para confirmar tu acceso:</p>
            <a href="https://www.netflix.com/account/login?code=998877665544332211">Ver código de acceso</a>
        </body>
    </html>
    """
    email_data = {
        "subject": "Enlace de inicio de sesión de Netflix",
        "text_body": "",
        "html_body": html_sample
    }

    result = MailParser.parse_email(email_data, extraction_type="WEB_SCRAPING")
    assert result["success"] is True
    assert result["extraction_url"] == "https://www.netflix.com/account/login?code=998877665544332211"
    assert result["extraction_type"] == "WEB_SCRAPING"
