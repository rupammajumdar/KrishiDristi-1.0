import httpx
import json

BASE = "http://127.0.0.1:8000"
c = httpx.Client(base_url=BASE, timeout=30)

# 1. Login
r = c.post("/api/auth/login", json={"email": "farmer@krishidristi.ai", "password": "farmer123"})
token = r.json()["access_token"]
h = {"Authorization": "Bearer " + token}

# 2. Create Plot 1 in Jalna, Maharashtra
plot1_data = {
    "name": "Jalna Test Plot",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[[75.8812, 19.8341], [75.8856, 19.8341], [75.8856, 19.8385], [75.8812, 19.8385], [75.8812, 19.8341]]]
    },
    "aoi_type": "farm",
    "crop_type": "cotton",
    "district": "Jalna",
    "state": "Maharashtra"
}
r1 = c.post("/api/aois", json=plot1_data, headers=h)
print("[1] Created Plot 1 (Jalna):", r1.status_code)
p1_id = r1.json()["id"]

# Predict for Plot 1
r1_pred = c.post(f"/api/aois/{p1_id}/predict", headers=h)
print("    Jalna Prediction:", r1_pred.status_code, "-> Yield:", r1_pred.json().get("predicted_yield_kg_ha"), "kg/ha")

# 3. Create Plot 2 in Raipur, Chhattisgarh
plot2_data = {
    "name": "Raipur Test Plot",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[[81.6214, 21.2446], [81.6250, 21.2446], [81.6250, 21.2480], [81.6214, 21.2480], [81.6214, 21.2446]]]
    },
    "aoi_type": "farm",
    "crop_type": "rice",
    "district": "Raipur",
    "state": "Chhattisgarh"
}
r2 = c.post("/api/aois", json=plot2_data, headers=h)
print("\n[2] Created Plot 2 (Raipur):", r2.status_code)
p2_id = r2.json()["id"]

# Predict for Plot 2
r2_pred = c.post(f"/api/aois/{p2_id}/predict", headers=h)
print("    Raipur Prediction:", r2_pred.status_code, "-> Yield:", r2_pred.json().get("predicted_yield_kg_ha"), "kg/ha")

# 4. Create Plot 3 in Ludhiana, Punjab
plot3_data = {
    "name": "Punjab Test Plot",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[[75.8573, 30.9010], [75.8620, 30.9010], [75.8620, 30.9050], [75.8573, 30.9050], [75.8573, 30.9010]]]
    },
    "aoi_type": "farm",
    "crop_type": "wheat",
    "district": "Ludhiana",
    "state": "Punjab"
}
r3 = c.post("/api/aois", json=plot3_data, headers=h)
print("\n[3] Created Plot 3 (Ludhiana):", r3.status_code)
p3_id = r3.json()["id"]

# Predict for Plot 3
r3_pred = c.post(f"/api/aois/{p3_id}/predict", headers=h)
print("    Punjab Prediction:", r3_pred.status_code, "-> Yield:", r3_pred.json().get("predicted_yield_kg_ha"), "kg/ha")

print("\n=== Location GEE Verification Complete ===")
