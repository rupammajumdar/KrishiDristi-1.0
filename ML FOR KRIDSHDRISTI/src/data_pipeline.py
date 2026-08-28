"""
Data ingestion & preprocessing pipeline.

Handles:
  - Loading multi-band GeoTIFFs (Sentinel-2, Landsat-8)
  - Cloud masking via SCL (Sentinel-2) or QA_PIXEL (Landsat)
  - Reprojection to target CRS
  - Resampling to target resolution
  - Temporal compositing over sliding windows
  - Handling missing tiles via gap-filling
"""

from __future__ import annotations

import glob
import re
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge
from rasterio.warp import calculate_default_transform, reproject
from scipy.ndimage import uniform_filter
from tqdm import tqdm

from src.config import load_config


CFG = load_config()


# ── helpers ──────────────────────────────────────────────────────

def _date_from_filename(path: str) -> str:
    """Extract a YYYYMMDD date string from a filename like S2_20230612_B04.tif."""
    m = re.search(r"(\d{8})", Path(path).stem)
    return m.group(1) if m else ""


def _sorted_tiles(band_dir: str, band_key: str, date: str) -> list[str]:
    """Return all tile paths for a given band and date, sorted."""
    pattern = Path(band_dir) / f"*{date}*{band_key}*"
    return sorted(str(p) for p in pattern.glob("*.tif"))


# ── cloud masking ────────────────────────────────────────────────

def mask_clouds_scl(arr: np.ndarray, qa: np.ndarray) -> np.ndarray:
    """Sentinel-2 SCL-based cloud mask.

    SCL classes to mask: 3 (cloud shadow), 8 (cloud medium), 9 (cloud high),
    10 (cirrus), 11 (snow/ice).  Class 4 = vegetation, 5 = bare soil, 6 = water,
    7 = unclassified are kept.
    """
    mask_classes = {3, 8, 9, 10, 11}
    cloud_free = np.ones(arr.shape, dtype=bool)
    for c in mask_classes:
        cloud_free &= qa != c
    return arr * cloud_free[:, np.newaxis, np.newaxis]


def mask_clouds_landsat(arr: np.ndarray, qa: np.ndarray) -> np.ndarray:
    """Landsat QA_PIXEL-based cloud mask (bits 3=cloud, 4=cloud shadow)."""
    cloud_bit = (qa >> 3) & 1
    shadow_bit = (qa >> 4) & 1
    cloud_free = (cloud_bit == 0) & (shadow_bit == 0)
    return arr * cloud_free[:, np.newaxis, np.newaxis]


# ── reprojection ─────────────────────────────────────────────────

def reproject_to_utm(src_path: str, dst_path: str, target_crs: str = "EPSG:32643") -> str:
    with rasterio.open(src_path) as src:
        transform, width, height = calculate_default_transform(
            src.crs, target_crs, src.width, src.height, *src.bounds
        )
        kwargs = src.meta.copy()
        kwargs.update(crs=target_crs, transform=transform, width=width, height=height)

        with rasterio.open(dst_path, "w", **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    resampling=Resampling.bilinear,
                )
    return dst_path


# ── resampling ───────────────────────────────────────────────────

def resample_band(src_path: str, dst_path: str, target_res: int = 10) -> str:
    with rasterio.open(src_path) as src:
        scale = src.res[0] / target_res
        new_width = int(src.width * scale)
        new_height = int(src.height * scale)
        kwargs = src.meta.copy()
        kwargs.update(width=new_width, height=new_height, res=(target_res, target_res))

        data = src.read(
            out_shape=(src.count, new_height, new_width),
            resampling=Resampling.bilinear,
        )
        with rasterio.open(dst_path, "w", **kwargs) as dst:
            dst.write(data)
    return dst_path


# ── temporal compositing ─────────────────────────────────────────

def _parse_date(d: str) -> np.datetime64:
    return np.datetime64(f"{d[:4]}-{d[4:6]}-{d[6:8]}")


