"""
Training script — trains U-Net water segmentation & LSTM anomaly models.

Usage:
    python -m src.train --mode all
    python -m src.train --mode water
    python -m src.train --mode anomaly
"""

from __future__ import annotations

import argparse
import glob
from pathlib import Path

import numpy as np
import torch
import rasterio
from torch.utils.data import DataLoader, TensorDataset

from src.config import load_config
from src.water_body import UNetWater, ndwi_water_mask
from src.anomaly_detection import (
    LSTMAutoEncoder,
    build_pixel_ts,
    build_sequences,
    train_anomaly_model,
)
from src.vegetation_stress import indices_from_composite


def train_water_unet(
    composites_dir: str,
    labels_dir: str | None = None,
    save_path: str | None = None,
):
    """Train U-Net for water body segmentation.

    Strategy:
      - If ground truth labels exist (labels_dir/water_*.tif), use supervised.
      - Otherwise, generate pseudo-labels from NDWI threshold and fine-tune.
    """
    cfg = load_config()
    model_cfg = cfg["models"]["water_segmentation"]
    train_cfg = cfg["training"]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Device: {device}")

    model = UNetWater(
        in_channels=model_cfg["in_channels"],
        base_filters=model_cfg["base_filters"],
        depth=model_cfg["depth"],
    ).to(device)

    save_path = save_path or model_cfg["checkpoint"]
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)

    # Gather composites
    comp_files = sorted(glob.glob(str(Path(composites_dir) / "composite_*.tif")))
    if not comp_files:
        print("  No composites found — cannot train")
        return

    # Check for labels
    use_labels = False
    if labels_dir:
        label_files = sorted(glob.glob(str(Path(labels_dir) / "water_*.tif")))
        if label_files:
            use_labels = True

    print(f"  Composites: {len(comp_files)} | Labels: {'yes' if use_labels else 'pseudo (NDWI threshold)'}")

    # Prepare data
    X_list, y_list = [], []
    for cf in comp_files:
        with rasterio.open(cf) as src:
            data = src.read()[:model_cfg["in_channels"]].astype(np.float32)  # (C, H, W)

        # Generate pseudo-labels if no ground truth
        if use_labels:
            # Find matching label file
            date_str = Path(cf).stem.split("_")[1]
            match = [lf for lf in label_files if date_str in lf]
            if match:
                with rasterio.open(match[0]) as src:
                    label = src.read(1).astype(np.float32)
            else:
                continue
        else:
            # Pseudo-label from NDWI threshold
            indices = indices_from_composite(cf)
            ndwi = indices.get("ndwi")
            if ndwi is None:
                continue
            label = ndwi_water_mask(ndwi).astype(np.float32)

        X_list.append(data)
        y_list.append(label)

    if not X_list:
        print("  No valid training data")
        return

    # Pad to same size
    max_h = max(x.shape[1] for x in X_list)
    max_w = max(x.shape[2] for x in X_list)

    X_padded = np.zeros((len(X_list), X_list[0].shape[0], max_h, max_w), dtype=np.float32)
    y_padded = np.zeros((len(y_list), 1, max_h, max_w), dtype=np.float32)

    for i, (x, y) in enumerate(zip(X_list, y_list)):
        h, w = x.shape[1], x.shape[2]
        X_padded[i, :, :h, :w] = x
        y_padded[i, 0, :h, :w] = y

    # Convert to tensors
    X_tensor = torch.from_numpy(X_padded)
    y_tensor = torch.from_numpy(y_padded)

    ds = TensorDataset(X_tensor, y_tensor)
    dl = DataLoader(ds, batch_size=train_cfg["batch_size"], shuffle=True)

    optimizer = torch.optim.Adam(model.parameters(), lr=train_cfg["learning_rate"])
    criterion = torch.nn.BCEWithLogitsLoss()

    best_loss = float("inf")
    patience = train_cfg["early_stopping_patience"]
    wait = 0

    epochs = 20
    print(f"  Training for up to {epochs} epochs...", flush=True)
    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss = 0
        for xb, yb in dl:
            xb, yb = xb.to(device), yb.to(device)
            logits = model(xb)
            loss = criterion(logits, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * xb.size(0)

        epoch_loss /= len(ds)
        if epoch % 5 == 0 or epoch == 1:
            print(f"    Epoch {epoch:3d}/{epochs}  loss={epoch_loss:.6f}", flush=True)

        if epoch_loss < best_loss:
            best_loss = epoch_loss
            wait = 0
            torch.save(model.state_dict(), save_path)
        else:
            wait += 1
            if wait >= patience:
                print(f"    Early stopping at epoch {epoch}", flush=True)
                break

    print(f"  Best model saved -> {save_path} (loss={best_loss:.6f})", flush=True)


def train_anomaly(
    composites_dir: str,
    save_path: str | None = None,
):
    """Train LSTM autoencoder on NDVI temporal patterns (unsupervised)."""
    cfg = load_config()
    model_cfg = cfg["models"]["anomaly_detection"]
    train_cfg = cfg["training"]

    # Build NDVI time-series
    comp_files = sorted(glob.glob(str(Path(composites_dir) / "composite_*.tif")))
    if len(comp_files) < model_cfg["sequence_length"] + 2:
        print(f"  Need >= {model_cfg['sequence_length'] + 2} composites for anomaly training", flush=True)
        return

    ndvi_stack = []
    for cf in comp_files:
        indices = indices_from_composite(cf)
        if "ndvi" in indices:
            ndvi_stack.append(indices["ndvi"])

    if not ndvi_stack:
        print("  No NDVI data found", flush=True)
        return

    ndvi_arr = np.stack(ndvi_stack, axis=0)  # (T, H, W)
    ts = build_pixel_ts(ndvi_arr)  # (H*W, T)

    # Sample pixels for training (memory-efficient)
    N = ts.shape[0]
    sample_size = min(N, 2000)
    idx = np.random.choice(N, sample_size, replace=False)
    ts_sample = ts[idx]

    seq_len = model_cfg["sequence_length"]
    seqs = build_sequences(ts_sample, seq_len)  # (N_windows, seq_len, 1)

    if len(seqs) == 0:
        print("  Not enough sequences for training", flush=True)
        return

    print(f"  Training anomaly model on {len(seqs)} sequences (seq_len={seq_len})", flush=True)

    save_path = save_path or model_cfg["checkpoint"]
    device = "cuda" if torch.cuda.is_available() else "cpu"

    model = train_anomaly_model(
        seqs,
        save_path=save_path,
        model_type="lstm",
        device=device,
        batch_size=128,
        epochs=20,
    )
    print(f"  Anomaly model saved -> {save_path}", flush=True)


def train_stress_rf(
    composites_dir: str,
    labels_dir: str | None = None,
    save_path: str | None = None,
):
    """Train Random Forest classifier on spectral indices (NDVI, NDWI, MNDWI, EVI)."""
    from src.vegetation_stress import train_stress_classifier
    save_path = save_path or "checkpoints/rf_stress.joblib"
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    clf = train_stress_classifier(
        composites_dir=composites_dir,
        labels_dir=labels_dir,
        save_path=save_path,
    )
    if clf is not None:
        print(f"  Vegetation stress RF model saved -> {save_path}")
    else:
        print("  (Vegetation stress training skipped or no labels found)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train KRIDSHDRISTI models")
    parser.add_argument("--mode", default="all", choices=["all", "water", "anomaly", "stress"])
    parser.add_argument("--composites-dir", default="data/outputs/composites")
    parser.add_argument("--labels-dir", default="data/ground_truth", help="Ground truth labels dir")
    parser.add_argument("--save-dir", default="checkpoints")
    args = parser.parse_args()

    Path(args.save_dir).mkdir(parents=True, exist_ok=True)

    if args.mode in ("all", "water"):
        print("\n[Training U-Net for Water Segmentation]")
        train_water_unet(
            args.composites_dir,
            args.labels_dir,
            save_path=str(Path(args.save_dir) / "unet_water_best.pth"),
        )

    if args.mode in ("all", "stress"):
        print("\n[Training Random Forest for Vegetation Stress]")
        train_stress_rf(
            args.composites_dir,
            args.labels_dir,
            save_path=str(Path(args.save_dir) / "rf_stress.joblib"),
        )

    if args.mode in ("all", "anomaly"):
        print("\n[Training LSTM AutoEncoder for Anomaly Detection]")
        train_anomaly(
            args.composites_dir,
            save_path=str(Path(args.save_dir) / "lstm_anomaly_best.pth"),
        )
