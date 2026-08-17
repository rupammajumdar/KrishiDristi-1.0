"""
KrishiDrishti AI — Database Seeder Script
Populates demonstration data: users, AOIs, satellite passes, index results,
yield predictions, alerts, and model versions.
"""

import asyncio
import sys
from datetime import datetime, timedelta
from sqlalchemy import select, text
from app.database import engine, AsyncSessionLocal, Base
from app.models import (
    User, UserRole, LanguageCode, AOI, AOIType, CropType,
    SatellitePass, IndexResult, IndexType, StressClassification,
    YieldPrediction, Alert, AlertType, AlertStatus, Notification,
    NotificationChannel, DeliveryStatus, Report, PersonaTemplate,
    CropConfig, MLModelVersion, PipelineJob
)
from app.auth import hash_password


async def seed_database():
    """Seed sample data for immediate standalone demonstration."""
    print("[Seed] Initializing Database tables and seeding data...")

    async with engine.begin() as conn:
        try:
            # Enable PostGIS extension if PostgreSQL
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        except Exception:
            pass  # SQLite fallback
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if users already exist
        res = await session.execute(select(User))
        if res.scalars().first():
            print("[Seed] Database already seeded.")
            return

        print("[Seed] Creating demo users for 4 personas...")
        # 1. Farmer Ramesh
        farmer = User(
            email="farmer@krishidristi.ai",
            hashed_password=hash_password("farmer123"),
            full_name="Ramesh Patil",
            phone="+919876543210",
            role=UserRole.FARMER,
            language_pref=LanguageCode.HI,
            sms_opt_in=True,
            org_id=101
        )
        # 2. Government Officer Anita
        officer = User(
            email="officer@krishidristi.ai",
            hashed_password=hash_password("officer123"),
            full_name="Anita Deshmukh",
            phone="+919876543211",
            role=UserRole.GOVERNMENT,
            language_pref=LanguageCode.EN,
            org_id=None
        )
        # 3. Insurer Claims Agent
        insurer = User(
            email="insurer@krishidristi.ai",
            hashed_password=hash_password("insurer123"),
            full_name="Vikram Seth (Insurer Claims)",
            phone="+919876543212",
            role=UserRole.INSURER,
            language_pref=LanguageCode.EN,
            org_id=None
        )
        # 4. Platform Admin
        admin = User(
            email="admin@krishidristi.ai",
            hashed_password=hash_password("admin123"),
            full_name="System Administrator",
            phone="+919876543213",
            role=UserRole.ADMIN,
            language_pref=LanguageCode.EN,
            org_id=None
        )

        session.add_all([farmer, officer, insurer, admin])
        await session.commit()
        await session.refresh(farmer)
        await session.refresh(officer)
        await session.refresh(insurer)
        await session.refresh(admin)

        print("[Seed] Creating Crop Configurations & ML Model Registry...")
        crop_cotton = CropConfig(
            crop_type=CropType.COTTON,
            ndvi_green_threshold=0.6,
            ndvi_yellow_threshold=0.3,
            avg_yield_kg_ha=2200.0,
            early_warning_threshold_pct=20.0
        )
        session.add(crop_cotton)

        model_cotton = MLModelVersion(
            version="v1.2.0-rf-cotton",
            crop_type=CropType.COTTON,
            model_path="/models/v1.2.0-rf-cotton.pkl",
            training_date=datetime.utcnow() - timedelta(days=30),
            dataset_version="Sentinel2_Jalna_2025_v2",
            validation_mape=11.4,
            validation_r2=0.89,
            is_active=True
        )
        session.add(model_cotton)
        await session.commit()

        print("[Seed] Creating sample AOIs in Jalna district...")
        wkt_farm = "POLYGON((75.8812 19.8341, 75.8856 19.8341, 75.8856 19.8385, 75.8812 19.8385, 75.8812 19.8341))"
        aoi_farm = AOI(
            owner_id=farmer.id,
            name="Ramesh 5-Acre Cotton Plot",
            geometry=f"SRID=4326;{wkt_farm}",
            aoi_type=AOIType.FARM,
            crop_type=CropType.COTTON,
            area_hectares=2.02,
            district="Jalna",
            taluk="Jalna",
            village="Mantha",
            state="Maharashtra"
        )
        
        wkt_lake = "POLYGON((75.8950 19.8450, 75.9050 19.8450, 75.9050 19.8550, 75.8950 19.8550, 75.8950 19.8450))"
        aoi_lake = AOI(
            owner_id=officer.id,
            name="Ghanewadi Reservoir Lake",
            geometry=f"SRID=4326;{wkt_lake}",
            aoi_type=AOIType.LAKE,
            crop_type=None,
            area_hectares=112.5,
            district="Jalna",
            taluk="Jalna",
            village="Ghanewadi",
            state="Maharashtra"
        )

        session.add_all([aoi_farm, aoi_lake])
        await session.commit()
        await session.refresh(aoi_farm)
        await session.refresh(aoi_lake)

        print("[Seed] Ingesting historical Satellite Passes & Index Results...")
        now = datetime.utcnow()
        dates = [now - timedelta(days=20), now - timedelta(days=15), now - timedelta(days=10), now - timedelta(days=5)]
        
        for i, p_date in enumerate(dates):
            sp = SatellitePass(
                aoi_id=aoi_farm.id,
                scene_id=f"S2A_MSIL2A_{p_date.strftime('%Y%m%d')}T051511",
                acquisition_date=p_date,
                cloud_cover_pct=round(2.1 + i * 1.5, 1),
                is_sufficient_coverage=True
            )
            session.add(sp)
            await session.commit()
            await session.refresh(sp)

            mean_val = round(0.68 - i * 0.08, 3)
            idx_res = IndexResult(
                pass_id=sp.id,
                index_type=IndexType.NDVI,
                mean_value=mean_val,
                min_value=round(mean_val - 0.2, 2),
                max_value=round(mean_val + 0.2, 2),
                std_dev=0.08,
                classification=StressClassification.GREEN if mean_val >= 0.6 else (StressClassification.YELLOW if mean_val >= 0.3 else StressClassification.RED),
                raster_uri=f"/static/rasters/ndvi_aoi_{aoi_farm.id}_pass_{sp.id}.png",
                pixel_counts={"green": int(1000 * (mean_val / 0.8)), "yellow": int(500 * (1 - mean_val)), "red": 100}
            )
            session.add(idx_res)
            await session.commit()

        print("[Seed] Creating Yield Predictions & Early Warning Alerts...")
        yp = YieldPrediction(
            aoi_id=aoi_farm.id,
            model_version="v1.2.0-rf-cotton",
            predicted_yield_kg_ha=1720.0,
            confidence_lower=1510.0,
            confidence_upper=1930.0,
            yield_change_pct=-21.8,
            crop_type=CropType.COTTON,
            input_snapshot_json={
                "mean_ndvi": 0.44,
                "mean_ndwi": -0.15,
                "rainfall_mm": 360.0,
                "temp_avg_c": 29.5,
                "timestamp": now.isoformat()
            },
            feature_importance={
                "NDVI (Vegetation Index)": 0.45,
                "Seasonal Rainfall (mm)": 0.28,
                "NDWI (Water Balance)": 0.17,
                "Avg Temperature (°C)": 0.10
            },
            triggered_alert=True
        )
        session.add(yp)
        await session.commit()
        await session.refresh(yp)

        alert = Alert(
            aoi_id=aoi_farm.id,
            alert_type=AlertType.DROUGHT_RISK,
            triggering_prediction_id=yp.id,
            status=AlertStatus.OPEN,
            severity="high",
            message="Drought Warning: Cotton yield predicted 21.8% below 5-year average.",
            recommendation="Irrigate field within 48 hours to prevent severe yield damage."
        )
        session.add(alert)
        await session.commit()

        print("[Seed] Database Seeding Complete successfully!")


if __name__ == "__main__":
    asyncio.run(seed_database())
