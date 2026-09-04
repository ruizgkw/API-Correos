from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import init_db
from routers import auth, extraction, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializar las tablas de la BD al arrancar
    await init_db()
    yield

app = FastAPI(
    title="API Correos - Streaming Code Extractor",
    version="0.1.0",
    description="API REST para extracción de códigos de verificación de correo",
    lifespan=lifespan
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(extraction.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "backend-api"}


