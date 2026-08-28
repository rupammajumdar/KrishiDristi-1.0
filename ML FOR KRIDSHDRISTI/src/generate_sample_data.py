"""
Realistic Multi-Temporal Satellite Dataset Synthesizer.

Generates realistic multi-temporal 6-band Sentinel-2 & Landsat GeoTIFF tiles with:
  - Kharif & Rabi Indian agricultural phenology cycles (NDVI evolution)
  - Seasonal water reservoir & river extent dynamics (monsoon filling vs summer drying)
  - Agricultural drought & pest stress injection for anomaly detection
  - Ground-truth water masks and vegetation stress classification labels

Output structure:
  data/raw/
    S2_{YYYYMMDD}_B02.tif  (Blue)
    S2_{YYYYMMDD}_B03.tif  (Green)
    S2_{YYYYMMDD}_B04.tif  (Red)
    S2_{YYYYMMDD}_B08.tif  (NIR)
    S2_{YYYYMMDD}_B11.tif  (SWIR1)
    S2_{YYYYMMDD}_B12.tif  (SWIR2)
    S2_{YYYYMMDD}_SCL.tif  (Scene Classification Layer)
  data/ground_truth/
    water_{YYYYMMDD}.tif
    labels_{YYYYMMDD}.tif
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Tuple

import numpy as np
import rasterio
from rasterio.transform import from_origin
from scipy.ndimage import gaussian_filter

from src.config import load_config

CFG = load_config()


def create_spatial_landscape(H: int = 256, W: int = 256) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Create static landscape components:

    - base_water_dist: distance field for river / reservoir
    - field_grid: discrete parcel IDs
    - soil_fertility: spatial variation in soil quality
    """
    yy, xx = np.mgrid[0:H, 0:W]

    # 1. Meandering river & reservoir in upper-left and center
    river_path = 0.25 * W + 0.15 * W * np.sin(yy / 35.0) + 0.05 * W * np.cos(yy / 15.0)
    dist_river = np.abs(xx - river_path)

    # Lake / Reservoir centered around (H*0.4, W*0.7)
    dist_lake = np.sqrt(((yy - H * 0.35) / 1.2) ** 2 + ((xx - W * 0.7) / 1.5) ** 2)

    water_potential = np.minimum(dist_river / 6.0, dist_lake / 22.0)

    # 2. Agricultural parcels (grid structure)
    parcel_y = (yy // 16)
    parcel_x = (xx // 16)
    parcel_id = parcel_y * (W // 16) + parcel_x

    # 3. Spatial fertility / background soil
    np.random.seed(42)
    noise = np.random.randn(H, W)
    fertility = gaussian_filter(noise, sigma=8.0)
    fertility = (fertility - fertility.min()) / (fertility.max() - fertility.min())

    return water_potential, parcel_id, fertility


def simulate_temporal_sequence(
    dates: List[str],
    H: int = 256,
    W: int = 256,
) -> dict:
    """Simulate spectral reflectance and ground truth across dates."""
    water_potential, parcel_id, fertility = create_spatial_landscape(H, W)

    results = {}
    num_parcels = int(parcel_id.max() + 1)
    np.random.seed(101)

    # Crop type per parcel: 0 = Rabi only (Wheat), 1 = Kharif only (Paddy/Cotton), 2 = Double Crop, 3 = Fallow/Barren
    parcel_crop_types = np.random.choice([0, 1, 2, 3], size=num_parcels, p=[0.35, 0.35, 0.20, 0.10])
    # Parcel-level drought stress event (starts in August for selected parcels)
    parcel_stress_event = np.random.choice([0, 1], size=num_parcels, p=[0.75, 0.25])

    for t_idx, d_str in enumerate(dates):
        month = int(d_str[4:6])
        day = int(d_str[6:8])
        doy = (month - 1) * 30 + day  # Day of year approx

        # --- 1. Water dynamics ---
        # Post-monsoon (Jul-Oct: doy 180-300) water body swells; Pre-monsoon (Apr-Jun: doy 90-180) it shrinks
        if 180 <= doy <= 300:
            water_thresh = 1.35 + 0.4 * np.sin((doy - 180) / 120 * np.pi)
        elif 90 <= doy < 180:
            water_thresh = 0.85 - 0.2 * np.sin((doy - 90) / 90 * np.pi)
        else:
            water_thresh = 1.05

        water_mask = (water_potential <= water_thresh).astype(np.uint8)

        # --- 2. Crop Phenology (NDVI profile) ---
        crop_ndvi = np.zeros((H, W), dtype=np.float32)

        # Rabi Season peak: Jan-Feb (doy 1-60), Harvest: Mar-Apr (doy 60-120)
        # Kharif Season sowing: Jun-Jul (doy 170-210), Peak: Aug-Sep (doy 220-270), Harvest: Oct-Nov (doy 280-330)
        for pid in range(num_parcels):
            ctype = parcel_crop_types[pid]
            has_stress = parcel_stress_event[pid] and (doy >= 220 and doy <= 300)

            val = 0.12  # baseline soil NDVI
            if ctype in (0, 2):  # Rabi active in winter
                if doy <= 75:
                    # peak
                    val = 0.70 + 0.12 * fertility[parcel_id == pid].mean()
                elif 75 < doy <= 120:
                    # senescing
                    val = 0.70 - 0.55 * ((doy - 75) / 45.0)

            if ctype in (1, 2):  # Kharif active in monsoon
                if 170 <= doy <= 270:
                    growth = np.sin((doy - 170) / 100 * np.pi)
                    val = max(val, 0.15 + 0.65 * growth + 0.10 * fertility[parcel_id == pid].mean())
                elif 270 < doy <= 330:
                    val = max(val, 0.70 - 0.50 * ((doy - 270) / 60.0))

            if has_stress:
                val = val * 0.40  # stress drop

            crop_ndvi[parcel_id == pid] = np.clip(val, 0.08, 0.88)

        # Water has negative/low NDVI
        crop_ndvi[water_mask == 1] = -0.35 + np.random.randn(*crop_ndvi[water_mask == 1].shape) * 0.05

        # --- 3. Synthesize Reflectance Bands (Reflectance in [0, 1] scaled to [0, 10000] Int16) ---
        # Blue, Green, Red, NIR, SWIR1, SWIR2
        # Vegetation: Low Blue/Red, Moderate Green, High NIR, Low-Mid SWIR
        # Water: High Blue/Green, Very Low Red/NIR/SWIR
        # Soil: Moderate across all, higher in Red/SWIR

        is_water = water_mask == 1
        is_veg = (crop_ndvi >= 0.35) & (~is_water)
        is_stress = (crop_ndvi >= 0.20) & (crop_ndvi < 0.35) & (~is_water)
        is_bare = (~is_water) & (~is_veg) & (~is_stress)

        b_blue = np.zeros((H, W), dtype=np.float32)
        b_green = np.zeros((H, W), dtype=np.float32)
        b_red = np.zeros((H, W), dtype=np.float32)
        b_nir = np.zeros((H, W), dtype=np.float32)
        b_swir1 = np.zeros((H, W), dtype=np.float32)
        b_swir2 = np.zeros((H, W), dtype=np.float32)
        scl = np.full((H, W), 4, dtype=np.uint8)  # default vegetation

        # Water
        b_blue[is_water] = 0.08 + np.random.randn(*b_blue[is_water].shape) * 0.01
        b_green[is_water] = 0.07 + np.random.randn(*b_green[is_water].shape) * 0.01
        b_red[is_water] = 0.03 + np.random.randn(*b_red[is_water].shape) * 0.005
        b_nir[is_water] = 0.01 + np.random.randn(*b_nir[is_water].shape) * 0.003
        b_swir1[is_water] = 0.005
        b_swir2[is_water] = 0.002
        scl[is_water] = 6  # Water SCL

        # Healthy Veg
        b_blue[is_veg] = 0.035
        b_green[is_veg] = 0.085
        b_red[is_veg] = 0.045
        b_nir[is_veg] = 0.45 + (crop_ndvi[is_veg] - 0.4) * 0.4
        b_swir1[is_veg] = 0.12
        b_swir2[is_veg] = 0.06
        scl[is_veg] = 4  # Vegetation SCL

        # Stressed Veg
        b_blue[is_stress] = 0.055
        b_green[is_stress] = 0.095
        b_red[is_stress] = 0.125
        b_nir[is_stress] = 0.22
        b_swir1[is_stress] = 0.24
        b_swir2[is_stress] = 0.16
        scl[is_stress] = 4

        # Bare Soil / Fallow
        b_blue[is_bare] = 0.09
        b_green[is_bare] = 0.13
        b_red[is_bare] = 0.18
        b_nir[is_bare] = 0.24
        b_swir1[is_bare] = 0.32
        b_swir2[is_bare] = 0.26
        scl[is_bare] = 5  # Bare soil SCL

        # Add realistic spatial texture & noise
        noise_tex = np.random.uniform(0.95, 1.05, size=(H, W))
        b_blue = np.clip(b_blue * noise_tex * 10000, 0, 10000).astype(np.uint16)
        b_green = np.clip(b_green * noise_tex * 10000, 0, 10000).astype(np.uint16)
        b_red = np.clip(b_red * noise_tex * 10000, 0, 10000).astype(np.uint16)
        b_nir = np.clip(b_nir * noise_tex * 10000, 0, 10000).astype(np.uint16)
        b_swir1 = np.clip(b_swir1 * noise_tex * 10000, 0, 10000).astype(np.uint16)
        b_swir2 = np.clip(b_swir2 * noise_tex * 10000, 0, 10000).astype(np.uint16)

        # Stress GT Label: 0=severe, 1=moderate, 2=healthy, 3=no-veg
        labels = np.full((H, W), 3, dtype=np.uint8)
        labels[is_stress] = 1
        labels[is_veg] = 2
        # Severe stress if very low NDVI among vegetation parcels
        labels[is_bare & (crop_ndvi < 0.15)] = 3

        results[d_str] = {
            "bands": {
                "B02": b_blue,
                "B03": b_green,
                "B04": b_red,
                "B08": b_nir,
                "B11": b_swir1,
                "B12": b_swir2,
                "SCL": scl,
            },
            "water_gt": water_mask,
            "stress_gt": labels,
            "ndvi_gt": crop_ndvi,
        }

    return results


def write_geotiff_dataset(
    output_raw_dir: str = "data/raw",
    output_gt_dir: str = "data/ground_truth",
    num_dates: int = 16,
):
    """Generate and write GeoTIFF files for raw imagery and ground truth."""
    raw_path = Path(output_raw_dir)
    gt_path = Path(output_gt_dir)
    raw_path.mkdir(parents=True, exist_ok=True)
    gt_path.mkdir(parents=True, exist_ok=True)

    # 16 regular observation dates covering year 2023
    dates = [
        "20230115", "20230210", "20230305", "20230325",
        "20230415", "20230510", "20230605", "20230625",
        "20230715", "20230810", "20230830", "20230920",
        "20231015", "20231110", "20231130", "20231220",
    ][:num_dates]

    H, W = 256, 256
    target_crs = CFG["preprocessing"]["reprojection"]["target_crs"]
    # Reference origin in UTM Zone 43N (Central India)
    transform = from_origin(600000, 2200000, 10, 10)

    profile = {
        "driver": "GTiff",
        "height": H,
        "width": W,
        "count": 1,
        "crs": target_crs,
        "transform": transform,
        "compress": "lzw",
    }

    print(f"Synthesizing {len(dates)} multi-temporal satellite scenes...")
    sim_data = simulate_temporal_sequence(dates, H=H, W=W)

    for d_str, data in sim_data.items():
        # Write individual raw band files
        for b_name, b_arr in data["bands"].items():
            b_profile = profile.copy()
            b_profile["dtype"] = "uint16" if b_name != "SCL" else "uint8"
            out_file = raw_path / f"S2_{d_str}_{b_name}.tif"
            with rasterio.open(out_file, "w", **b_profile) as dst:
                dst.write(b_arr, 1)

        # Write ground truth water mask
        w_profile = profile.copy()
        w_profile["dtype"] = "uint8"
        with rasterio.open(gt_path / f"water_{d_str}.tif", "w", **w_profile) as dst:
            dst.write(data["water_gt"], 1)

        # Write ground truth stress labels
        with rasterio.open(gt_path / f"labels_{d_str}.tif", "w", **w_profile) as dst:
            dst.write(data["stress_gt"], 1)

    print(f"Generated {len(dates) * 7} raw band GeoTIFFs in {raw_path}")
    print(f"Generated {len(dates) * 2} ground-truth mask GeoTIFFs in {gt_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic multi-temporal satellite dataset")
    parser.add_argument("--out-dir", default="data/raw", help="Raw data directory")
    parser.add_argument("--gt-dir", default="data/ground_truth", help="Ground truth directory")
    parser.add_argument("--dates", type=int, default=16, help="Number of dates to generate")
    args = parser.parse_args()

    write_geotiff_dataset(args.out_dir, args.gt_dir, args.dates)
