"""
KrishiDrishti AI — Predictive AI Router
POST /api/aois/{id}/predict   — run ML prediction with real NDVI/NDWI from latest satellite pass
GET  /api/aois/{id}/predict/history — audit history with versioned model snapshots
"""

import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import (
    User, AOI, CropType, YieldPrediction, Alert, AlertType, AlertStatus,
    Notification, NotificationChannel, SatellitePass, IndexResult, IndexType,
)
from app.schemas import PredictionRequest, PredictionResponse, PredictionHistoryResponse
from app.auth import get_current_user
from app.services.ml_engine import ml_engine
from app.services.satellite import satellite_engine
from app.services.notifications import notification_service

router = APIRouter(prefix="/api/aois", tags=["ML Yield Predictions"])


async def _get_latest_index_values(
    aoi_id: int, db: AsyncSession
) -> tuple[float, float]:
    """
    Pull the most recent NDVI and NDWI index results for an AOI from the DB.
    Falls back to sensible defaults when no index records exist yet.
    """
    # Latest NDVI
    ndvi_res = await db.execute(
        select(IndexResult)
        .join(SatellitePass)
        .where(
            SatellitePass.aoi_id == aoi_id,
            IndexResult.index_type == IndexType.NDVI,
        )
        .order_by(SatellitePass.acquisition_date.desc())
    )
    ndvi_record = ndvi_res.scalars().first()
    mean_ndvi = float(ndvi_record.mean_value) if ndvi_record else 0.48

    # Latest NDWI
    ndwi_res = await db.execute(
        select(IndexResult)
        .join(SatellitePass)
        .where(
            SatellitePass.aoi_id == aoi_id,
            IndexResult.index_type == IndexType.NDWI,
        )
        .order_by(SatellitePass.acquisition_date.desc())
    )
    ndwi_record = ndwi_res.scalars().first()
    mean_ndwi = float(ndwi_record.mean_value) if ndwi_record else -0.12

    return mean_ndvi, mean_ndwi


