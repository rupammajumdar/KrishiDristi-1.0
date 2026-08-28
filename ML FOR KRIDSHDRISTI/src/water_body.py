"""
Water body segmentation and change detection.

Components:
  1. NDWI / MNDWI threshold-based water mask
  2. U-Net segmentation model for precise water boundary delineation
  3. Change detection between two time-steps (binary + anomaly score)
  4. Temporal water-extent time-series builder
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import rasterio
import torch
import torch.nn as nn
import torch.nn.functional as F

from src.config import load_config

CFG = load_config()


# ══════════════════════════════════════════════════════════════════
#  U-Net Architecture
# ══════════════════════════════════════════════════════════════════

class DoubleConv(nn.Module):
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class UNetWater(nn.Module):
    """Lightweight U-Net for water body segmentation (2-class output)."""

    def __init__(self, in_channels: int = 4, base_filters: int = 32, depth: int = 4):
        super().__init__()
        self.depth = depth
        self.enc = nn.ModuleList()
        self.pool = nn.MaxPool2d(2)
        self.up = nn.ModuleList()

        ch = in_channels
        for i in range(depth):
            self.enc.append(DoubleConv(ch, base_filters * (2 ** i)))
            ch = base_filters * (2 ** i)

        self.bottleneck = DoubleConv(ch, ch * 2)

        ch = ch * 2
        for i in range(depth - 1, -1, -1):
            self.up.append(nn.ConvTranspose2d(ch, ch // 2, 2, stride=2))
            self.up.append(DoubleConv(ch, base_filters * (2 ** i)))
            ch = base_filters * (2 ** i)

        self.out_conv = nn.Conv2d(base_filters, 1, 1)

    def forward(self, x):
        skips = []
        for enc in self.enc:
            x = enc(x)
            skips.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)

        for i in range(0, len(self.up), 2):
            x = self.up[i](x)
            skip = skips.pop()
            if x.shape[2:] != skip.shape[2:]:
                x = F.interpolate(x, size=skip.shape[2:], mode="bilinear", align_corners=True)
            x = self.up[i + 1](torch.cat([skip, x], dim=1))

        return self.out_conv(x)


# ══════════════════════════════════════════════════════════════════
#  Water Mask via NDWI Threshold
# ══════════════════════════════════════════════════════════════════

def ndwi_water_mask(ndwi: np.ndarray, threshold: float = 0.3) -> np.ndarray:
    """Binary water mask: 1 = water, 0 = non-water."""
    return (ndwi >= threshold).astype(np.uint8)


def mndwi_water_mask(mndwi: np.ndarray, threshold: float = 0.0) -> np.ndarray:
    return (mndwi >= threshold).astype(np.uint8)


# ══════════════════════════════════════════════════════════════════
#  U-Net Inference
# ══════════════════════════════════════════════════════════════════

def load_water_model(
    in_channels: int | None = None,
    checkpoint: str | None = None,
) -> UNetWater:
    cfg = CFG["models"]["water_segmentation"]
    in_ch = in_channels or cfg["in_channels"]
    model = UNetWater(
        in_channels=in_ch,
        base_filters=cfg["base_filters"],
        depth=cfg["depth"],
    )
    ckpt = checkpoint or cfg["checkpoint"]
    if Path(ckpt).exists():
        model.load_state_dict(torch.load(ckpt, map_location="cpu"))
        print(f"  Loaded water model from {ckpt}")
    model.eval()
    return model


def predict_water_unet(model: UNetWater, composite: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    """Run U-Net inference on a (C, H, W) composite.

    composite should contain the bands the model was trained on
    (e.g. Green, NIR, SWIR1, NDWI -> first 4 bands).
    """
    # Take first C channels
    n_ch = model.enc[0].block[0].in_channels
    arr = composite[:n_ch].astype(np.float32)

    # (1, C, H, W)
    tensor = torch.from_numpy(arr).unsqueeze(0)
    with torch.no_grad():
        logits = model(tensor)
    prob = torch.sigmoid(logits).squeeze().numpy()
    return (prob >= threshold).astype(np.uint8)


# ══════════════════════════════════════════════════════════════════
#  Change Detection
# ══════════════════════════════════════════════════════════════════

def water_change(mask_t1: np.ndarray, mask_t2: np.ndarray) -> dict:
    """Compute water body change between two binary masks.

    Returns dict with:
      - gained: pixels that became water
      - lost:   pixels that stopped being water
      - stable: pixels that stayed water
      - change_map: int8 image (-1=lost, 0=no-change, 1=gained)
      - stats: area statistics
    """
    gained = (mask_t2 == 1) & (mask_t1 == 0)
    lost = (mask_t2 == 0) & (mask_t1 == 1)
    stable = (mask_t2 == 1) & (mask_t1 == 1)

    change_map = np.zeros_like(mask_t1, dtype=np.int8)
    change_map[gained] = 1
    change_map[lost] = -1

    pixel_area = CFG["data"]["resolution"] ** 2  # m²
    total = mask_t1.size
    stats = {
        "gained_pixels": int(gained.sum()),
        "lost_pixels": int(lost.sum()),
        "stable_pixels": int(stable.sum()),
        "gained_area_ha": round(gained.sum() * pixel_area / 1e4, 2),
        "lost_area_ha": round(lost.sum() * pixel_area / 1e4, 2),
        "net_change_ha": round((gained.sum() - lost.sum()) * pixel_area / 1e4, 2),
    }
    return {"gained": gained, "lost": lost, "stable": stable, "change_map": change_map, "stats": stats}


def water_anomaly_score(mask_stack: list[np.ndarray]) -> np.ndarray:
    """Per-pixel anomaly score based on std-dev of water presence over time.

    Higher score = more temporal instability (potential anomaly).
    """
    stack = np.stack(mask_stack, axis=0).astype(np.float32)
    return np.std(stack, axis=0)


# ══════════════════════════════════════════════════════════════════
#  Temporal Water Extent Time-Series
# ══════════════════════════════════════════════════════════════════

def water_extent_ts(masks: list[np.ndarray], dates: list[str]) -> list[dict]:
    """Compute total water extent (ha) per date."""
    pixel_area = CFG["data"]["resolution"] ** 2
    records = []
    for mask, date in zip(masks, dates):
        area_ha = round(mask.sum() * pixel_area / 1e4, 2)
        records.append({"date": date, "water_extent_ha": area_ha})
    return records


# ══════════════════════════════════════════════════════════════════
#  Save helpers
# ══════════════════════════════════════════════════════════════════

def save_water_mask(mask: np.ndarray, profile: dict, out_path: str) -> str:
    p = profile.copy()
    p.update(count=1, dtype="uint8", compress="lzw", nodata=255)
    with rasterio.open(out_path, "w", **p) as dst:
        dst.write(mask, 1)
    return out_path


def save_change_map(change: np.ndarray, profile: dict, out_path: str) -> str:
    p = profile.copy()
    p.update(count=1, dtype="int8", compress="lzw", nodata=0)
    with rasterio.open(out_path, "w", **p) as dst:
        dst.write(change, 1)
    return out_path
