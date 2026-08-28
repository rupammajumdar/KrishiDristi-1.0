"""
Satellite Data Ingestion and Live Fetcher Utility.

Supports:
  1. Open STAC Search & Download (Planetary Computer / AWS Open Data)
     - Sentinel-2 L2A (10m - B02, B03, B04, B08, B11, B12, SCL)
     - Landsat 8/9 Collection 2 (30m - B2, B3, B4, B5, B6, B7, QA_PIXEL)
  2. Copernicus Data Space Ecosystem (CDSE) API (https://browser.dataspace.copernicus.eu)
  3. Google Earth Engine (GEE) Data Catalog Connector (MODIS / GIMMS NDVI / Sentinel-2)
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import requests

from src.config import load_config

CFG = load_config()


# ==============================================================================
# 1. Open STAC API (Planetary Computer / Earth Search STAC)
# ==============================================================================

STAC_ENDPOINTS = {
    "planetary_computer": "https://planetarycomputer.microsoft.com/api/stac/v1",
    "earth_search": "https://earth-search.aws.element84.com/v1",
}


def search_stac_scenes(
    bbox: List[float],
    start_date: str,
    end_date: str,
    collection: str = "sentinel-2-l2a",
    max_cloud_cover: float = 20.0,
    limit: int = 10,
    endpoint_key: str = "earth_search",
) -> List[Dict[str, Any]]:
    """Search for satellite scenes using standard STAC API.

    bbox: [west, south, east, north] in EPSG:4326
    start_date: 'YYYY-MM-DD'
    end_date: 'YYYY-MM-DD'
    """
    endpoint = STAC_ENDPOINTS.get(endpoint_key, STAC_ENDPOINTS["earth_search"])
    search_url = f"{endpoint}/search"

    payload = {
        "bbox": bbox,
        "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
        "collections": [collection],
        "limit": limit,
        "query": {
            "eo:cloud_cover": {"lt": max_cloud_cover}
        },
    }

    try:
        response = requests.post(search_url, json=payload, timeout=30)
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            print(f"[STAC] Found {len(features)} scenes from {endpoint_key} for {collection}")
            return features
        else:
            print(f"[STAC] Search query returned code {response.status_code}: {response.text[:200]}")
            return []
    except Exception as e:
        print(f"[STAC] Query failed: {e}")
        return []


# ==============================================================================
# 2. Copernicus Data Space Ecosystem (CDSE) Client
# ==============================================================================

class CopernicusDataSpaceClient:
    """Client for Copernicus Data Space Ecosystem (CDSE) / Copernicus Browser.

    Portal: https://browser.dataspace.copernicus.eu
    OData API: https://catalogue.dataspace.copernicus.eu/odata/v1
    Token Auth: https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
    """

    AUTH_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    ODATA_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or os.environ.get("CDSE_USERNAME")
        self.password = password or os.environ.get("CDSE_PASSWORD")
        self.token: Optional[str] = None

    def authenticate(self) -> bool:
        if not self.username or not self.password:
            print("[CDSE] Credentials not provided (set CDSE_USERNAME & CDSE_PASSWORD).")
            return False

        data = {
            "client_id": "cdse-public",
            "username": self.username,
            "password": self.password,
            "grant_type": "password",
        }
        try:
            res = requests.post(self.AUTH_URL, data=data, timeout=15)
            if res.status_code == 200:
                self.token = res.json().get("access_token")
                print("[CDSE] Authenticated successfully.")
                return True
            else:
                print(f"[CDSE] Authentication failed: {res.text}")
                return False
        except Exception as e:
            print(f"[CDSE] Auth request error: {e}")
            return False

    def search_sentinel2(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float = 20.0,
    ) -> List[Dict[str, Any]]:
        """Search Sentinel-2 L2A products on CDSE."""
        west, south, east, north = bbox
        poly_wkt = f"POLYGON(({west} {south},{east} {south},{east} {north},{west} {north},{west} {south}))"

        filter_str = (
            f"Collection/Name eq 'SENTINEL-2' and "
            f"Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') and "
            f"OData.CSC.Intersects(area=geography'SRID=4326;{poly_wkt}') and "
            f"ContentDate/Start gt {start_date}T00:00:00.000Z and "
            f"ContentDate/Start lt {end_date}T23:59:59.999Z and "
            f"Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/OData.CSC.DoubleAttribute/Value le {max_cloud_cover})"
        )

        params = {"$filter": filter_str, "$top": 20, "$orderby": "ContentDate/Start desc"}
        try:
            res = requests.get(self.ODATA_URL, params=params, timeout=30)
            if res.status_code == 200:
                results = res.json().get("value", [])
                print(f"[CDSE] Found {len(results)} Sentinel-2 products.")
                return results
            else:
                print(f"[CDSE] Search error {res.status_code}: {res.text[:200]}")
                return []
        except Exception as e:
            print(f"[CDSE] Search failed: {e}")
            return []


# ==============================================================================
# 3. Google Earth Engine (GEE) Data Catalog Connector
# ==============================================================================

def export_gee_ndvi_timeseries(
    bbox: List[float],
    start_date: str,
    end_date: str,
    dataset_type: str = "modis",
) -> Dict[str, Any]:
    """Demonstrates and provides GEE integration for MODIS / GIMMS / Sentinel-2 NDVI.

    Datasets:
      - MODIS NDVI (MOD13Q1 250m 16-Day NDVI) -> 'MODIS/061/MOD13Q1'
      - Sentinel-2 Harmonized Surface Reflectance -> 'COPERNICUS/S2_SR_HARMONIZED'
      - Landsat 8 Level 2 Surface Reflectance -> 'LANDSAT/LC08/C02/T1_L2'
      - GIMMS 3G Global NDVI (AVHRR) -> 'NASA/GIMMS/3GV1'
    """
    try:
        import ee

        try:
            ee.Initialize()
            print("[GEE] Google Earth Engine initialized successfully.")
        except Exception:
            print("[GEE] Earth Engine not authenticated. Run 'earthengine authenticate' in terminal.")
            return {"status": "unauthenticated"}

        geometry = ee.Geometry.Rectangle(bbox)

        if dataset_type.lower() == "modis":
            collection = (
                ee.ImageCollection("MODIS/061/MOD13Q1")
                .filterBounds(geometry)
                .filterDate(start_date, end_date)
                .select("NDVI")
            )
        elif dataset_type.lower() == "sentinel2":
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(geometry)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
                .select(["B4", "B8", "B3", "B2", "B11", "B12", "SCL"])
            )
        else:
            collection = (
                ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                .filterBounds(geometry)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt("CLOUD_COVER", 20))
            )

        count = collection.size().getInfo()
        print(f"[GEE] Found {count} images in {dataset_type} collection.")
        return {"status": "success", "count": count, "dataset": dataset_type}

    except ImportError:
        print("[GEE] 'earthengine-api' package not available or not configured.")
        return {"status": "not_installed"}
    except Exception as e:
        print(f"[GEE] Query error: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch or query satellite datasets")
    parser.add_argument("--source", choices=["stac", "cdse", "gee"], default="stac")
    parser.add_argument("--start", default="2023-01-01")
    parser.add_argument("--end", default="2023-12-31")
    parser.add_argument("--dataset", default="sentinel-2-l2a")
    args = parser.parse_args()

    aoi_bbox = CFG["data"]["aoi"]["bbox"]

    if args.source == "stac":
        search_stac_scenes(aoi_bbox, args.start, args.end, collection=args.dataset)
    elif args.source == "cdse":
        client = CopernicusDataSpaceClient()
        client.search_sentinel2(aoi_bbox, args.start, args.end)
    elif args.source == "gee":
        export_gee_ndvi_timeseries(aoi_bbox, args.start, args.end, args.dataset)
