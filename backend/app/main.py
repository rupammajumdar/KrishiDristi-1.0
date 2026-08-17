"""
KrishiDrishti AI — FastAPI Main Application
Integrates CORS, Static Files, API Routers, and Auto-Seeding.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth_router, aois_router, predictions_router,
    districts_router, reports_router, alerts_router, admin_router
)
from app.seed import seed_database

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup DB initialization and auto-seeding."""
    print("[FastAPI] Starting KrishiDrishti AI Application...")
    try:
        await seed_database()
    except Exception as e:
        print(f"[FastAPI] Startup DB Init notice: {e}")
    yield
    print("[FastAPI] Shutting down KrishiDrishti AI Application...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-Stack Satellite & ML Monitoring Platform for Agriculture & Water Resources",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directories exist
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
rasters_dir = os.path.join(static_dir, "rasters")
reports_dir = os.path.join(static_dir, "reports")
os.makedirs(rasters_dir, exist_ok=True)
os.makedirs(reports_dir, exist_ok=True)

# Mount static files for rasters and PDF reports
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include Routers
app.include_router(auth_router.router)
app.include_router(aois_router.router)
app.include_router(predictions_router.router)
app.include_router(districts_router.router)
app.include_router(reports_router.router)
app.include_router(alerts_router.router)
app.include_router(admin_router.router)


@app.get("/health", tags=["Health Check"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
