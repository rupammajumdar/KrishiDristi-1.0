# KrishiDrishti AI Platform

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL + PostGIS + Redis)
docker-compose up -d

# 2. Start backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Start Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# 4. Start frontend
cd frontend
npm install
npm run dev
```

## Architecture
- **Backend**: FastAPI + Python 3.11+
- **Database**: PostgreSQL 16 + PostGIS 3.4
- **Cache/Queue**: Redis 7
- **Task Queue**: Celery
- **Frontend**: Next.js 14 + Leaflet + Chart.js
- **ML**: Scikit-Learn + Joblib
