"""
Output generation:
  - Temporal maps (GeoTIFF + PNG before/after)
  - Animated GIFs of NDVI / water extent over time
  - Anomaly scorecards (summary tables)
  - Per-location PDF reports
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.patches import Patch
import rasterio
from rasterio.transform import from_bounds
import imageio.v2 as imageio

from src.config import load_config

CFG = load_config()


# ══════════════════════════════════════════════════════════════════
#  Colour maps
# ══════════════════════════════════════════════════════════════════

STRESS_CMAP = mcolors.ListedColormap(["#d73027", "#fee08b", "#1a9850", "#ffffff"])
STRESS_LABELS = ["Severe", "Moderate", "Healthy", "No Vegetation"]

WATER_CMAP = mcolors.ListedColormap(["#f0f0f0", "#2166ac"])
WATER_LABELS = ["Non-water", "Water"]

CHANGE_CMAP = mcolors.ListedColormap(["#d73027", "#f0f0f0", "#4575b4"])
CHANGE_LABELS = ["Lost", "No Change", "Gained"]

ANOMALY_CMAP = "RdYlGn_r"  # red = high anomaly


# ══════════════════════════════════════════════════════════════════
#  Static maps
# ══════════════════════════════════════════════════════════════════

def plot_stress_map(stress: np.ndarray, date: str, out_path: str) -> str:
    fig, ax = plt.subplots(figsize=(10, 10))
    im = ax.imshow(stress, cmap=STRESS_CMAP, vmin=0, vmax=3)
    ax.set_title(f"Vegetation Stress — {date}", fontsize=14, fontweight="bold")
    ax.axis("off")
    legend_elements = [Patch(facecolor=c, label=l) for c, l in zip(STRESS_CMAP.colors, STRESS_LABELS)]
    ax.legend(handles=legend_elements, loc="lower right", fontsize=10)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_water_map(mask: np.ndarray, date: str, out_path: str) -> str:
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.imshow(mask, cmap=WATER_CMAP, vmin=0, vmax=1)
    ax.set_title(f"Water Body Extent — {date}", fontsize=14, fontweight="bold")
    ax.axis("off")
    legend_elements = [Patch(facecolor=c, label=l) for c, l in zip(WATER_CMAP.colors, WATER_LABELS)]
    ax.legend(handles=legend_elements, loc="lower right", fontsize=10)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_change_map(change: np.ndarray, date1: str, date2: str, out_path: str) -> str:
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.imshow(change, cmap=CHANGE_CMAP, vmin=-1, vmax=1)
    ax.set_title(f"Water Change: {date1} -> {date2}", fontsize=14, fontweight="bold")
    ax.axis("off")
    legend_elements = [Patch(facecolor=c, label=l) for c, l in zip(CHANGE_CMAP.colors, CHANGE_LABELS)]
    ax.legend(handles=legend_elements, loc="lower right", fontsize=10)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_anomaly_heatmap(scores: np.ndarray, out_path: str, title: str = "Anomaly Score Map") -> str:
    fig, ax = plt.subplots(figsize=(10, 10))
    im = ax.imshow(scores, cmap=ANOMALY_CMAP, vmin=0, vmax=1)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.axis("off")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Anomaly Score")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_ndvi_timeseries(dates: list[str], ndvi_means: list[float], out_path: str) -> str:
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(range(len(dates)), ndvi_means, "o-", color="#1a9850", linewidth=2, markersize=4)
    ax.set_xticks(range(len(dates)))
    ax.set_xticklabels(dates, rotation=45, ha="right", fontsize=8)
    ax.set_ylabel("Mean NDVI")
    ax.set_title("NDVI Temporal Profile", fontsize=14, fontweight="bold")
    ax.axhline(y=0.4, color="green", linestyle="--", alpha=0.5, label="Healthy threshold")
    ax.axhline(y=0.2, color="red", linestyle="--", alpha=0.5, label="Stress threshold")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


# ══════════════════════════════════════════════════════════════════
#  Animated GIF
# ══════════════════════════════════════════════════════════════════

def create_animation(
    image_arrays: list[np.ndarray],
    dates: list[str],
    out_path: str,
    cmap_name: str = "RdYlGn",
    vmin: float = -0.2,
    vmax: float = 1.0,
    fps: int = 2,
) -> str:
    frames = []
    for arr, date in zip(image_arrays, dates):
        fig, ax = plt.subplots(figsize=(8, 8))
        im = ax.imshow(arr, cmap=cmap_name, vmin=vmin, vmax=vmax)
        ax.set_title(f"NDVI — {date}", fontsize=13, fontweight="bold")
        ax.axis("off")
        fig.tight_layout()

        fig.canvas.draw()
        try:
            buf = np.asarray(fig.canvas.buffer_rgba())[:, :, :3]
        except Exception:
            w, h = fig.canvas.get_width_height()
            buf = np.frombuffer(fig.canvas.tostring_rgb(), dtype=np.uint8).reshape(h, w, 3)
        frames.append(buf)
        plt.close(fig)

    duration = 1.0 / fps
    imageio.mimsave(out_path, frames, duration=duration, loop=0)
    return out_path


# ══════════════════════════════════════════════════════════════════
#  Anomaly Scorecard (JSON + text)
# ══════════════════════════════════════════════════════════════════

def build_anomaly_scorecard(
    stress_summary: dict,
    water_summary: dict,
    anomaly_stats: dict,
    water_change_stats: list[dict],
    dates: list[str],
) -> dict:
    card = {
        "region": CFG["project"]["region"],
        "satellite": CFG["data"]["satellite"],
        "date_range": f"{dates[0]} -> {dates[-1]}" if dates else "N/A",
        "total_composites": len(dates),
        "vegetation": stress_summary,
        "water_bodies": water_summary,
        "anomaly_detection": anomaly_stats,
        "change_events": water_change_stats,
    }
    return card


def save_scorecard(card: dict, out_path: str) -> str:
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2, default=str)
    # Also a text version
    txt_path = out_path.replace(".json", ".txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write("  KRIDSHDRISTI — Anomaly Scorecard\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Region    : {card['region']}\n")
        f.write(f"Satellite : {card['satellite']}\n")
        f.write(f"Period    : {card['date_range']}\n")
        f.write(f"Composites: {card['total_composites']}\n\n")
        f.write("--- Vegetation Stress Summary ---\n")
        for k, v in card["vegetation"].items():
            f.write(f"  {k}: {v}\n")
        f.write("\n--- Water Body Summary ---\n")
        for k, v in card["water_bodies"].items():
            f.write(f"  {k}: {v}\n")
        f.write("\n--- Anomaly Detection ---\n")
        for k, v in card["anomaly_detection"].items():
            f.write(f"  {k}: {v}\n")
        f.write("\n--- Change Events ---\n")
        for evt in card.get("change_events", []):
            f.write(f"  {evt.get('date1', '?')} -> {evt.get('date2', '?')}: "
                    f"net={evt.get('net_change_ha', '?')} ha\n")
        f.write("\n" + "=" * 60 + "\n")
    return txt_path


# ══════════════════════════════════════════════════════════════════
#  PDF Report (uses reportlab)
# ══════════════════════════════════════════════════════════════════

def generate_pdf_report(
    card: dict,
    map_image_paths: list[str],
    out_path: str,
) -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors

    doc = SimpleDocTemplate(out_path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph("KRIDSHDRISTI — Satellite Monitoring Report", styles["Title"]))
    story.append(Spacer(1, 0.3 * inch))

    # Metadata
    meta = [
        ["Region", card.get("region", "N/A")],
        ["Satellite", card.get("satellite", "N/A")],
        ["Period", card.get("date_range", "N/A")],
        ["Composites", str(card.get("total_composites", 0))],
    ]
    t = Table(meta, colWidths=[1.5 * inch, 4 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e0e0e0")),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * inch))

    # Vegetation section
    story.append(Paragraph("Vegetation Stress", styles["Heading2"]))
    for k, v in card.get("vegetation", {}).items():
        story.append(Paragraph(f"<b>{k}:</b> {v}", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # Water section
    story.append(Paragraph("Water Bodies", styles["Heading2"]))
    for k, v in card.get("water_bodies", {}).items():
        story.append(Paragraph(f"<b>{k}:</b> {v}", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # Anomaly section
    story.append(Paragraph("Anomaly Detection", styles["Heading2"]))
    for k, v in card.get("anomaly_detection", {}).items():
        story.append(Paragraph(f"<b>{k}:</b> {v}", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # Maps
    story.append(Paragraph("Maps", styles["Heading2"]))
    for img_path in map_image_paths:
        if Path(img_path).exists():
            story.append(Image(img_path, width=5.5 * inch, height=5.5 * inch))
            story.append(Spacer(1, 0.2 * inch))

    doc.build(story)
    return out_path
