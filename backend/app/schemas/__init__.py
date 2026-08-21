"""
KrishiDrishti AI — Pydantic Schemas
Request/Response models for the API layer.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserRoleEnum(str, Enum):
    FARMER = "farmer"
    GOVERNMENT = "government"
    INSURER = "insurer"
    ADMIN = "admin"


class LanguageCodeEnum(str, Enum):
    EN = "en"
    HI = "hi"
    KN = "kn"
    TE = "te"
    MR = "mr"


class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")
    full_name: str = Field(..., min_length=2, description="Full name")
    phone: Optional[str] = Field(None, description="Phone number for SMS alerts")
    role: UserRoleEnum = Field(UserRoleEnum.FARMER, description="User role")
    language_pref: LanguageCodeEnum = Field(LanguageCodeEnum.EN, description="Preferred language")
    org_id: Optional[int] = Field(None, description="FPO organization ID")


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRoleEnum
    language_pref: LanguageCodeEnum
    org_id: Optional[int]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    language_pref: Optional[LanguageCodeEnum] = None
    sms_opt_in: Optional[bool] = None
    email_opt_in: Optional[bool] = None


# ─── AOI Schemas ──────────────────────────────────────────────────────────────

class AOITypeEnum(str, Enum):
    FARM = "farm"
    LAKE = "lake"
    ADMIN_BOUNDARY = "admin_boundary"


class CropTypeEnum(str, Enum):
    COTTON = "cotton"
    RICE = "rice"
    WHEAT = "wheat"
    SUGARCANE = "sugarcane"
    SOYBEAN = "soybean"
    MAIZE = "maize"
    TUR = "tur"


class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v != "Polygon":
            raise ValueError("Geometry type must be 'Polygon'")
        return v

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v):
        if not v or not v[0] or len(v[0]) < 4:
            raise ValueError("Polygon must have at least 4 coordinate pairs (closed ring)")
        # Verify the ring is closed
        if v[0][0] != v[0][-1]:
            raise ValueError("Polygon ring must be closed (first point == last point)")
        return v


class AOICreate(BaseModel):
    name: Optional[str] = Field(None, description="Name for this AOI")
    geometry: GeoJSONPolygon = Field(..., description="GeoJSON Polygon geometry")
    aoi_type: AOITypeEnum = Field(AOITypeEnum.FARM, description="Type of AOI")
    crop_type: Optional[CropTypeEnum] = Field(None, description="Crop type (for farms)")
    district: Optional[str] = None
    taluk: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None


class AOIUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Updated name")
    crop_type: Optional[CropTypeEnum] = Field(None, description="Updated crop type")
    is_active: Optional[bool] = Field(None, description="Active status")
    district: Optional[str] = None
    taluk: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None


class AOIResponse(BaseModel):
    id: int
    owner_id: int
    name: Optional[str]
    geometry: Dict[str, Any]  # GeoJSON representation
    aoi_type: AOITypeEnum
    crop_type: Optional[CropTypeEnum]
    area_hectares: Optional[float]
    district: Optional[str]
    taluk: Optional[str]
    village: Optional[str]
    state: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AOIListResponse(BaseModel):
    aois: List[AOIResponse]
    total: int


# ─── Timeline / Satellite Pass Schemas ────────────────────────────────────────

class TimelineEntry(BaseModel):
    id: int
    acquisition_date: datetime
    cloud_cover_pct: float
    source: str
    is_sufficient_coverage: bool
    has_ndvi: bool = False
    has_ndwi: bool = False


class TimelineResponse(BaseModel):
    aoi_id: int
    dates: List[TimelineEntry]
    total: int


# ─── Index Result Schemas ─────────────────────────────────────────────────────

class IndexTypeEnum(str, Enum):
    NDVI = "NDVI"
    NDWI = "NDWI"
    NDMI = "NDMI"


class IndexResultResponse(BaseModel):
    id: int
    index_type: str
    acquisition_date: datetime
    mean_value: float
    min_value: Optional[float]
    max_value: Optional[float]
    std_dev: Optional[float]
    classification: str
    raster_uri: Optional[str]
    pixel_counts: Optional[Dict[str, int]]
    anomaly: Optional[Dict[str, Any]] = None
    clear_sky_passes_count: Optional[int] = 8
    confidence_rating: Optional[str] = "High Rigor (SCL Cloud Masked)"
    causal_explanation: Optional[str] = None
    surface_area_ha: Optional[float] = None
    depletion_pct: Optional[float] = None

    class Config:
        from_attributes = True



# ─── Yield Prediction Schemas ────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    force_recompute: bool = Field(False, description="Force new prediction even if cached")
    crop_type: Optional[CropTypeEnum] = Field(None, description="Override or specified crop type")


class PredictionResponse(BaseModel):
    id: int
    aoi_id: int
    model_version: str
    predicted_yield_kg_ha: float
    confidence_lower: Optional[float]
    confidence_upper: Optional[float]
    yield_change_pct: Optional[float]
    crop_type: Optional[CropTypeEnum]
    feature_importance: Optional[Dict[str, float]]
    input_snapshot_json: Dict[str, Any]
    triggered_alert: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PredictionHistoryResponse(BaseModel):
    aoi_id: int
    predictions: List[PredictionResponse]
    total: int


# ─── Alert Schemas ───────────────────────────────────────────────────────────

class AlertTypeEnum(str, Enum):
    DROUGHT_RISK = "drought_risk"
    SEVERE_STRESS = "severe_stress"
    WATER_DEPLETION = "water_depletion"


class AlertResponse(BaseModel):
    id: int
    aoi_id: int
    alert_type: AlertTypeEnum
    status: str
    severity: Optional[str]
    message: Optional[str]
    recommendation: Optional[str]
    created_at: datetime
    acknowledged_at: Optional[datetime]

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    alerts: List[AlertResponse]
    total: int


# ─── Report Schemas ──────────────────────────────────────────────────────────

class PersonaTemplateEnum(str, Enum):
    FARMER = "farmer"
    GOVERNMENT = "government"
    INSURER = "insurer"


class ReportRequest(BaseModel):
    aoi_id: int = Field(..., description="AOI to generate report for")
    persona_template: PersonaTemplateEnum = Field(..., description="Report template type")
    title: Optional[str] = Field(None, description="Custom report title")
    crop_type: Optional[str] = Field(None, description="Selected crop type")
    language: Optional[str] = Field("en", description="Language preference")


class ReportResponse(BaseModel):
    id: int
    aoi_id: int
    persona_template: PersonaTemplateEnum
    file_uri: Optional[str]
    report_title: Optional[str]
    status: str
    generated_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── District Summary Schemas ────────────────────────────────────────────────

class DistrictSummaryResponse(BaseModel):
    district: str
    state: Optional[str]
    total_plots: int
    green_count: int
    yellow_count: int
    red_count: int
    avg_ndvi: Optional[float]
    total_water_bodies: int
    avg_water_depletion_pct: Optional[float]
    active_alerts: int
    last_updated: Optional[datetime]


class TalukDrilldown(BaseModel):
    taluk: str
    total_plots: int
    green_count: int
    yellow_count: int
    red_count: int
    avg_ndvi: Optional[float]
    water_bodies: int


class DistrictDetailResponse(BaseModel):
    district: str
    summary: DistrictSummaryResponse
    taluks: List[TalukDrilldown]


# ─── Admin Schemas ───────────────────────────────────────────────────────────

class PipelineStatusResponse(BaseModel):
    total_jobs: int
    queued: int
    running: int
    completed: int
    failed: int
    queue_depth: int
    recent_jobs: List[Dict[str, Any]]


class MLModelVersionResponse(BaseModel):
    id: int
    version: str
    crop_type: Optional[CropTypeEnum]
    training_date: datetime
    validation_mape: Optional[float]
    validation_r2: Optional[float]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ModelRollbackRequest(BaseModel):
    target_version: str = Field(..., description="Model version to roll back to")


# Forward reference resolution
TokenResponse.model_rebuild()
