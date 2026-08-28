# 06 — Deployment & Runtime Architecture

How to run KrishiDrishti locally and how the pieces fit at runtime.

## 1. Runtime Topology

```
┌──────────────┐   HTTP :3000   ┌──────────────┐   HTTP :8000   ┌──────────────┐
│  Vite dev    │ ─────────────► │   Browser     │ ─────────────► │   uvicorn     │
│  server      │   (React SPA)  │  (fetch)      │    /api/*      │   FastAPI     │
└──────────────┘                └──────────────┘                └──────┬───────┘
                                                                       │
                               (optional) Redis :6379 ◄──── celery ───┤
                                                                       │
                                              ┌────────────────────────┤
                                              │ SQLite / PostgreSQL    │
                                              │ (PostGIS) :5432        │
                                              └────────────────────────┘
```

| Service | Port | Command |
|---------|------|---------|
| Frontend (Vite) | **3000** | `npm run dev` (in `frontend/`) |
| Backend (uvicorn) | **8000** | `uvicorn app.main:app --reload` (in `backend/`) |
| Postgres+PostGIS | **5432** | optional; falls back to SQLite |
| Redis (Celery broker) | **6379** | optional async jobs |

## 2. Startup Sequence (Backend)

1. `main.py` builds the FastAPI app + CORS + static mounts (`/static/rasters`,
   `/static/reports`).
2. Lifespan handler calls `seed_database()` → creates tables & demo data.
3. Routers registered: auth, aois, predictions, districts, reports, alerts, admin.
4. `/health` returns app/version/environment.

## 3. Configuration & Environment

Settings live in `backend/app/config.py` (pydantic-settings), sourced from
environment or a `.env` file. Key groups:

```
# App
APP_ENV, APP_DEBUG, APP_NAME, APP_VERSION, DEMO_MODE, SECRET_KEY, ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES=30, REFRESH_TOKEN_EXPIRE_DAYS=7

# Auth
JWT (HS256) via SECRET_KEY

# Database
DATABASE_URL (asyncpg), DATABASE_URL_SYNC, REDIS_URL

# External providers
MAPBOX_ACCESS_TOKEN, GEE_SERVICE_ACCOUNT_EMAIL, GEE_PRIVATE_KEY_PATH
SENTINEL_HUB_CLIENT_ID, SENTINEL_HUB_CLIENT_SECRET
GEMINI_API_KEY, GEMINI_MODEL
OPENWEATHER_API_KEY
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

# Domain thresholds
CLOUD_COVER_THRESHOLD=20, SENTINEL2_REVISIT_DAYS=5
NDVI_GREEN_THRESHOLD=0.6, NDVI_YELLOW_THRESHOLD=0.3
EARLY_WARNING_YIELD_DROP_PCT=20.0, ALERT_COOLDOWN_DAYS=5, DEFAULT_LANGUAGE=en
```

> **Security note:** `.env`, `backend/.env`, and `backend/gee-key.json` are
> gitignored. Credentials must never be committed.

## 4. ML Model Loading at Startup

`MLEngine.__init__` locates the `ML FOR KRIDSHDRISTI/checkpoints/` directory and
loads (when present):
- `rf_stress.joblib` → Random Forest stress classifier
- `lstm_anomaly_best.pth` → PyTorch LSTM AutoEncoder
- `unet_water_best.pth` → PyTorch U-Net water segmentation

`ml_loaded_status` reflects which are active; absent models fall back to algorithmic
implementations.

## 5. Production Considerations

- Set real `SECRET_KEY`, disable `DEMO_MODE`/`APP_DEBUG`.
- Point `DATABASE_URL` to Postgres + PostGIS for spatial analytics.
- Tighten CORS `allow_origins` (currently `*` — dev default).
- Run Celery workers for satellite ingestion/reports.
- Serve the built SPA (`npm run build` → `dist/`) from a static/CDN; proxy `/api/*`
  to FastAPI.

This document is part of the `docs/architecture/` set — see [README.md](README.md).
