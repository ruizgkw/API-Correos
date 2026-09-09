# 🚀 EAcodigos - Extractor Autónomo de Códigos de Verificación

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Plataforma Web & API orientada a servicios de automatización para la extracción autónoma de códigos de verificación de plataformas digitales de forma segura vía IMAP y OAuth2, sin exponer las credenciales de correo a los usuarios finales.

---

## 🎨 Identidad Visual y Puertos por Defecto

* **Nombre de Marca:** **EAcodigos** *(Extractor Autónomo de Códigos)*.
* **Tema Visual:** *"Midnight Indigo"* (Obsidian `#0B0F19`, Indigo `#6366F1`, Violet `#818CF8`).
* **Puerto de Servicio Local:** `http://localhost:8990`
* **Landing Page & Portal de Clientes (SPA):** `http://localhost:8990/`
* **Portal Administrativo (SPA):** `http://localhost:8990/admin`
* **Documentación API (OpenAPI/Swagger):** `http://localhost:8990/docs`

---

## ⚙️ Características Principales

* 🔐 **Acceso Privado & Lista Blanca VIP (Telegram Bot):**
  * **Control de Lista Blanca:** Solo los clientes con Telegram Chat ID previa y explícitamente autorizados por el Administrador pueden recibir OTPs de acceso.
  * **Usuarios / Clientes:** Inicio de sesión mediante Telegram Chat ID y OTP de 6 dígitos enviado por Telegram Bot (válido por 5 min).
  * **Administradores:** Inicio de sesión con Usuario + Contraseña + Verificación OTP de 2FA por Telegram.
* 🛡️ **Seguridad de Alto Nivel:**
  * Credenciales IMAP de cuentas de correo cifradas en reposo con **Fernet AES-256**.
  * Autenticación moderna **OAuth2 (XOAUTH2)** con refresco continuo de tokens para Microsoft y Google.
  * Contraseñas de administrador hasheadas con **PBKDF2-SHA256**.
  * Tokens de sesión JWT (HS256) con expiración automática.
* ⚡ **Estrategia Dual de Extracción de Códigos:**
  * **Caso A (Direct Parsing / IMAP):** Consulta IMAP SSL ultrarrápida on-demand, filtrado por remitente dinámico, validación de antigüedad (< 10 min), filtro de palabras clave en el asunto y parser regex para códigos con dígitos separados por espacios (`7 6 2 7 4 0`).
  * **Caso B (Web Scraping / Playwright):** Extracción interactiva con navegador Playwright Chromium headless para resolver enlaces de verificación de hogar/viaje.
* ⏳ **Rate Limiting & Cooldown Persistente:**
  * Cooldown de **7 minutos (420 s)** gestionado en Redis por combinación de `(Telegram ID + Plataforma + Correo)`.
  * Barra de progreso y temporizador interactivo en la interfaz cliente que persiste al recargar la página.
* 💻 **Panel de Administración Completo (EAcodigos Admin):**
  * Gestión de Lista Blanca VIP para autorizar o revocar accesos a clientes (`/api/v1/admin/clients/authorize`).
  * Botones de 1-Clic OAuth2 para vincular cuentas de Microsoft y Google.
  * Registro y gestión de cuentas de correo (Gmail App Passwords, Outlook, IMAP genérico).
  * Función **"Probar Conexión IMAP"** para verificar credenciales en vivo.

---

## 🛠️ Arquitectura del Sistema

```
  ┌────────────────────────────────────────────────────────┐
  │                   Cliente (SPA Web)                    │
  │     http://localhost:8990 (Portal Cliente / Admin)     │
  └───────────────────────────┬────────────────────────────┘
                              │ HTTP / REST API (JWT)
  ┌───────────────────────────▼────────────────────────────┐
  │                 FastAPI Backend Container              │
  │                  (Puerto interno 8000)                 │
  └───────┬───────────────────┬───────────────────┬────────┘
          │                   │                   │
  ┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
  │   PostgreSQL   │  │     Redis      │  │  Telegram Bot  │
  │ (Database DB)  │  │(OTP/Cooldowns) │  │   (Auth OTP)   │
  └────────────────┘  └────────────────┘  └────────────────┘
                              │
                      ┌───────▼────────┐
                      │  Servidor IMAP │
                      │(Gmail / Mail)  │
                      └────────────────┘
```

---

## 🚀 Inicio Rápido con Docker

### 1. Clonar el repositorio
```bash
git clone https://github.com/ruizgkw/API-Correos.git
cd API-Correos
```

### 2. Configurar el archivo `.env`
Copia la plantilla `.env.example` y asigna tus tokens de Telegram y clave secreta:
```bash
cp .env.example .env
```

Configuración recomendada en `.env`:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=api_correos_db
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/api_correos_db

REDIS_URL=redis://redis:6379/0

SECRET_KEY=TU_LLAVE_SECRETA_JWT_AQUI
FERNET_KEY=TU_LLAVE_FERNET_AES256_BASE64_AQUI
TELEGRAM_BOT_TOKEN=8877489458:AAGG9NfB3T9vOtAAIs0EV5JgHBaGXVrmgbg
```

### 3. Levantar los contenedores Docker
```bash
docker-compose up -d --build
```

El servicio estará disponible de inmediato en **`http://localhost:8990`**.

---

## 📁 Estructura del Proyecto

```
API Correos/
├── apps/
│   ├── backend/
│   │   ├── routers/            # Endpoints API (auth.py, extraction.py, admin.py)
│   │   ├── database.py         # Conexión AsyncSQLAlchemy (PostgreSQL)
│   │   ├── imap_service.py     # Cliente IMAP SSL asíncrono y filtro de 10 min
│   │   ├── mail_parser.py      # Limpiador HTML y extracción Regex Disney+/HBO
│   │   ├── models.py           # Modelos ORM (User, MailAccount, StreamingPlatform, Logs)
│   │   ├── redis_service.py    # Gestión de OTP (5 min) y Cooldowns (7 min)
│   │   ├── security.py         # Cifrado Fernet AES-256, PBKDF2 y JWT
│   │   ├── scraping_worker.py  # Automation engine Playwright para Netflix
│   │   └── telegram_service.py # Integración con Telegram Bot API
│   └── frontend/
│       ├── index.html          # Portal Web de Clientes SPA
│       ├── admin.html          # Portal Administrativo SPA
│       ├── js/
│       │   ├── app.js          # Lógica cliente, temporizadores y OTP
│       │   └── admin.js        # Lógica administrador y gestión IMAP
│       └── favicon.svg         # Favicon Cyber Mail Bolt
├── .env.example
├── docker-compose.yml          # Mapeo de puertos (8990:8000) y volúmenes
└── README.md
```

---

## 🔑 Configuración de Correos Gmail

Para conectar cuentas de correo de Gmail en el panel de administración:
1. Activa la **Verificación en 2 pasos** en la cuenta de Google.
2. Ingresa a [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Genera una **Contraseña de Aplicación** (16 caracteres).
4. Registra el correo en `/admin` usando esa contraseña. El sistema eliminará automáticamente los espacios y cifrará la clave en la base de datos.

---

## 📄 Licencia
Distribuido bajo la Licencia MIT. Ver `LICENSE` para más información.
