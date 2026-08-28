# 01 — System Architecture

End-to-end, logical and physical architecture of **KrishiDrishti AI**, a full-stack
satellite + ML agricultural monitoring platform.

## 1. High-Level Component Diagram

```
         ┌─────────────────────────────────────────────────────────────────────┐
         │                          PRESENTATION LAYER                          │
         │   (React 18 + Vite + Tailwind + Leaflet + Recharts)                  │
         │                                                                      │
         │   Farmer        Government        Insurer        Admin               │
         │  Dashboard        Dashboard      Dashboard      Console              │
         │   (GIS map)        (district)     (claims)       (ops)               │
         └───────────────┬──────────────────────────────────────────────────────┘
                         │  REST / JSON (fetch → frontend/src/api.js)
                         ▼
         ┌─────────────────────────────────────────────────────────────────────┐
         │                         API GATEWAY / BACKEND                        │
         │                    (FastAPI  •  Python 3.13)                         │
         │                                                                      │
         │  Routers:  auth | aois | predictions | districts |                   │
         │            reports | alerts | admin                                  │
         │                                                                      │
         │  Services: ml_engine | satellite | gemini_service |                  │
         │            notifications | reports                                   │
         └───────┬───────────────┬───────────────┬───────────────┬──────────────┘
                 │               │               │               │
        ┌────────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────────┐
        │   DATA LAYER  │  │  ML/AI LAYER│  │ EXTERNAL    │  │  INFRA LAYER   │
        │  SQLAlchemy   │  │ scikit-learn│  │ Sentinel Hub│  │  uvicorn :8000 │
        │  SQLite/PostGIS│ │  PyTorch    │  │ OpenWeather │  │  Vite   :3000  │
        │  GeoAlchemy2  │  │  joblib     │  │ Gemini AI   │  │  Redis / Celery│
        └───────────────┘  └─────────────┘  │ Twilio SMS  │  └────────────────┘
                                            └─────────────┘
```

## 2. Architectural Layers

### 2.1 Presentation Layer (`frontend/`)
Single-page React application. Multi-role dashboards:
- **FarmerDashboard** — primary. GIS plot selection, health score, ML advisory tasks,
  live weather, NDVI/NWI telemetry, Krishi Sahayak AI Q&A, voice readout, WhatsApp share.
- **GISMap** — Leaflet map for drawing/locating farms, reverse-geocoding.
- **GovernmentDashboard / InsurerDashboard / AdminPanel** — district/claim/ops views.
- **ExplainabilityPanel** — feature importance for ML results.
- Multilingual (EN / MR / HI / KN / TE) via `i18n.js`.

### 2.2 Application / API Layer (`backend/app/`)
FastAPI app exposing `/api/*` endpoints (see `04-backend-api-architecture.md`).
Config & auth handled centrally via `config.py`, `auth.py`, `database.py`.

### 2.3 Service Layer (`backend/app/services/`)
- **`ml_engine.py`** — core predictive engine (Random Forest + LSTM + U-Net + yield regressor).
- **`satellite.py`** — Sentinel-2 NDVI/NDWI/MNDWI stats, 5-year baselines.
- **`gemini_service.py`** — AI agronomist + actionable tasks.
- **`notifications.py`** — SMS / in-app alerts.
- **`reports.py`** — PDF/insurer report generation.

### 2.4 Data Layer
Relational store of users, AOIs (geometries), satellite passes, index results,
yield predictions, alerts, notifications. See `04-backend-api-architecture.md`.

### 2.5 ML/AI Layer (`ML FOR KRIDSHDRISTI/`)
Offline-trained model checkpoints loaded at runtime (see `02-ml-model-architecture.md`).

## 3. Primary Request Pipeline (Farmer Prediction)

```
Farmer selects / draws a plot on GISMap
        │  api.createAOI(geometry, location)
        ▼
FastAPI aois_router  → persists AOI (GeoAlchemy geometry)
        │
        ▼
FarmerDashboard triggers prediction
        │  api.predictYield(aoiId, {location context})
        ▼
predictions_router.predict_yield
        │  1. _get_latest_index_values()  → DB (or live)
        │  2. satellite_engine._fetch_gee_statistics() → NDVI/NDWI
        │  3. extract centroid (lat, lon) from geometry
        │  4. ml_engine.predict_yield(ndvi, ndwi, lat, lon, district, state)
        │       • fetch live weather (OpenWeather)
        │       • get_location_context → agro-zone / soil / KVK
        │       • run_rf_stress_inference → stress class
        │       • run_lstm_anomaly_inference → anomaly score
        │       • compute calibrated yield + feature importance
        │  5. persist YieldPrediction
        │  6. trigger drought alert (F3.2) if stressed
        ▼
PredictResponse  → FarmerDashboard renders score + tasks
```

## 4. Advisory / AI Pipeline (Krishi Sahayak)

```
Farmer asks question → POST /aois/{id}/ask-ai
        ▼
predictions_router.ask_ai_assistant
        ▼
ml_engine.predict_yield(...)  → full ML result (NDVI, NDWI, RF, LSTM, yield, soil, KVK)
        ▼
gemini_service.ask_agronomist_assistant(question, ml_prediction=...)
        ▼
Gemini grounded in TODAY's NDVI/NDWI + full diagnosis → localized answer
```

## 5. Offline / Degraded Mode

When external APIs are unreachable, each service returns **fallback** outputs:
- `satellite.py` → seeded seasonal NDVI computation.
- `ml_engine.py` → algorithmic spectral stress classifier (no live model).
- `gemini_service.py` → deterministic localized fallback tasks.
- `frontend/src/api.js` → mock fallbacks for AOI/prediction (uses real coordinates,
  never a hardcoded default location).

## 6. Cross-Cutting Concerns

- **Auth:** JWT (python-jose) via `auth.py`; role-based farmer/insurer/government/admin.
- **CORS:** wide-open `allow_origins=["*"]` (dev default).
- **Localization:** language preference threaded through prediction → advisory → tasks.
- **Resilience:** every external call wrapped in try/except with fallback semantics.
