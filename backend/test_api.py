"""
Quick API integration test — login, fetch AOIs, test satellite + prediction endpoints.
"""
import httpx
import json

BASE = "http://127.0.0.1:8000"

def main():
    c = httpx.Client(base_url=BASE, timeout=30)

    # 1. Health
    r = c.get("/health")
    print(f"[1] Health: {r.status_code} -> {r.json()}")

    # 2. Login as farmer
    r = c.post("/api/auth/login", json={"email": "farmer@krishidristi.ai", "password": "farmer123"})
    print(f"\n[2] Login: {r.status_code}")
    if r.status_code != 200:
        print("    FAILED:", r.text[:300])
        return
    token = r.json()["access_token"]
    user = r.json()["user"]
    print(f"    User: {user['full_name']} (role={user['role']}, id={user['id']})")
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get AOIs
    r = c.get("/api/aois", headers=headers)
    print(f"\n[3] AOIs: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        aois = data.get("aois", data) if isinstance(data, dict) else data
        print(f"    Found {len(aois)} AOIs")
        for aoi in aois[:5]:  # Show first 5
            print(f"    - [{aoi.get('id')}] {aoi.get('name')} | {aoi.get('crop_type')} | {aoi.get('area_hectares')} Ha | {aoi.get('district')}, {aoi.get('state')}")
    else:
        print("    FAILED:", r.text[:300])

    # 4. Get prediction for first AOI
    if r.status_code == 200 and aois:
        aoi_id = aois[0]["id"]
        
        # Prediction
        r2 = c.post(f"/api/aois/{aoi_id}/predict", headers=headers)
        print(f"\n[4] Prediction for AOI #{aoi_id}: {r2.status_code}")
        if r2.status_code == 200:
            pred = r2.json()
            print(f"    Yield: {pred.get('predicted_yield_kg_ha')} kg/ha")
            print(f"    Confidence: [{pred.get('confidence_lower')}, {pred.get('confidence_upper')}]")
            print(f"    Change: {pred.get('yield_change_pct')}%")
            print(f"    NDVI mean: {pred.get('ndvi_mean')}")
            print(f"    NDWI mean: {pred.get('ndwi_mean')}")
            print(f"    Data source: {pred.get('data_source', 'N/A')}")
            feat = pred.get("feature_importance", {})
            if feat:
                print(f"    Feature importances: {json.dumps(feat, indent=6)}")
        else:
            print("    Response:", r2.text[:500])

        # Timeline
        r3 = c.get(f"/api/aois/{aoi_id}/timeline", headers=headers)
        print(f"\n[5] Timeline for AOI #{aoi_id}: {r3.status_code}")
        if r3.status_code == 200:
            timeline_data = r3.json()
            if isinstance(timeline_data, dict):
                timeline = timeline_data.get("dates", timeline_data.get("passes", timeline_data.get("timeline", [])))
                print(f"    Timeline keys: {list(timeline_data.keys())[:8]}")
                print(f"    Total: {timeline_data.get('total', 'N/A')}")
                if isinstance(timeline, list):
                    print(f"    {len(timeline)} entries in timeline")
                    for t in timeline[:3]:
                        if isinstance(t, dict):
                            print(f"    - {t}")
                        else:
                            print(f"    - {t}")
                else:
                    print(f"    Timeline response (first 500 chars): {repr(str(timeline_data))[:500]}")
            else:
                print(f"    Timeline items: {len(timeline_data)}")
        else:
            print("    Response:", r3.text[:300])

        # Alerts
        r4 = c.get("/api/alerts", headers=headers)
        print(f"\n[6] Alerts: {r4.status_code}")
        if r4.status_code == 200:
            alerts_data = r4.json()
            if isinstance(alerts_data, dict):
                alerts = alerts_data.get("alerts", [])
                print(f"    Alert keys: {list(alerts_data.keys())[:8]}")
            else:
                alerts = alerts_data
            print(f"    {len(alerts)} alerts")
            for a in (alerts[:3] if isinstance(alerts, list) else []):
                print(f"    - [{a.get('alert_type')}] {a.get('severity')} | {a.get('message', '')[:80]}")
        else:
            print("    Response:", r4.text[:300])

    # 5. District summary
    r5 = c.get("/api/districts/Jalna/summary", headers=headers)
    print(f"\n[7] District Summary (Jalna): {r5.status_code}")
    if r5.status_code == 200:
        ds = r5.json()
        print(f"    Keys: {list(ds.keys())[:10]}")
        print(f"    District: {ds.get('district_name', ds.get('district', 'N/A'))}")
        print(f"    Total farms: {ds.get('total_farms', ds.get('total_aois', 'N/A'))}")
        print(f"    Avg NDVI: {ds.get('avg_ndvi', 'N/A')}")
        weather = ds.get('weather', ds.get('current_weather', {}))
        if weather:
            print(f"    Weather: {json.dumps(weather, indent=6)}")
        else:
            print(f"    Full response (500 chars): {repr(str(ds))[:500]}")
    else:
        print("    Response:", r5.text[:300])

    # 6. Test GEE connectivity directly
    print("\n[8] Testing Google Earth Engine connectivity...")
    try:
        import ee
        import os
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        
        email = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL", "").strip()
        key_path = os.getenv("GEE_PRIVATE_KEY_PATH", "").strip()
        
        if email and key_path:
            credentials = ee.ServiceAccountCredentials(email, key_path)
            ee.Initialize(credentials=credentials, project="helical-study-506221-s7")
            
            # Test: simple NDVI query for Jalna area
            geom = ee.Geometry.Rectangle([75.88, 19.83, 75.89, 19.84])
            col = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(geom)
                .filterDate("2026-01-01", "2026-08-01")
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            )
            count = col.size().getInfo()
            print(f"    GEE: Found {count} cloud-free Sentinel-2 scenes for Jalna")
            
            if count > 0:
                img = col.median()
                ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
                stats = ndvi.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=geom,
                    scale=10,
                    maxPixels=1e9
                ).getInfo()
                print(f"    GEE NDVI mean: {stats.get('NDVI', 'N/A')}")
        else:
            print("    GEE credentials not configured")
    except Exception as e:
        print(f"    GEE Error: {e}")

    print("\n=== API Integration Test Complete ===")

if __name__ == "__main__":
    main()
