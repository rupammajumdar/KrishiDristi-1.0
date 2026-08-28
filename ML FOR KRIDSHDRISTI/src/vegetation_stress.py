"""
Vegetation stress detection using spectral indices.

Computes:
  - NDVI  = (NIR - RED) / (NIR + RED)
  - NDWI  = (GREEN - NIR) / (GREEN + NIR)
  - EVI   = G * (NIR - RED) / (NIR + C1*RED - C2*BLUE + L)

Then classifies stress using thresholding + Random Forest ensemble.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib

from src.config import load_config

CFG = load_config()


# ── index computation ────────────────────────────────────────────

def _safe_divide(num: np.ndarray, den: np.ndarray, fill: float = 0.0) -> np.ndarray:
    mask = den == 0
    result = np.where(mask, fill, num.astype(np.float64) / np.where(mask, 1, den.astype(np.float64)))
    return result.astype(np.float32)


def compute_ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    return _safe_divide(nir - red, nir + red)


def compute_ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    return _safe_divide(green - nir, green + nir)


def compute_mndwi(green: np.ndarray, swir: np.ndarray) -> np.ndarray:
    return _safe_divide(green - swir, green + swir)


def compute_evi(nir: np.ndarray, red: np.ndarray, blue: np.ndarray,
                gain: float = 2.5, c1: float = 6.0, c2: float = 7.5, l: float = 1.0) -> np.ndarray:
    num = gain * (nir.astype(np.float64) - red.astype(np.float64))
    den = nir.astype(np.float64) + c1 * red.astype(np.float64) - c2 * blue.astype(np.float64) + l
    return _safe_divide(num, den, fill=0.0)


# ── index stack from composite ──────────────────────────────────

def indices_from_composite(composite_path: str) -> dict[str, np.ndarray]:
    """Read a multi-band composite and return computed index arrays."""
    sat = CFG["data"]["satellite"]
    bands = CFG["data"]["bands"][sat]
    idx_cfg = CFG["indices"]

    with rasterio.open(composite_path) as src:
        data = src.read()  # (C, H, W)
        profile = src.profile

    # Map band names to array indices by convention:
    # composite bands are ordered as: blue, green, red, nir, swir1, swir2, qa
    band_names = ["blue", "green", "red", "nir", "swir1", "swir2"]
    band_map = {}
    for i, name in enumerate(band_names):
        if i < data.shape[0]:
            band_map[name] = data[i]

    result = {}
    if "nir" in band_map and "red" in band_map:
        result["ndvi"] = compute_ndvi(band_map["nir"], band_map["red"])
    if "green" in band_map and "nir" in band_map:
        result["ndwi"] = compute_ndwi(band_map["green"], band_map["nir"])
    if "green" in band_map and "swir1" in band_map:
        result["mndwi"] = compute_mndwi(band_map["green"], band_map["swir1"])
    if "nir" in band_map and "red" in band_map and "blue" in band_map:
        evi_cfg = idx_cfg.get("evi", {})
        result["evi"] = compute_evi(
            band_map["nir"], band_map["red"], band_map["blue"],
            gain=evi_cfg.get("gain", 2.5),
            c1=6.0, c2=7.5, l=evi_cfg.get("lintresh", 1.0),
        )

    result["_profile"] = profile
    result["_band_map"] = band_map
    return result


# ── stress classification ────────────────────────────────────────

def threshold_stress(ndvi: np.ndarray) -> np.ndarray:
    """Classify vegetation stress via NDVI thresholds.

    Returns integer map: 0=severe, 1=moderate, 2=healthy, 3=no-veg
    """
    thr = CFG["stress_thresholds"]["ndvi"]
    cls = np.full_like(ndvi, 3, dtype=np.uint8)
    cls[(ndvi >= thr["severe_stress"][0]) & (ndvi < thr["severe_stress"][1])] = 0
    cls[(ndvi >= thr["moderate_stress"][0]) & (ndvi < thr["moderate_stress"][1])] = 1
    cls[(ndvi >= thr["healthy"][0]) & (ndvi <= thr["healthy"][1])] = 2
    return cls


def build_stress_features(indices: dict[str, np.ndarray]) -> np.ndarray:
    """Stack indices into (N, num_features) feature matrix."""
    keys = [k for k in ["ndvi", "ndwi", "mndwi", "evi"] if k in indices]
    if not keys:
        raise ValueError("No indices found in composite")
    flat = np.stack([indices[k].ravel() for k in keys], axis=-1)
    return flat, keys


def train_stress_classifier(
    composites_dir: str,
    labels_dir: str | None = None,
    save_path: str | None = None,
) -> RandomForestClassifier | None:
    """Train RF classifier for stress. If no labels, returns None (use thresholds only)."""
    cfg = CFG["models"]["vegetation_stress"]
    if cfg["method"] != "threshold+rf" or labels_dir is None:
        return None

    feature_files = sorted(Path(composites_dir).glob("composite_*.tif"))
    label_files = sorted(Path(labels_dir).glob("labels_*.tif"))

    X_all, y_all = [], []
    for cf, lf in zip(feature_files, label_files):
        indices = indices_from_composite(str(cf))
        feats, _ = build_stress_features(indices)
        with rasterio.open(str(lf)) as src:
            labels = src.read(1).ravel()
        valid = labels < 3  # exclude no-veg from training
        X_all.append(feats[valid])
        y_all.append(labels[valid])

    if not X_all:
        return None

    X = np.concatenate(X_all)
    y = np.concatenate(y_all)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    clf = RandomForestClassifier(
        n_estimators=cfg.get("rf_n_estimators", 200),
        max_depth=cfg.get("rf_max_depth", 15),
        n_jobs=-1,
        random_state=42,
    )
    clf.fit(X_train, y_train)
    print(f"  RF train acc: {clf.score(X_train, y_train):.3f}  val acc: {clf.score(X_val, y_val):.3f}")

    if save_path:
        joblib.dump(clf, save_path)
    return clf


def classify_stress(
    indices: dict[str, np.ndarray],
    rf_model: Optional[RandomForestClassifier] = None,
) -> np.ndarray:
    """Return stress map: 0=severe, 1=moderate, 2=healthy, 3=no-vegetation."""
    ndvi = indices["ndvi"]
    no_veg = ndvi < -0.1

    if rf_model is not None:
        feats, _ = build_stress_features(indices)
        pred = rf_model.predict(feats).reshape(ndvi.shape).astype(np.uint8)
        pred[no_veg] = 3
        return pred
    else:
        return threshold_stress(ndvi)


# ── save helpers ─────────────────────────────────────────────────

def save_stress_map(stress: np.ndarray, profile: dict, out_path: str) -> str:
    p = profile.copy()
    p.update(count=1, dtype="uint8", compress="lzw", nodata=255)
    with rasterio.open(out_path, "w", **p) as dst:
        dst.write(stress, 1)
    return out_path


# ── CLI ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--composite", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model", default=None, help="Optional RF model path")
    args = parser.parse_args()

    indices = indices_from_composite(args.composite)
    rf = joblib.load(args.model) if args.model else None
    stress = classify_stress(indices, rf)
    with rasterio.open(args.composite) as src:
        profile = src.profile
    save_stress_map(stress, profile, args.out)
    print(f"Stress map saved -> {args.out}")
