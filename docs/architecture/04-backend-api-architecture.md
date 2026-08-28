# 04 — Backend API Architecture

FastAPI backend (`backend/app/`). Python 3.13, SQLAlchemy 2 async, JWT auth.

## 1. Process Entry

`backend/app/main.py` — builds the app, CORS, static mounts, lifespan seeding,
registers routers. Served by uvicorn on port **8000**.

## 2. Router Map & Endpoints

| Router | Prefix | Endpoints |
|--------|--------|-----------|
| `auth_router` | `/api/auth` | `POST /register`, `POST /login`, `GET/PATCH /me` |
| `aois_router` | `/api/aois` | `POST ""`, `GET ""`, `GET/PATCH/DELETE /{id}`, `GET /{id}/timeline`, `GET /{id}/index`, `GET /{id}/multi-year-baseline`, `GET /{id}/swipe-comparison` |
| `predictions_router` | `/api/aois` | `POST /location-predict`, `POST /{id}/predict`, `GET /{id}/predict/history`, `GET /{id}/ai-advisory`, `POST /location-ai-advisory`, `POST /{id}/ask-ai` |
| `districts_router` | `/api/districts` | `GET ""`, `GET /{name}/summary`, `GET /{name}/drilldown`, `GET /geocode`, `GET /reverse-geocode` |
| `reports_router` | `/api/reports` | `POST ""`, `GET /{id}`, `GET /{id}/download` |
| `alerts_router` | `/api/alerts` | `GET ""`, `POST /{id}/acknowledge`, `GET /top-anomalies` |
| `admin_router` | `/api/admin` | `GET /pipeline/status`, `GET /models`, `POST /models/rollback`, `POST /pipeline/requeue` |

Public (no auth): `/health`, registration/login, districts/geocode, static files.

## 3. Service Layer

| Service | Responsibility |
|---------|----------------|
| `ml_engine.py` | Predictive engine — RF stress + LSTM anomaly + yield regressor + location context. See `02-ml-model-architecture.md`. |
| `satellite.py` | Sentinel-2 NDVI/NDWI/MNDWI stats, 5-year baselines, GEE fallback. |
| `gemini_service.py` | Gemini action tasks + Krishi Sahayak Q&A (grounded in live NDVI/NDWI). |
| `notifications.py` | SMS/email template + delivery (Twilio). |
| `reports.py` | PDF report generation (insurer/government personas). |

## 4. Data Model (SQLAlchemy — `models/__init__.py`)

```
users ─┬─ aois ──┬─ satellite_passes ── index_results
       │         ├─ yield_predictions ── alerts ── notifications
       │         └─ reports
       └─ (org_id → FPO)

Configuration: crop_configs, ml_model_versions, pipeline_jobs
```

### Core entities
- **User** (`users`) — role (farmer/government/insurer/admin), language_pref, SMS opt-in.
- **AOI** (`aois`) — drawn polygon as **WKT** (Text) for SQLite/PostGIS dual compat.
  Stores `district`, `taluk`, `village`, `state`, `area_hectares`, `crop_type`.
- **SatellitePass** — one row per imagery ingestion (scene, date, cloud cover, source).
- **IndexResult** — NDVI/NDWI `mean/min/max/std_dev`, `classification`
  (green/yellow/red), raster URI, pixel counts.
- **YieldPrediction** — ML output with `model_version`, kg/ha, `confidence_lower/upper`,
  `yield_change_pct`, full `input_snapshot_json` (audit), `feature_importance`,
  `triggered_alert`.
- **Alert** — early-warning drought/severe-stress/water-depletion, status lifecycle.
- **Notification** — SMS/email delivery tracking per alert (legacy SMS path from F3.2).
- **Report** — generated PDF records with persona template.
- **Config tables** — `CropConfig` (thresholds), `MLModelVersion` (active model registry),
  `PipelineJob` (Celery job tracking).

## 5. Database Access

- `database.py` — async engine; **SQLite fallback** when Postgres/PostGIS is unavailable
  (used for local dev, identified by `[DB] Using SQLite fallback`).
- GeoAlchemy2 for PostGIS; geometry stored as WKT text for lightweight SQLite mode.
- Auto-seed on startup via `seed.py`.

## 6. Auth Flow (`auth.py`)
- Passwords hashed with bcrypt.
- `POST /auth/login` → JWT `TokenResponse`.
- `get_current_user` dependency guards protected endpoints.
- Role-based access across the four dashboards.

## 7. Async Background Processing
- Celery + Redis declared in requirements (`tasks.py`, cron/pipeline):
  - Satellite pass ingestion.
  - Report generation.
  - Alert SMS dispatch (with `PipelineJob` status tracking).

## 8. Fallback / Resilience
Every external dependency (satellite, weather, Gemini) and DB has a deterministic
fallback, so the API remains functional offline (returning labeled fallback data that
degrades gracefully rather than failing).
