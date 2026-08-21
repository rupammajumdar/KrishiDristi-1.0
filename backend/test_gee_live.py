import sys
import os
from pathlib import Path
from dotenv import load_dotenv

root_env = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=root_env)

from app.services.satellite import satellite_engine

# Location 1: Jalna, Maharashtra (cotton farm)
geom_jalna = {
    "type": "Polygon",
    "coordinates": [[[75.8812, 19.8341], [75.8856, 19.8341], [75.8856, 19.8385], [75.8812, 19.8385], [75.8812, 19.8341]]]
}

# Location 2: Raipur, Chhattisgarh (paddy/rice field)
geom_raipur = {
    "type": "Polygon",
    "coordinates": [[[81.6214, 21.2446], [81.6250, 21.2446], [81.6250, 21.2480], [81.6214, 21.2480], [81.6214, 21.2446]]]
}

# Location 3: Ludhiana, Punjab (wheat field)
geom_punjab = {
    "type": "Polygon",
    "coordinates": [[[75.8573, 30.9010], [75.8620, 30.9010], [75.8620, 30.9050], [75.8573, 30.9050], [75.8573, 30.9010]]]
}

print("=== Testing Google Earth Engine Live Integration ===")

print("\n1. Testing Jalna, Maharashtra:")
res1 = satellite_engine.process_ndvi_raster(cloud_cover_pct=5.0, geojson_geom=geom_jalna)
print("   NDVI Result:", res1)

print("\n2. Testing Raipur, Chhattisgarh:")
res2 = satellite_engine.process_ndvi_raster(cloud_cover_pct=5.0, geojson_geom=geom_raipur)
print("   NDVI Result:", res2)

print("\n3. Testing Ludhiana, Punjab:")
res3 = satellite_engine.process_ndvi_raster(cloud_cover_pct=5.0, geojson_geom=geom_punjab)
print("   NDVI Result:", res3)
