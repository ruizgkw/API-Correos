# 🚀 API Correos - Extractor Autónomo de Códigos de Streaming

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

Plataforma backend SaaS diseñada para permitir a los clientes extraer autónomamente códigos de verificación de cuentas de streaming (**Netflix, Disney+, HBO Max, etc.**) sin entregar el control o credenciales de la cuenta de correo.

---

## ⚙️ Características Principales

* 🔐 **Autenticación Segura OTP vía Telegram:** Registro y login de clientes validado directamente por Telegram Bot con tokens JWT.
* 🛡️ **Seguridad en Reposo:** Cifrado simétrico AES-256 (Fernet) para credenciales IMAP y tokens de correo.
* ⚡ **Estrategia Dual de Extracción:**
  * **Caso A (Parsing Directo):** Lectura rápida e in-memory para plataformas como Disney+ / HBO Max.
  * **Caso B (Web Scraping Autónomo):** Automatización headless con Playwright y evitación de bloqueos para plataformas interactivas como Netflix.
* ⏳ **Rate Limiting & Cooldowns:** Cooldown estricto de 7 minutos respaldado por Redis para prevenir abuso y bloqueos de red.
* 📦 **Arquitectura Aislada Multi-Contenedor:** Microservicios desacoplados vía Docker Compose.

---

## 🛠️ Arquitectura del Sistema

```
  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
  │   Cliente    │ ────> │   Backend    │ ────> │  PostgreSQL  │
  │ Web / Telegram│       │  (FastAPI)   │       │  (Database)  │
  └──────────────┘       └──────────────┘       └──────────────┘
                                │                       │
                         ┌──────────────┐               │
                         │    Redis     │ ──────────────┘
                         │ (Queue/OTP)  │
                         └──────────────┘
                                │
                         ┌──────────────┐
                         │ IMAP / Worker│
                         │ (Playwright) │
                         └──────────────┘
```

---

## 🚀 Inicio Rápido con Docker

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/api-correos.git
cd api-correos
```

### 2. Configurar variables de entorno
Copia la plantilla de entorno `.env.example`:
```bash
cp .env.example .env
```

### 3. Levantar los servicios
```bash
docker-compose up -d --build
```

La API estará disponible en `http://localhost:8000`. Puedes explorar la documentación interactiva OpenAPI en:
* **Swagger UI:** `http://localhost:8000/docs`
* **ReDoc:** `http://localhost:8000/redoc`

---

## 📁 Estructura del Proyecto

```
API Correos/
├── apps/
│   └── backend/
│       ├── routers/        # Endpoints de la API (Auth, etc.)
│       ├── database.py     # Conexión AsyncSQLAlchemy
│       ├── imap_service.py # Conector asíncrono IMAP/SSL
│       ├── models.py       # Modelos ORM PostgreSQL
│       ├── redis_service.py# Gestión de OTPs y Cooldowns 7 min
│       ├── security.py     # Cifrado Fernet AES-256 y JWT
│       └── telegram_service.py # Conector HTTP Telegram Bot API
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## 📄 Licencia
Distribuido bajo la Licencia MIT. Ver `LICENSE` para más información.
