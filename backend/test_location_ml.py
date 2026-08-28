import asyncio
from app.services.ml_engine import ml_engine

def main():
    print("Testing ML Suite with Multi-Location Geo-Calibration:")
    locations = [
        {"lat": 19.8341, "lon": 75.8812, "district": "Jalna", "state": "Maharashtra", "crop": "cotton"},
        {"lat": 21.1458, "lon": 79.0882, "district": "Nagpur", "state": "Maharashtra", "crop": "soybean"},
        {"lat": 21.2514, "lon": 81.6296, "district": "Raipur", "state": "Chhattisgarh", "crop": "rice"},
        {"lat": 30.9010, "lon": 75.8573, "district": "Ludhiana", "state": "Punjab", "crop": "wheat"},
    ]
    for loc in locations:
        res = ml_engine.predict_yield(
            mean_ndvi=0.52,
            mean_ndwi=-0.10,
            crop_type=loc["crop"],
            lat=loc["lat"],
            lon=loc["lon"],
            district=loc["district"],
            state=loc["state"]
        )
        print(f"\n--- Location: {loc['district']}, {loc['state']} [{loc['crop'].upper()}] ---")
        print(f"  Predicted Yield: {res['predicted_yield_kg_ha']} kg/ha ({res['yield_change_pct']}%)")
        print(f"  Confidence Interval: [{res['confidence_lower']} - {res['confidence_upper']}] kg/ha")
        print(f"  Random Forest Stress: {res['ml_stress_classification']['stress_label']}")
        print(f"  LSTM Anomaly Score: {res['ml_anomaly']['anomaly_score']} ({res['ml_anomaly']['status_text']})")
        print(f"  Agro-Climatic Zone: {res['location_context']['agro_zone']}")
        print(f"  Soil Type: {res['location_context']['soil_type']}")
        print(f"  Active Checkpoints: {res['ml_models_used']}")

if __name__ == "__main__":
    main()