@router.post("/{aoi_id}/predict", response_model=PredictionResponse)
async def predict_yield(
    aoi_id: int,
    req: Optional[PredictionRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger ML yield prediction for an AOI (F3.1).
    - Pulls the latest NDVI and NDWI from stored satellite index results.
    - Fetches real-time temperature and rainfall via OpenWeather API.
    - If yield drop >= 20%, raises an Early Warning Drought Risk Alert (F3.2).
    - Sends SMS via Twilio if the farmer has opted in and creds are configured.
    """
    res = await db.execute(select(AOI).where(AOI.id == aoi_id))
    aoi = res.scalar_one_or_none()
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")

    # Return cached prediction unless force_recompute is requested
    if req and not req.force_recompute:
        pred_res = await db.execute(
            select(YieldPrediction)
            .where(YieldPrediction.aoi_id == aoi_id)
            .order_by(YieldPrediction.created_at.desc())
        )
        existing = pred_res.scalars().first()
        if existing:
            return PredictionResponse.model_validate(existing)

    # ── Step 1: Compute live Google Earth Engine NDVI / NDWI for the exact drawn geometry ──
    from app.routers.aois_router import parse_geometry_to_geojson
    mean_ndvi, mean_ndwi = await _get_latest_index_values(aoi_id, db)

    if aoi.geometry:
        try:
            import asyncio
            geom_dict = parse_geometry_to_geojson(aoi.geometry)
            gee_ndvi = await asyncio.to_thread(satellite_engine._fetch_gee_statistics, geom_dict, "ndvi")
            if gee_ndvi is not None:
                mean_ndvi = round(gee_ndvi, 3)
            
            gee_ndwi = await asyncio.to_thread(satellite_engine._fetch_gee_statistics, geom_dict, "ndwi")
            if gee_ndwi is not None:
                mean_ndwi = round(gee_ndwi, 3)
        except Exception as e:
            print(f"[Prediction GEE Fetch Exception] {e}")

    # ── Step 2: Get real coordinates from geometry for weather lookup ──────
    lat, lon = 19.8341, 75.8812  # Jalna defaults
    try:
        from shapely.geometry import shape
        import shapely.wkt
        if aoi.geometry:
            geom_str = str(aoi.geometry).split(";")[-1].strip()
            if geom_str.startswith("{"):
                import json
                geom_dict = json.loads(geom_str)
                geom_shape = shape(geom_dict)
            else:
                geom_shape = shapely.wkt.loads(geom_str)
            centroid = geom_shape.centroid
            lat, lon = centroid.y, centroid.x
    except Exception as e:
        print(f"[Prediction Centroid Error] {e}")

    # ── Step 3: Run ML inference with live weather ─────────────────────────
    if req and req.crop_type:
        crop = req.crop_type.value
        # Also sync AOI crop_type in DB
        aoi.crop_type = CropType(crop)
        await db.commit()
    else:
        crop = aoi.crop_type.value if aoi.crop_type else "cotton"

    area = aoi.area_hectares or 2.5

    pred_result = ml_engine.predict_yield(
        mean_ndvi=mean_ndvi,
        mean_ndwi=mean_ndwi,
        crop_type=crop,
        area_ha=area,
        lat=lat,
        lon=lon,
        # rainfall_mm and temp_avg_c left as None → fetched live from OpenWeather
    )

    # ── Step 4: Persist prediction ─────────────────────────────────────────
    db_pred = YieldPrediction(
        aoi_id=aoi_id,
        model_version=pred_result["model_version"],
        predicted_yield_kg_ha=pred_result["predicted_yield_kg_ha"],
        confidence_lower=pred_result["confidence_lower"],
        confidence_upper=pred_result["confidence_upper"],
        yield_change_pct=pred_result["yield_change_pct"],
        input_snapshot_json=pred_result["input_snapshot_json"],
        feature_importance=pred_result["feature_importance"],
        crop_type=CropType(crop),
        triggered_alert=pred_result["triggered_alert"],
    )
    db.add(db_pred)
    await db.commit()
    await db.refresh(db_pred)

    # ── Step 5: Early Warning System (F3.2) ───────────────────────────────
    if pred_result["triggered_alert"]:
        cooldown_cutoff = datetime.utcnow() - timedelta(days=5)
        alert_res = await db.execute(
            select(Alert).where(
                Alert.aoi_id == aoi_id,
                Alert.created_at >= cooldown_cutoff,
            )
        )
        if not alert_res.scalars().first():
            new_alert = Alert(
                aoi_id=aoi_id,
                alert_type=AlertType.DROUGHT_RISK,
                triggering_prediction_id=db_pred.id,
                status=AlertStatus.OPEN,
                severity="high",
                message=(
                    f"Drought Risk Warning: Predicted yield is "
                    f"{abs(pred_result['yield_change_pct']):.1f}% below 5-year average. "
                    f"NDVI={mean_ndvi:.3f}, Rain={pred_result['input_snapshot_json'].get('rainfall_mm', '?')}mm."
                ),
                recommendation="Irrigate field within 48 hours to prevent compounding loss.",
            )
            db.add(new_alert)
            await db.commit()
            await db.refresh(new_alert)

            # SMS via Twilio if farmer opted in
            if current_user.sms_opt_in and current_user.phone:
                lang = (
                    current_user.language_pref.value
                    if hasattr(current_user.language_pref, "value")
                    else "en"
                )
                sms_text = notification_service.format_sms_message(
                    farmer_name=current_user.full_name,
                    aoi_name=aoi.name or f"Farm #{aoi_id}",
                    alert_type="Drought Warning",
                    recommendation="Irrigate field within 48 hours",
                    language=lang,
                )
                deliv = notification_service.send_sms(current_user.phone, sms_text)

                notif = Notification(
                    alert_id=new_alert.id,
                    user_id=current_user.id,
                    channel=NotificationChannel.SMS,
                    delivery_status=deliv["status"],
                    message_body=sms_text,
                    external_id=deliv.get("external_id"),
                    sent_at=deliv.get("sent_at"),
                )
                db.add(notif)
                await db.commit()

    return PredictionResponse.model_validate(db_pred)


@router.get("/{aoi_id}/predict/history", response_model=PredictionHistoryResponse)
async def get_prediction_history(
    aoi_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve prediction history with model versions and input snapshots.
    Used for Insurer audit verification and Admin performance tracking.
    """
    res = await db.execute(
        select(YieldPrediction)
        .where(YieldPrediction.aoi_id == aoi_id)
        .order_by(YieldPrediction.created_at.desc())
    )
    predictions = res.scalars().all()
    formatted = [PredictionResponse.model_validate(p) for p in predictions]
    return PredictionHistoryResponse(aoi_id=aoi_id, predictions=formatted, total=len(formatted))


@router.get("/{aoi_id}/ai-advisory")
async def get_ai_advisory(
    aoi_id: int,
    crop_type: Optional[str] = "cotton",
    lang: Optional[str] = "en",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate Google Gemini powered real-time agricultural action tasks
    using live Sentinel-2 NDVI/NDWI telemetry and OpenWeather data.
    """
    from app.services.gemini_service import gemini_service
    res = await db.execute(select(AOI).where(AOI.id == aoi_id))
    aoi = res.scalar_one_or_none()
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")

    mean_ndvi, mean_ndwi = await _get_latest_index_values(aoi_id, db)

    # Get real coordinates
    lat, lon = 19.8341, 75.8812
    try:
        from shapely.geometry import shape
        import shapely.wkt
        if aoi.geometry:
            geom_str = str(aoi.geometry).split(";")[-1].strip()
            geom_shape = shape(json.loads(geom_str)) if geom_str.startswith("{") else shapely.wkt.loads(geom_str)
            lat, lon = geom_shape.centroid.y, geom_shape.centroid.x
    except Exception:
        pass

    # Real OpenWeather data
    rain_mm, temp_c = ml_engine.fetch_live_weather(lat, lon)

    aoi_data = {
        "id": aoi.id,
        "name": aoi.name,
        "village": aoi.village or "Field",
        "taluk": aoi.taluk or aoi.district or "Jalna",
        "district": aoi.district or "Jalna",
        "state": aoi.state or "Maharashtra",
        "area_hectares": aoi.area_hectares or 2.5
    }

    tasks = await gemini_service.generate_realtime_actionable_tasks(
        aoi_data=aoi_data,
        crop_type=crop_type,
        ndvi=mean_ndvi,
        ndwi=mean_ndwi,
        temp_c=temp_c,
        rain_mm=rain_mm,
        lang=lang or "en"
    )

    return {
        "aoi_id": aoi_id,
        "crop_type": crop_type,
        "language": lang,
        "ndvi": mean_ndvi,
        "ndwi": mean_ndwi,
        "temp_c": temp_c,
        "rain_mm": rain_mm,
        "ai_engine": "Google Gemini 3.1 Flash",
        "tasks": tasks
    }


@router.post("/{aoi_id}/ask-ai")
async def ask_ai_assistant(
    aoi_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Interactive Gemini Agronomist Q&A for the farmer."""
    from app.services.gemini_service import gemini_service
    question = payload.get("question", "")
    crop_type = payload.get("crop_type", "cotton")
    lang = payload.get("language", "en")

    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    res = await db.execute(select(AOI).where(AOI.id == aoi_id))
    aoi = res.scalar_one_or_none()
    if not aoi:
        raise HTTPException(status_code=404, detail="AOI not found")

    mean_ndvi, _ = await _get_latest_index_values(aoi_id, db)

    lat, lon = 19.8341, 75.8812
    try:
        from shapely.geometry import shape
        import shapely.wkt
        if aoi.geometry:
            geom_str = str(aoi.geometry).split(";")[-1].strip()
            geom_shape = shape(json.loads(geom_str)) if geom_str.startswith("{") else shapely.wkt.loads(geom_str)
            lat, lon = geom_shape.centroid.y, geom_shape.centroid.x
    except Exception:
        pass

    rain_mm, temp_c = ml_engine.fetch_live_weather(lat, lon)

    aoi_data = {
        "name": aoi.name,
        "village": aoi.village or "Field",
        "district": aoi.district or "Jalna",
        "state": aoi.state or "Maharashtra"
    }

    answer = await gemini_service.ask_agronomist_assistant(
        question=question,
        aoi_data=aoi_data,
        crop_type=crop_type,
        ndvi=mean_ndvi,
        temp_c=temp_c,
        rain_mm=rain_mm,
        lang=lang
    )

    return {
        "aoi_id": aoi_id,
        "question": question,
        "answer": answer,
        "language": lang
    }
