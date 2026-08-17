"""
KrishiDrishti AI — Application Configuration
Pydantic Settings for environment-based configuration.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache

# Resolve .env relative to this file: backend/app/config.py → root .env
_BASE_DIR = Path(__file__).resolve().parent.parent.parent  # project root
_ENV_FILE = _BASE_DIR / ".env"


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_NAME: str = "KrishiDrishti AI"
    APP_VERSION: str = "1.0.0"
    DEMO_MODE: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://krishidristi:krishidristi_secret@localhost:5432/krishidristi_db"
    DATABASE_URL_SYNC: str = "postgresql://krishidristi:krishidristi_secret@localhost:5432/krishidristi_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # JWT Auth
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # External APIs
    MAPBOX_ACCESS_TOKEN: Optional[str] = None
    GEE_SERVICE_ACCOUNT_EMAIL: Optional[str] = None
    GEE_PRIVATE_KEY_PATH: Optional[str] = None

    # Sentinel Hub (OAuth2 + Statistics API v2)
    SENTINEL_HUB_CLIENT_ID: Optional[str] = None
    SENTINEL_HUB_CLIENT_SECRET: Optional[str] = None
    SENTINEL_HUB_API_URL: str = "https://services.sentinel-hub.com"
    SENTINEL_HUB_TOKEN_URL: str = "https://services.sentinel-hub.com/oauth/token"

    # Google Gemini AI
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"

    # OpenWeather (current + 5-day forecast)
    OPENWEATHER_API_KEY: Optional[str] = None
    OPENWEATHER_BASE_URL: str = "https://api.openweathermap.org/data/2.5"
    OPENWEATHER_FORECAST_DAYS: int = 5

    # Twilio SMS
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # Satellite Config
    CLOUD_COVER_THRESHOLD: int = 20
    SENTINEL2_REVISIT_DAYS: int = 5
    NDVI_GREEN_THRESHOLD: float = 0.6
    NDVI_YELLOW_THRESHOLD: float = 0.3
    EARLY_WARNING_YIELD_DROP_PCT: float = 20.0
    ALERT_COOLDOWN_DAYS: int = 5

    # Language
    DEFAULT_LANGUAGE: str = "en"

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
