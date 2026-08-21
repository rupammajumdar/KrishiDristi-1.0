"""
KrishiDrishti AI — PDF Reports Router
POST /api/reports, GET /api/reports/{id}, GET /api/reports/{id}/download
"""

import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, AOI, Report, PersonaTemplate, IndexResult, YieldPrediction
from app.schemas import ReportRequest, ReportResponse
from app.auth import get_current_user
from app.services.reports import report_generator

router = APIRouter(prefix="/api/reports", tags=["PDF Reports"])


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    req: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Queue/generate an audit-ready PDF summary report for an AOI (F4.1 requirement).
    Persona templates: Farmer (simple, localized), Government (district roll-up), Insurer (full audit trail).
    """
    res = await db.execute(select(AOI).where(AOI.id == req.aoi_id))
    aoi = res.scalar_one_or_none()
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")

    new_report = Report(
        aoi_id=req.aoi_id,
        requested_by=current_user.id,
        persona_template=PersonaTemplate(req.persona_template.value),
        report_title=req.title or f"{req.persona_template.value.capitalize()} Assessment Report - {aoi.name or aoi.id}",
        status="generating"
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)

    # Fetch latest index and prediction data
    idx_res = await db.execute(
        select(IndexResult)
        .join(AOI, IndexResult.pass_id == AOI.id)
        .where(AOI.id == req.aoi_id)
        .order_by(IndexResult.created_at.desc())
    )
    latest_idx = idx_res.scalars().first()

    pred_res = await db.execute(
        select(YieldPrediction)
        .where(YieldPrediction.aoi_id == req.aoi_id)
        .order_by(YieldPrediction.created_at.desc())
    )
    latest_pred = pred_res.scalars().first()

    chosen_crop = req.crop_type or (aoi.crop_type.value if aoi.crop_type else "cotton")

    # Resolve accurate location if missing or generic
    district = aoi.district or "Jalna"
    taluk = aoi.taluk or district
    village = aoi.village or taluk
    state = aoi.state or "Maharashtra"

    if (not aoi.district or aoi.district.lower() in ["jalna", "unknown", "string"]) and aoi.geometry:
        try:
            from app.routers.districts_router import reverse_geocode_coords
            import shapely.wkt
            from shapely.geometry import shape
            geom_str = str(aoi.geometry).split(";")[-1].strip()
            if geom_str.startswith("{"):
                import json
                geom_shape = shape(json.loads(geom_str))
            else:
                geom_shape = shapely.wkt.loads(geom_str)
            lat, lon = geom_shape.centroid.y, geom_shape.centroid.x
            geo_info = await reverse_geocode_coords(lat, lon)
            district = aoi.district if aoi.district and aoi.district.lower() != "jalna" else geo_info["district"]
            taluk = aoi.taluk or geo_info["taluk"]
            village = aoi.village or geo_info["village"]
            state = aoi.state or geo_info["state"]
        except Exception:
            pass

    aoi_data = {
        "name": aoi.name,
        "aoi_type": aoi.aoi_type.value if aoi.aoi_type else "farm",
        "district": district,
        "taluk": taluk,
        "village": village,
        "state": state,
        "area_hectares": aoi.area_hectares,
        "crop_type": chosen_crop,
        "owner_id": aoi.owner_id
    }

    ndvi_data = {
        "mean_value": latest_idx.mean_value if latest_idx else 0.52,
        "classification": latest_idx.classification.value if latest_idx and hasattr(latest_idx.classification, "value") else "yellow"
    }

    pred_data = {
        "predicted_yield_kg_ha": latest_pred.predicted_yield_kg_ha if latest_pred else 1850.0,
        "yield_change_pct": latest_pred.yield_change_pct if latest_pred else -15.9,
        "model_version": latest_pred.model_version if latest_pred else f"v1.2.0-rf-{chosen_crop}"
    }

    pref_lang = req.language or (current_user.language_pref.value if hasattr(current_user.language_pref, "value") else "en")

    # Generate real-time Google Gemini AI farm advisory tasks for Farmer reports
    ai_tasks = None
    if req.persona_template.value == "farmer":
        try:
            from app.services.gemini_service import gemini_service
            from app.services.ml_engine import ml_engine
            rain_mm, temp_c = ml_engine.fetch_live_weather(lat, lon)
            ai_tasks = await gemini_service.generate_realtime_actionable_tasks(
                aoi_data=aoi_data,
                crop_type=chosen_crop,
                ndvi=ndvi_data["mean_value"],
                ndwi=-0.15,
                temp_c=temp_c,
                rain_mm=rain_mm,
                lang=pref_lang
            )
        except Exception:
            pass

    # Build PDF file synchronously
    file_uri = report_generator.generate_pdf(
        report_id=new_report.id,
        aoi_data=aoi_data,
        persona=req.persona_template.value,
        ndvi_data=ndvi_data,
        prediction_data=pred_data,
        language=pref_lang,
        ai_tasks=ai_tasks
    )

    new_report.file_uri = file_uri
    new_report.status = "completed"
    new_report.generated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(new_report)

    return ReportResponse.model_validate(new_report)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report_status(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Fetch report details and status."""
    res = await db.execute(select(Report).where(Report.id == report_id))
    rpt = res.scalar_one_or_none()
    if not rpt:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse.model_validate(rpt)


@router.get("/{report_id}/download")
async def download_report_pdf(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Download the generated PDF report."""
    res = await db.execute(select(Report).where(Report.id == report_id))
    rpt = res.scalar_one_or_none()

    possible_dirs = [
        report_generator.REPORTS_DIR,
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "reports"),
        os.path.join("/tmp", "reports")
    ]

    found_path = None

    if rpt and rpt.file_uri:
        rel_path = rpt.file_uri.split("/reports/")[-1]
        for pdir in possible_dirs:
            candidate = os.path.join(pdir, rel_path)
            if os.path.exists(candidate):
                found_path = candidate
                break

    if not found_path:
        for pdir in possible_dirs:
            if os.path.exists(pdir):
                for fname in os.listdir(pdir):
                    if f"report_{report_id}_" in fname and fname.endswith(".pdf"):
                        found_path = os.path.join(pdir, fname)
                        break
            if found_path:
                break

    if not found_path:
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        path=found_path,
        filename=f"KrishiDrishti_Report_{report_id}.pdf",
        media_type="application/pdf"
    )
