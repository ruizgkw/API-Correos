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

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="static")

@app.get("/favicon.svg", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join(FRONTEND_DIR, "favicon.svg"))

@app.get("/", include_in_schema=False)
async def serve_client_spa():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/admin", include_in_schema=False)
async def serve_admin_spa():
    return FileResponse(os.path.join(FRONTEND_DIR, "admin.html"))

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "backend-api"}



