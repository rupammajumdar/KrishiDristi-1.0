import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load env vars from project root .env
root_env = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=root_env)

# Try loading from backend .env if root .env didn't have it
if not os.getenv("GEE_SERVICE_ACCOUNT_EMAIL"):
    backend_env = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=backend_env)

email = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL")
key_path = os.getenv("GEE_PRIVATE_KEY_PATH")

print("GEE_SERVICE_ACCOUNT_EMAIL:", email)
print("GEE_PRIVATE_KEY_PATH:", key_path)

if not email or not key_path:
    print("Error: GEE environment variables not set!")
    sys.exit(1)

if not os.path.exists(key_path):
    print(f"Error: key file does not exist at {key_path}")
    sys.exit(1)

try:
    import ee
    print("Imported ee successfully.")
    
    print("Attempting to authenticate and initialize GEE...")
    credentials = ee.ServiceAccountCredentials(email, key_path)
    project_id = "helical-study-506221-s7"
    ee.Initialize(credentials=credentials, project=project_id)
    print("✅ GEE initialized successfully!")
    
    # Try running a simple query
    print("Running a simple GEE query...")
    # Geometry for a test region in India
    geom = ee.Geometry.Point([78.9629, 20.5937]).buffer(1000)
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate("2026-01-01", "2026-06-01")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    )
    count = collection.size().getInfo()
    print(f"✅ GEE query successful! Found {count} cloud-free Sentinel-2 images in India.")
except Exception as e:
    print("❌ Failed to query/initialize Earth Engine:", e)
