# KrishiDrishti AI — Architecture Documentation

Complete **system architecture** and **ML model architecture** reference for the
KrishiDrishti platform, split into focused documents.

## Document Index

| File | Covers |
|------|--------|
| [01-system-architecture.md](01-system-architecture.md) | End-to-end system: layers, components, high-level data flow |
| [02-ml-model-architecture.md](02-ml-model-architecture.md) | ML engine internals: Random Forest, LSTM AutoEncoder, U-Net, yield regressor |
| [03-frontend-architecture.md](03-frontend-architecture.md) | React component tree, state management, data flows |
| [04-backend-api-architecture.md](04-backend-api-architecture.md) | FastAPI routers, service layer, data models, auth |
| [05-data-external-integrations.md](05-data-external-integrations.md) | Sentinel/GEE, OpenWeather, Gemini, Twilio, persistence |
| [06-deployment-architecture.md](06-deployment-architecture.md) | Runtime, ports, configuration, environment |

---

## Technology Stack

| Tier | Technology |
|------|-----------|
| **Frontend** | React 18, Vite 5, Tailwind CSS, Leaflet (GIS), Recharts, lucide-react |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy 2 (async), GeoAlchemy2 |
| **ML / AI** | scikit-learn (Random Forest), PyTorch (LSTM AutoEncoder, U-Net), joblib |
| **Data** | SQLite (dev) / PostgreSQL + PostGIS (prod), Redis/Celery (async) |
| **External** | Sentinel Hub / Google Earth Engine, OpenWeather, Google Gemini, Twilio |
| **ML checkpoints** | `rf_stress.joblib`, `lstm_anomaly_best.pth`, `unet_water_best.pth` |

---
