import httpx
import json

BASE = "http://127.0.0.1:8000"
c = httpx.Client(base_url=BASE, timeout=30)

# 1. Health
r = c.get("/health")
print("[1] Health:", r.status_code, "->", r.json())

# 2. Login
r = c.post("/api/auth/login", json={"email": "farmer@krishidristi.ai", "password": "farmer123"})
print("[2] Login:", r.status_code)
token = r.json()["access_token"]
user = r.json()["user"]
print("    User:", user["full_name"], "role=" + user["role"], "id=" + str(user["id"]))
h = {"Authorization": "Bearer " + token}

# 3. AOIs
r = c.get("/api/aois", headers=h)
data = r.json()
aois = data.get("aois", data) if isinstance(data, dict) else data
print("[3] AOIs:", r.status_code, "->", len(aois), "AOIs")
for a in aois[:3]:
    print("    -", a["id"], a["name"], "|", a.get("crop_type"), "|", a.get("area_hectares"), "Ha")

# 4. Prediction
aoi_id = aois[0]["id"]
r = c.post("/api/aois/" + str(aoi_id) + "/predict", headers=h)
print("[4] Prediction AOI#" + str(aoi_id) + ":", r.status_code)
if r.status_code == 200:
    p = r.json()
    print("    Yield:", p.get("predicted_yield_kg_ha"), "kg/ha")
    print("    Change:", p.get("yield_change_pct"), "%")
    print("    Confidence:", p.get("confidence_lower"), "-", p.get("confidence_upper"))
    print("    Features:", p.get("feature_importance", {}))
    print("    All keys:", list(p.keys()))
else:
    print("    ERROR:", r.text[:300])

# 5. Timeline
r = c.get("/api/aois/" + str(aoi_id) + "/timeline", headers=h)
print("[5] Timeline AOI#" + str(aoi_id) + ":", r.status_code)
if r.status_code == 200:
    td = r.json()
    print("    Keys:", list(td.keys()))
    print("    Total:", td.get("total", "N/A"))

# 6. Alerts
r = c.get("/api/alerts", headers=h)
print("[6] Alerts:", r.status_code)
if r.status_code == 200:
    ad = r.json()
    if isinstance(ad, dict):
        alerts = ad.get("alerts", [])
        print("    Keys:", list(ad.keys()))
    else:
        alerts = ad
    for a in (alerts[:2] if isinstance(alerts, list) else []):
        print("    -", a.get("alert_type"), "|", a.get("severity"), "|", str(a.get("message", ""))[:80])

# 7. District Summary
r = c.get("/api/districts/Jalna/summary", headers=h)
print("[7] District Jalna:", r.status_code)
if r.status_code == 200:
    ds = r.json()
    print("    Keys:", list(ds.keys())[:10])
    w = ds.get("weather", ds.get("current_weather", {}))
    if w:
        print("    Weather:", json.dumps(w, indent=2)[:300])

print("=== DONE ===")
