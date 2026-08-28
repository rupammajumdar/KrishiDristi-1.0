"""
Main pipeline orchestrator — ties all modules together.

Usage:
    python -m src.pipeline --raw-dir data/raw --out-dir data/outputs --dates 20230601 20230701 ...
    python -m src.pipeline --raw-dir data/raw --out-dir data/outputs   # auto-discover dates

Architecture:
    ┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
    │ 1. INGESTION &  │────▶│ 2. INDEX COMPUTE  │────▶│ 3. STRESS          │
    │ PREPROCESS      │     │ NDVI/NDWI/EVI     │     │ CLASSIFICATION     │
    └─────────────────┘     └──────────────────┘     └────────────────────┘
                                     │                        │
                                     ▼                        ▼
                            ┌──────────────────┐     ┌────────────────────┐
                            │ 4. WATER BODY    │     │ 5. ANOMALY         │
                            │ SEGMENTATION     │     │ DETECTION          │
                            └──────────────────┘     └────────────────────┘
                                     │                        │
                                     ▼                        ▼
                            ┌────────────────────────────────────────────┐
                            │ 6. OUTPUTS: Maps, Scorecards, PDF Reports │
                            └────────────────────────────────────────────┘
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio

from src.config import load_config
from src.data_pipeline import build_clean_composites
from src.vegetation_stress import (
    indices_from_composite,
    classify_stress,
    save_stress_map,
)
from src.water_body import (
    load_water_model,
    predict_water_unet,
    ndwi_water_mask,
    water_change,
    water_extent_ts,
    save_water_mask,
    save_change_map,
)
from src.anomaly_detection import (
    build_pixel_ts,
    build_sequences,
    detect_anomalies_statistical,
    anomaly_summary,
)
from src.output_generation import (
    plot_stress_map,
    plot_water_map,
    plot_change_map,
    plot_anomaly_heatmap,
    plot_ndvi_timeseries,
    create_animation,
    build_anomaly_scorecard,
    save_scorecard,
    generate_pdf_report,
)
from src.evaluation import evaluate_water_segmentation


def _read_profile(path: str) -> dict:
    with rasterio.open(path) as src:
        return src.profile


def run_pipeline(
    raw_dir: str,
    out_dir: str,
    dates: list[str] | None = None,
    satellite: str | None = None,
    train: bool = False,
):
    cfg = load_config()
    satellite = satellite or cfg["data"]["satellite"]
    out = Path(out_dir)
    maps_dir = out / "maps"
    reports_dir = out / "reports"
    anomalies_dir = out / "anomalies"
    models_dir = out / "models"
    for d in [maps_dir, reports_dir, anomalies_dir, models_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # ── Discover dates ───────────────────────────────────────────
    if not dates:
        dates = sorted(set(
            p.stem.split("_")[1]
            for p in Path(raw_dir).glob("*.tif")
            if len(p.stem.split("_")[1]) == 8
        ))
    if not dates:
        print("[ERROR] No dates found. Provide --dates or place YYYYMMDD-named tiles in --raw-dir")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  KRIDSHDRISTI Pipeline — {len(dates)} composites")
    print(f"  Satellite: {satellite} | Region: {cfg['project']['region']}")
    print(f"{'='*60}\n")

    sat_bands = cfg["data"]["bands"].get(satellite, {})
    band_keys = [sat_bands[k] for k in ["blue", "green", "red", "nir", "swir1"] if sat_bands.get(k)]

    # ── Step 1: Build composites ─────────────────────────────────
    print("[1/6] Building composites...")
    composites_dir = str(out / "composites")
    composite_paths = build_clean_composites(raw_dir, composites_dir, dates, band_keys, satellite)
    print(f"  -> {len(composite_paths)} composites\n")

    if not composite_paths:
        print("[ERROR] No composites produced. Check raw data.")
        sys.exit(1)

    composite_dates = [Path(p).stem.split("_")[1] for p in composite_paths]

    # ── Step 2: Vegetation indices + stress ──────────────────────
    print("[2/6] Computing vegetation indices & classifying stress...")
    rf_model = None
    rf_ckpt = Path("checkpoints/rf_stress.joblib")
    if rf_ckpt.exists():
        try:
            import joblib
            rf_model = joblib.load(str(rf_ckpt))
            print("  (Loaded trained Random Forest vegetation stress model)")
        except Exception as e:
            print(f"  (Failed loading RF model: {e} — using thresholds)")

    stress_maps = []
    ndvi_means = []
    ndvi_indices = []

    for cp, date in zip(composite_paths, composite_dates):
        indices = indices_from_composite(cp)
        stress = classify_stress(indices, rf_model=rf_model)
        profile = _read_profile(cp)
        stress_path = str(maps_dir / f"stress_{date}.tif")
        save_stress_map(stress, profile, stress_path)
        stress_maps.append((date, stress, stress_path))

        if "ndvi" in indices:
            ndvi_arr = indices["ndvi"]
            ndvi_indices.append(ndvi_arr)
            mask_veg = stress != 3
            ndvi_means.append(float(ndvi_arr[mask_veg].mean()) if mask_veg.any() else 0.0)
            plot_stress_map(stress, date, str(maps_dir / f"stress_{date}.png"))
        else:
            ndvi_indices.append(np.zeros((1, 1)))
            ndvi_means.append(0.0)
        print(f"  {date}: mean_ndvi={ndvi_means[-1]:.3f}")

    print()

    # ── Step 3: Water body segmentation ──────────────────────────
    print("[3/6] Water body segmentation...")
    try:
        water_model = load_water_model()
        use_unet = True
    except Exception:
        print("  (no trained U-Net — using NDWI threshold fallback)")
        use_unet = False

    water_masks = []
    for cp, date in zip(composite_paths, composite_dates):
        indices = indices_from_composite(cp)
        if use_unet:
            with rasterio.open(cp) as src:
                comp_data = src.read()
            mask = predict_water_unet(water_model, comp_data)
        else:
            mask = ndwi_water_mask(indices.get("ndwi", np.zeros((1, 1))))

        profile = _read_profile(cp)
        water_path = str(maps_dir / f"water_{date}.tif")
        save_water_mask(mask, profile, water_path)
        water_masks.append((date, mask, water_path))
        plot_water_map(mask, date, str(maps_dir / f"water_{date}.png"))
        res = cfg["data"]["resolution"]
        extent = float(mask.sum()) * (res ** 2) / 1e4
        print(f"  {date}: water extent = {extent:.1f} ha")

    print()

    # ── Step 4: Change detection + anomaly detection ─────────────
    print("[4/6] Change detection & anomaly scoring...")
    change_events = []
    if len(water_masks) >= 2:
        for i in range(len(water_masks) - 1):
            d1, m1, p1 = water_masks[i]
            d2, m2, p2 = water_masks[i + 1]
            change = water_change(m1, m2)
            change_path = str(maps_dir / f"change_{d1}_{d2}.tif")
            save_change_map(change["change_map"], _read_profile(p1), change_path)
            plot_change_map(change["change_map"], d1, d2, str(maps_dir / f"change_{d1}_{d2}.png"))
            evt = {"date1": d1, "date2": d2, **change["stats"]}
            change_events.append(evt)
            print(f"  {d1} -> {d2}: net={change['stats']['net_change_ha']} ha")

    # Anomaly scores from NDVI temporal
    anomaly_scores = None
    anomaly_stats = {"note": "insufficient data"}
    lstm_ckpt = Path("checkpoints/lstm_anomaly_best.pth")
    seq_len = cfg["models"]["anomaly_detection"]["sequence_length"]

    if len(ndvi_indices) >= 3:
        ndvi_stack = np.stack(ndvi_indices, axis=0)  # (T, H, W)
        H, W = ndvi_stack.shape[1], ndvi_stack.shape[2]
        ts = build_pixel_ts(ndvi_stack)  # (H*W, T)

        if lstm_ckpt.exists() and len(ndvi_indices) >= seq_len:
            try:
                import torch
                from src.anomaly_detection import LSTMAutoEncoder, compute_anomaly_scores
                model = LSTMAutoEncoder(input_dim=1, hidden_dim=cfg["models"]["anomaly_detection"]["hidden_dim"], num_layers=cfg["models"]["anomaly_detection"]["num_layers"])
                model.load_state_dict(torch.load(str(lstm_ckpt), map_location="cpu"))
                model.eval()
                sequences = ts[:, -seq_len:, np.newaxis].astype(np.float32)
                anomaly_scores = compute_anomaly_scores(model, sequences, H, W, seq_len=seq_len)
                print("  (Using trained LSTM AutoEncoder for anomaly detection)")
            except Exception as e:
                print(f"  (LSTM scoring fallback: {e})")
                anomaly_flags = detect_anomalies_statistical(ts.T)
                anomaly_scores = anomaly_flags.reshape(H, W).astype(np.float32)
        else:
            anomaly_flags = detect_anomalies_statistical(ts.T)  # (N_pixels,)
            anomaly_scores = anomaly_flags.reshape(H, W).astype(np.float32)

        plot_anomaly_heatmap(anomaly_scores, str(anomalies_dir / "anomaly_scores.png"))
        anomaly_stats = anomaly_summary(anomaly_scores)
        print(f"  Anomaly fraction: {anomaly_stats['anomaly_fraction']:.2%}")
    else:
        print("  (skipping anomaly — need >= 3 composites)")

    print()

    # ── Step 5: Generate outputs ─────────────────────────────────
    print("[5/6] Generating outputs...")

    # NDVI time-series chart
    if ndvi_means:
        plot_ndvi_timeseries(composite_dates, ndvi_means, str(maps_dir / "ndvi_timeseries.png"))
        print(f"  NDVI time-series saved")

    # Animation
    valid_ndvi = [a for a in ndvi_indices if a.size > 1]
    if len(valid_ndvi) >= 3:
        anim_path = str(maps_dir / "ndvi_animation.gif")
        create_animation(
            valid_ndvi,
            composite_dates[:len(valid_ndvi)],
            anim_path,
            fps=cfg["outputs"]["animation_fps"],
        )
        print(f"  Animation saved -> {anim_path}")

    # Water extent time-series
    water_masks_only = [m for _, m, _ in water_masks]
    water_dates = [d for d, _, _ in water_masks]
    wt_series = water_extent_ts(water_masks_only, water_dates)

    # Scorecard
    stress_summary = {
        "mean_ndvi": round(float(np.mean(ndvi_means)), 3) if ndvi_means else 0,
        "min_ndvi": round(float(min(ndvi_means)), 3) if ndvi_means else 0,
        "severe_stress_fraction": round(
            float(np.mean([np.mean(s == 0) for _, s, _ in stress_maps])), 4
        ) if stress_maps else 0,
    }
    water_summary = {
        "mean_extent_ha": round(float(np.mean([w["water_extent_ha"] for w in wt_series])), 2) if wt_series else 0,
        "max_extent_ha": round(float(max([w["water_extent_ha"] for w in wt_series])), 2) if wt_series else 0,
        "min_extent_ha": round(float(min([w["water_extent_ha"] for w in wt_series])), 2) if wt_series else 0,
    }

    scorecard = build_anomaly_scorecard(
        stress_summary, water_summary, anomaly_stats, change_events, composite_dates
    )
    save_scorecard(scorecard, str(reports_dir / "anomaly_scorecard.json"))
    print(f"  Scorecard saved -> {reports_dir / 'anomaly_scorecard.json'}")

    # PDF Report
    map_images = sorted(str(p) for p in maps_dir.glob("*.png"))[:8]
    try:
        pdf_path = str(reports_dir / "kridshdristi_report.pdf")
        generate_pdf_report(scorecard, map_images, pdf_path)
        print(f"  PDF report saved -> {pdf_path}")
    except Exception as e:
        print(f"  [warn] PDF generation failed: {e}")

    print()

    # ── Step 6: Evaluation ───────────────────────────────────────
    print("[6/6] Evaluation metrics...")
    gt_dir = Path("data/ground_truth")
    if gt_dir.exists():
        gt_water = sorted(gt_dir.glob("water_*.tif"))
        if gt_water:
            pred_list = [m for _, m, _ in water_masks]
            gt_list = []
            for gf in gt_water:
                with rasterio.open(str(gf)) as src:
                    gt_list.append(src.read(1))
            n = min(len(pred_list), len(gt_list))
            seg_metrics = evaluate_water_segmentation(pred_list[:n], gt_list[:n], composite_dates[:n])
            print(f"  Water Segmentation: mIoU={seg_metrics['mean_iou']}, mDice={seg_metrics['mean_dice']}")
    else:
        print("  (no ground truth found — skipping quantitative eval)")

    print(f"\n{'='*60}")
    print(f"  Pipeline complete. All outputs in: {out_dir}")
    print(f"{'='*60}\n")

    return {
        "composites": len(composite_paths),
        "stress_maps": len(stress_maps),
        "water_masks": len(water_masks),
        "change_events": len(change_events),
        "anomaly_stats": anomaly_stats,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KRIDSHDRISTI Pipeline")
    parser.add_argument("--raw-dir", default="data/raw", help="Directory with raw satellite tiles")
    parser.add_argument("--out-dir", default="data/outputs", help="Output directory")
    parser.add_argument("--dates", nargs="*", default=None, help="YYYYMMDD dates to process")
    parser.add_argument("--satellite", default=None, help="Override satellite (sentinel-2, landsat-8)")
    parser.add_argument("--train", action="store_true", help="Train models before inference")
    args = parser.parse_args()

    run_pipeline(
        raw_dir=args.raw_dir,
        out_dir=args.out_dir,
        dates=args.dates,
        satellite=args.satellite,
        train=args.train,
    )
