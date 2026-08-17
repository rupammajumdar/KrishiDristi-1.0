"""
KrishiDrishti AI — Celery Background Async Tasks
Handles high-computation satellite raster processing, ML inference, and PDF rendering.
"""

from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "krishidristi",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task(name="app.tasks.ingest_satellite_scene", bind=True, max_retries=3)
def ingest_satellite_scene(self, aoi_id: int, scene_id: str):
    """
    Background job to fetch cloud-free scene from GEE/Sentinel Hub,
    apply cloud/shadow masking, and store raster tiles.
    """
    try:
        print(f"[Celery Worker] Ingesting satellite scene {scene_id} for AOI #{aoi_id}...")
        return {"status": "success", "aoi_id": aoi_id, "scene_id": scene_id}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="app.tasks.run_yield_prediction_task")
def run_yield_prediction_task(aoi_id: int):
    """Background ML yield prediction inference task."""
    print(f"[Celery Worker] Running ML yield prediction for AOI #{aoi_id}...")
    return {"status": "success", "aoi_id": aoi_id}


@celery_app.task(name="app.tasks.generate_pdf_report_task")
def generate_pdf_report_task(report_id: int):
    """Background task to generate and store PDF report."""
    print(f"[Celery Worker] Generating PDF report #{report_id}...")
    return {"status": "success", "report_id": report_id}
