# 05 — Data & External Integrations

How KrishiDrishti acquires satellite data, weather, AI, and notifications, and how it
persists them. Provider access is configured through `backend/app/config.py`
(pydantic-settings, loaded from environment / `.env`).

## 1. Satellite Remote Sensing — NDVI / NDWI / MNDWI

**Provider:** Sentinel Hub Statistics API v2 (+ Google Earth Engine path).

- `satellite.py` builds NDVI / NDWI / NDMI / MNDWI evalscripts with **SCL cloud &
  shadow masking** (SCL bands 3, 8, 9, 10 → NaN).
- OAuth2 `client_credentials` token fetched and **cached for ~3580s**.
- Returns per-AOI zonal statistics: `mean / min / max / std_dev`, pixel counts.
- Provides 5-year seasonal NDVI baselines for yield normalization
  (`satellite_engine.get_5year_baseline(crop, month)`).
- **Offline fallback:** realistic seeded seasonal NDVI computation.

**Config keys:**
```
SENTINEL_HUB_CLIENT_ID, SENTINEL_HUB_CLIENT_SECRET, SENTINEL_HUB_API_URL
GEE_SERVICE_ACCOUNT_EMAIL, GEE_PRIVATE_KEY_PATH
CLOUD_COVER_THRESHOLD=20, SENTINEL2_REVISIT_DAYS=5
```

## 2. Weather Telemetry — OpenWeather

`ml_engine.fetch_live_weather(lat, lon)` → `(rainfall_mm, temp_c)`
- Current temperature from `/weather` endpoint.
- Rainfall from `/forecast` 5-day/3-hour slots, scaled to a 30-day estimate,
  clamped to `[100, 1200]` mm.
- Used in yield factor computation and advisory grounding.
- **Offline fallback:** seasonal defaults (e.g. 380 mm, 29.2°C). No API key →
  `seasonal_fallback` source flag in the snapshot.

**Config keys:**
```
OPENWEATHER_API_KEY, OPENWEATHER_BASE_URL, OPENWEATHER_FORECAST_DAYS=5
```

## 3. AI — Google Gemini (`gemini_service.py`)

Two LLM capabilities:

### 3.1 Actionable Tasks (`generate_realtime_actionable_tasks`)
Generates exactly 3 prioritized "WHAT TO DO THIS WEEK" tasks (irrigation, nutrition
spray, pest protection) grounded in ML diagnosis (RF class/probabilities, LSTM anomaly),
live NDVI/NDWI, weather, KVK, crop & location. Returns a JSON array; parsed safely.
Fallback: deterministic localized task templates.

### 3.2 Krishi Sahayak Q&A (`ask_agronomist_assistant`)
Interactive agronomist bot. The prompt is grounded in **today's exact telemetry**:
- Sentinel-2 NDVI & NDWI (session-fresh values),
- Random Forest stress label + class + probabilities,
- LSTM anomaly status/score,
- predicted yield change, agro-zone, soil type, KVK hub, rainfall, temperature.

The model is instructed to base irrigation answers on NDWI + soil, fertilizer answers
on crop stage + soil, and pest answers on temperature + NDWI.

**Config keys:**
```
GEMINI_API_KEY, GEMINI_MODEL="gemini-3.1-flash-lite"
```

## 4. Notifications — Twilio SMS (`notifications.py`)

When a prediction triggers a drought/severity alert (F3.2) and the farmer opted in:
- Localized SMS message formatted in the farmer's `language_pref`.
- Sent via Twilio; a `Notification` row records channel + delivery status.
- Config keys:
```
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
```

## 5. Persistence

- **Primary:** PostgreSQL + PostGIS (asyncpg, GeoAlchemy2) — spatial analytics.
- **Dev fallback:** SQLite (WKT text geometry) for local no-infra runs.
- Stores: users, AOIs (geometry + admin location fields), satellite passes, index
  results, yield predictions (full audit snapshot), alerts, notifications, reports,
  plus config tables (`crop_configs`, `ml_model_versions`, `pipeline_jobs`).

**Config keys:**
```
DATABASE_URL (asyncpg), DATABASE_URL_SYNC, REDIS_URL,
CELERY_BROKER_URL, CELERY_RESULT_BACKEND
```

## 6. Async Jobs — Redis + Celery

Declared in `backend/requirements.txt`; used by `tasks.py`/`pipeline`:
- Satellite pass ingestion & index computation.
- Report generation.
- Alert dispatch and requeue (admin `PipelineJob` monitoring).

## 7. Data Flow Summary

```
Sentinel/ GEE ─► satellite.py ─► NDVI/NDWI (+5-yr baseline)
OpenWeather ───► ml_engine ─► rainfall_mm, temp_c
(above) ───────► ml_engine.predict_yield ─► stress, anomaly, yield, importance, snapshot
snapshot + context ─► gemini_service ─► tasks / Krishi Sahayak answer
stress → alert ─► notification_service ─► Twilio SMS + in-app alert
all → SQLAlchemy persistence (PostGIS / SQLite)
```
