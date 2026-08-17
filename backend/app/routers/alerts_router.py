"""
KrishiDrishti AI — Early Warning Alerts & Notifications Router
GET /api/alerts, POST /api/alerts/{alert_id}/acknowledge
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Alert, AlertStatus, AOI
from app.schemas import AlertResponse, AlertListResponse
from app.auth import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["Alerts & Notifications"])


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    aoi_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch active & historical alert feed (F4.3 requirement).
    Shows last 90 days of alerts per AOI with deep-link date/map reference.
    """
    query = select(Alert).join(AOI, Alert.aoi_id == AOI.id)
    
    if aoi_id:
        query = query.where(Alert.aoi_id == aoi_id)
    elif current_user.role.value == "farmer":
        query = query.where(AOI.owner_id == current_user.id)

    query = query.order_by(Alert.created_at.desc()).limit(50)
    res = await db.execute(query)
    alerts = res.scalars().all()

    formatted = [AlertResponse.model_validate(a) for a in alerts]
    return AlertListResponse(alerts=formatted, total=len(formatted))


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Acknowledge an alert (updates status from open/notified -> acknowledged)."""
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_at = datetime.utcnow()
    await db.commit()
    await db.refresh(alert)

    return AlertResponse.model_validate(alert)
