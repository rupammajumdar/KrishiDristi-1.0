"""
KrishiDrishti AI — SQLAlchemy ORM Models
All 8 core entities from PRD Section 7 with SQLite & PostGIS dual compatibility.
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum, ForeignKey,
    Text, Boolean, JSON, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    FARMER = "farmer"
    GOVERNMENT = "government"
    INSURER = "insurer"
    ADMIN = "admin"


class AOIType(str, enum.Enum):
    FARM = "farm"
    LAKE = "lake"
    ADMIN_BOUNDARY = "admin_boundary"


class IndexType(str, enum.Enum):
    NDVI = "NDVI"
    NDWI = "NDWI"


class StressClassification(str, enum.Enum):
    GREEN = "green"       # High Health (NDVI > 0.6)
    YELLOW = "yellow"     # Moderate Stress (0.3 - 0.6)
    RED = "red"           # Severe Stress (< 0.3)


class AlertType(str, enum.Enum):
    DROUGHT_RISK = "drought_risk"
    SEVERE_STRESS = "severe_stress"
    WATER_DEPLETION = "water_depletion"


class AlertStatus(str, enum.Enum):
    OPEN = "open"
    NOTIFIED = "notified"
    ACKNOWLEDGED = "acknowledged"


class NotificationChannel(str, enum.Enum):
    SMS = "sms"
    EMAIL = "email"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"


class SatelliteSource(str, enum.Enum):
    SENTINEL_2 = "sentinel_2"
    LANDSAT = "landsat"


class PersonaTemplate(str, enum.Enum):
    FARMER = "farmer"
    GOVERNMENT = "government"
    INSURER = "insurer"


class CropType(str, enum.Enum):
    COTTON = "cotton"
    RICE = "rice"
    WHEAT = "wheat"
    SUGARCANE = "sugarcane"
    SOYBEAN = "soybean"
    MAIZE = "maize"
    TUR = "tur"


class LanguageCode(str, enum.Enum):
    EN = "en"
    HI = "hi"
    KN = "kn"   # Kannada
    TE = "te"   # Telugu
    MR = "mr"   # Marathi


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    """
    PRD Entity: User
    Supports all 4 personas: farmer, government, insurer, admin.
    org_id links Farmers to an FPO (nullable).
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.FARMER)
    language_pref = Column(Enum(LanguageCode), nullable=False, default=LanguageCode.EN)
    org_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    sms_opt_in = Column(Boolean, default=True)
    email_opt_in = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aois = relationship("AOI", back_populates="owner", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="requested_by_user")


class AOI(Base):
    """
    PRD Entity: AOI (Area of Interest / Polygon)
    Stores drawn farm/lake polygons. Dual compatible with PostGIS and SQLite WKT text.
    """
    __tablename__ = "aois"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    geometry = Column(Text, nullable=False)  # WKT representation
    aoi_type = Column(Enum(AOIType), nullable=False, default=AOIType.FARM)
    crop_type = Column(Enum(CropType), nullable=True)
    area_hectares = Column(Float, nullable=True)
    district = Column(String(255), nullable=True)
    taluk = Column(String(255), nullable=True)
    village = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="aois")
    satellite_passes = relationship("SatellitePass", back_populates="aoi", cascade="all, delete-orphan")
    yield_predictions = relationship("YieldPrediction", back_populates="aoi", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="aoi", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="aoi")


class SatellitePass(Base):
    """
    PRD Entity: SatellitePass
    One row per successful imagery ingestion per AOI.
    """
    __tablename__ = "satellite_passes"

    id = Column(Integer, primary_key=True, index=True)
    aoi_id = Column(Integer, ForeignKey("aois.id"), nullable=False, index=True)
    scene_id = Column(String(255), nullable=False)
    acquisition_date = Column(DateTime, nullable=False, index=True)
    cloud_cover_pct = Column(Float, nullable=False)
    source = Column(Enum(SatelliteSource), nullable=False, default=SatelliteSource.SENTINEL_2)
    is_sufficient_coverage = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    aoi = relationship("AOI", back_populates="satellite_passes")
    index_results = relationship("IndexResult", back_populates="satellite_pass", cascade="all, delete-orphan")