def composite_band_stack(
    band_dir: str,
    band_keys: list[str],
    date: str,
    window_days: int = 10,
    target_res: int = 10,
) -> np.ndarray | None:
    """Build a multi-band composite for *date* ± window_days/2.

    Returns  (num_bands, H, W)  or None if no tiles found.
    """
    center = _parse_date(date)
    raw_files = list(Path(band_dir).glob("*.tif"))
    if not raw_files:
        return None

    # Check if files are individual band files (e.g. S2_20230115_B02.tif)
    # or multi-band composites
    matched_bands = {}
    for b_key in band_keys:
        for f in raw_files:
            fdate = _date_from_filename(str(f))
            if not fdate:
                continue
            delta = abs((_parse_date(fdate) - center).astype(int))
            if delta <= window_days // 2 and b_key in f.stem:
                matched_bands[b_key] = str(f)
                break

    if len(matched_bands) == len(band_keys):
        # Stack individual band files in canonical band_keys order
        band_arrays = []
        for b_key in band_keys:
            with rasterio.open(matched_bands[b_key]) as src:
                arr = src.read(1).astype(np.float32)
                band_arrays.append(arr)
        return np.stack(band_arrays, axis=0)

    # Check for direct multi-band files
    for f in raw_files:
        fdate = _date_from_filename(str(f))
        if fdate:
            delta = abs((_parse_date(fdate) - center).astype(int))
            if delta <= window_days // 2:
                with rasterio.open(str(f)) as src:
                    arr = src.read().astype(np.float32)
                    if arr.shape[0] >= 3:
                        return arr

    return None


# ── gap filling ──────────────────────────────────────────────────

def fill_gaps(arr: np.ndarray, method: str = "interpolation") -> np.ndarray:
    """Fill nodata gaps using spatial interpolation."""
    if method == "interpolation":
        mask = arr == 0
        filled = arr.copy()
        for b in range(arr.shape[0]):
            channel = arr[b]
            filled_ch = uniform_filter(channel.astype(np.float32), size=5)
            filled[b] = np.where(mask[b], filled_ch, channel)
        return filled
    return arr


# ── high-level pipeline ─────────────────────────────────────────

def preprocess_single_file(
    src_path: str,
    out_dir: str,
    satellite: str = "sentinel-2",
) -> str:
    """Full preprocessing chain for one raw GeoTIFF → clean output."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    stem = Path(src_path).stem
    reprojected = str(out_dir / f"{stem}_reproj.tif")
    resampled = str(out_dir / f"{stem}_clean.tif")

    target_crs = CFG["preprocessing"]["reprojection"]["target_crs"]
    target_res = CFG["preprocessing"]["resampling"]["target_resolution"]

    reproject_to_utm(src_path, reprojected, target_crs)
    resample_band(reprojected, resampled, target_res)
    return resampled


def build_clean_composites(
    raw_dir: str,
    out_dir: str,
    dates: list[str],
    band_keys: list[str],
    satellite: str = "sentinel-2",
) -> list[str]:
    """For each date in *dates*, produce a clean multi-band GeoTIFF."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    outputs = []

    qa_band = CFG["data"]["bands"].get(satellite, {}).get("qa", "SCL")

    sample_file = next(Path(raw_dir).glob("*.tif"), None)
    transform = None
    if sample_file:
        with rasterio.open(str(sample_file)) as src:
            transform = src.transform

    for date in tqdm(dates, desc="Building composites"):
        stack = composite_band_stack(
            raw_dir, band_keys, date,
            window_days=CFG["data"]["time_range"].get("temporal_resolution", "10D") if isinstance(CFG["data"]["time_range"].get("temporal_resolution"), int) else 10,
        )
        if stack is None:
            print(f"  [skip] No tiles for {date}")
            continue

        # cloud-masked QA band would be included in the stack
        out_path = str(out_dir / f"composite_{date}.tif")
        with rasterio.open(
            out_path, "w",
            driver="GTiff",
            height=stack.shape[1],
            width=stack.shape[2],
            count=stack.shape[0],
            dtype=stack.dtype,
            crs=CFG["preprocessing"]["reprojection"]["target_crs"],
            transform=transform,
        ) as dst:
            dst.write(stack)
        outputs.append(out_path)

    return outputs


# ── CLI entry point ──────────────────────────────────────────────

if __name__ == "__main__":
    import argparse, json

    parser = argparse.ArgumentParser(description="Preprocess satellite tiles")
    parser.add_argument("--raw-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--dates", nargs="+", help="YYYYMMDD dates to process")
    parser.add_argument("--satellite", default="sentinel-2")
    args = parser.parse_args()

    sat_cfg = CFG["data"]["bands"].get(args.satellite, {})
    band_keys = [sat_cfg.get(k) for k in ["blue", "green", "red", "nir", "swir1"] if sat_cfg.get(k)]

    results = build_clean_composites(
        args.raw_dir, args.out_dir, args.dates or [], band_keys, args.satellite
    )
    print(f"Processed {len(results)} composites -> {args.out_dir}")