class IndexResult(Base):
    """
    PRD Entity: IndexResult
    Stores computed NDVI/NDWI values per satellite pass.
    """
    __tablename__ = "index_results"

    id = Column(Integer, primary_key=True, index=True)
    pass_id = Column(Integer, ForeignKey("satellite_passes.id"), nullable=False, index=True)
    index_type = Column(Enum(IndexType), nullable=False)
    mean_value = Column(Float, nullable=False)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    std_dev = Column(Float, nullable=True)
    classification = Column(Enum(StressClassification), nullable=False)
    raster_uri = Column(String(512), nullable=True)
    pixel_counts = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    satellite_pass = relationship("SatellitePass", back_populates="index_results")


class YieldPrediction(Base):
    """
    PRD Entity: YieldPrediction
    ML model output with full audit trail.
    """
    __tablename__ = "yield_predictions"

    id = Column(Integer, primary_key=True, index=True)
    aoi_id = Column(Integer, ForeignKey("aois.id"), nullable=False, index=True)
    model_version = Column(String(50), nullable=False)
    predicted_yield_kg_ha = Column(Float, nullable=False)
    confidence_lower = Column(Float, nullable=True)
    confidence_upper = Column(Float, nullable=True)
    yield_change_pct = Column(Float, nullable=True)
    input_snapshot_json = Column(JSON, nullable=False)
    feature_importance = Column(JSON, nullable=True)
    crop_type = Column(Enum(CropType), nullable=True)
    triggered_alert = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    aoi = relationship("AOI", back_populates="yield_predictions")
    alerts = relationship("Alert", back_populates="triggering_prediction")


class Alert(Base):
    """
    PRD Entity: Alert
    Early Warning System alerts with status tracking.
    """
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    aoi_id = Column(Integer, ForeignKey("aois.id"), nullable=False, index=True)
    alert_type = Column(Enum(AlertType), nullable=False)
    triggering_prediction_id = Column(Integer, ForeignKey("yield_predictions.id"), nullable=True)
    status = Column(Enum(AlertStatus), nullable=False, default=AlertStatus.OPEN)
    severity = Column(String(20), nullable=True)
    message = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    # Relationships
    aoi = relationship("AOI", back_populates="alerts")
    triggering_prediction = relationship("YieldPrediction", back_populates="alerts")
    notifications = relationship("Notification", back_populates="alert", cascade="all, delete-orphan")


class Notification(Base):
    """
    PRD Entity: Notification
    SMS/Email delivery tracking.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel = Column(Enum(NotificationChannel), nullable=False)
    delivery_status = Column(Enum(DeliveryStatus), nullable=False, default=DeliveryStatus.PENDING)
    message_body = Column(Text, nullable=True)
    external_id = Column(String(255), nullable=True)
    retry_count = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    alert = relationship("Alert", back_populates="notifications")
    user = relationship("User")


class Report(Base):
    """
    PRD Entity: Report
    Generated PDF reports.
    """
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    aoi_id = Column(Integer, ForeignKey("aois.id"), nullable=False, index=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    persona_template = Column(Enum(PersonaTemplate), nullable=False)
    file_uri = Column(String(512), nullable=True)
    report_title = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")
    generated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    aoi = relationship("AOI", back_populates="reports")
    requested_by_user = relationship("User", back_populates="reports")


# ─── Configuration Tables ────────────────────────────────────────────────────

class CropConfig(Base):
    __tablename__ = "crop_configs"

    id = Column(Integer, primary_key=True, index=True)
    crop_type = Column(Enum(CropType), nullable=False, unique=True)
    ndvi_green_threshold = Column(Float, default=0.6)
    ndvi_yellow_threshold = Column(Float, default=0.3)
    avg_yield_kg_ha = Column(Float, nullable=True)
    early_warning_threshold_pct = Column(Float, default=20.0)
    growing_season_start_month = Column(Integer, nullable=True)
    growing_season_end_month = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MLModelVersion(Base):
    __tablename__ = "ml_model_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, nullable=False)
    crop_type = Column(Enum(CropType), nullable=True)
    model_path = Column(String(512), nullable=False)
    training_date = Column(DateTime, nullable=False)
    dataset_version = Column(String(100), nullable=True)
    validation_mape = Column(Float, nullable=True)
    validation_r2 = Column(Float, nullable=True)
    is_active = Column(Boolean, default=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PipelineJob(Base):
    __tablename__ = "pipeline_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String(50), nullable=False)
    aoi_id = Column(Integer, ForeignKey("aois.id"), nullable=True)
    status = Column(String(20), default="queued")
    celery_task_id = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
