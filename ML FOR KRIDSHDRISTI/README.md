# KRIDSHDRISTI — Satellite-based Agricultural & Water Resource Monitoring

**Smart India Hackathon PS 85**

End-to-end ML pipeline for monitoring crop health and water body changes using multi-temporal satellite imagery (Sentinel-2 / Landsat-8 / MODIS).

## Architecture

```
Raw Satellite Tiles (GeoTIFF)
         │
         ▼
┌──────────────────────┐
│  DATA INGESTION &    │  Cloud masking, reprojection (UTM-43N),
│  PREPROCESSING       │  resampling, temporal compositing
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐ ┌──────────┐
│ NDVI /   │ │ NDWI /   │
│ EVI      │ │ MNDWI    │
└────┬─────┘ └────┬─────┘
     │            │
     ▼            ▼
┌──────────┐ ┌──────────────┐
│ STRESS   │ │ WATER BODY   │  U-Net segmentation or
│ CLASSIFY │ │ SEGMENTATION │  NDWI threshold fallback
│ (RF)     │ └──────┬───────┘
└────┬─────┘        │
     │              ▼
     │       ┌──────────────┐
     │       │ CHANGE       │  Per-pixel binary change +
     │       │ DETECTION    │  area statistics
     │       └──────┬───────┘
     │              │
     ▼              ▼
┌────────────────────────────┐
│  LSTM AUTOENCODER          │  Reconstruction error = anomaly
│  ANOMALY DETECTION         │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  OUTPUTS                   │
│  • Temporal maps (GeoTIFF) │
│  • Before/after PNGs       │
│  • Animated NDVI GIF       │
│  • Anomaly scorecard       │
│  • Per-location PDF report │
└────────────────────────────┘
```

## Model Recommendations

| Component | Architecture | Why | GPU Needed |
|-----------|-------------|-----|-----------|
| Water Segmentation | **U-Net** (32 base filters, 4 depth) | Lightweight, works on Colab free-tier; captures water boundaries | CPU OK, GPU faster |
| Vegetation Stress | **Threshold + Random Forest** | Interpretable, no GPU needed, works with small datasets | No GPU |
| Anomaly Detection | **LSTM AutoEncoder** | Learns normal patterns; reconstruction error = anomaly score | CPU OK |
| Alternative (more data) | **Temporal Transformer** | Better for long sequences (>50 steps) but needs more GPU | GPU required |

**For limited GPU (free Colab):** The current threshold + RF + U-Net + LSTM stack trains in <30 min on CPU.

## Evaluation Metrics

| Task | Metric | Formula |
|------|--------|---------|
| Water Segmentation | **IoU** | TP / (TP + FP + FN) |
| Water Segmentation | **Dice** | 2*TP / (2*TP + FP + FN) |
| Anomaly Detection | **Precision / Recall / F1** | Standard |
| Anomaly Detection | **AUC-ROC** | ROC curve area |
| Stress Classification | **OA & Kappa** | Overall agreement |

## Project Structure

```
ML FOR KRIDSHDRISTI/
├── configs/
│   └── config.yaml            # All hyperparameters & paths
├── src/
│   ├── config.py              # Config loader
│   ├── data_pipeline.py       # Ingestion, cloud masking, compositing
│   ├── vegetation_stress.py   # NDVI/NDWI/EVI + stress classification
│   ├── water_body.py          # U-Net, NDWI mask, change detection
│   ├── anomaly_detection.py   # LSTM-AE, statistical anomaly detection
│   ├── output_generation.py   # Maps, animations, PDF reports
│   ├── evaluation.py          # IoU, Dice, Precision/Recall, Kappa
│   ├── pipeline.py            # Full orchestrator
│   └── train.py               # Model training script
├── data/
│   ├── raw/                   # Place satellite tiles here
│   ├── processed/
│   └── ground_truth/          # Optional: GT labels for evaluation
├── outputs/
│   ├── maps/                  # GeoTIFFs, PNGs, GIFs
│   ├── reports/               # Scorecard JSON + PDF
│   └── anomalies/             # Anomaly heatmaps
├── checkpoints/               # Saved model weights
├── requirements.txt
└── README.md
```

## Setup

```bash
pip install -r requirements.txt
```

## Usage

### 1. Place your data
Put satellite GeoTIFFs in `data/raw/`. Name convention: `{satellite}_{YYYYMMDD}_{band}.tif`
Example: `S2_20230612_B04.tif`, `S2_20230612_B08.tif`

### 2. Run the full pipeline
```bash
python -m src.pipeline --raw-dir data/raw --out-dir data/outputs
```

Or with specific dates:
```bash
python -m src.pipeline --raw-dir data/raw --out-dir data/outputs --dates 20230601 20230701 20230801
```

### 3. Train models (optional — pipeline works without training)
```bash
python -m src.train --mode all
```

### 4. Outputs
- `outputs/maps/stress_YYYYMMDD.tif` — Vegetation stress maps
- `outputs/maps/water_YYYYMMDD.tif` — Water body masks
- `outputs/maps/change_YYYYMMDD_YYYYMMDD.tif` — Change maps
- `outputs/maps/ndvi_timeseries.png` — NDVI temporal chart
- `outputs/maps/ndvi_animation.gif` — Animated NDVI over time
- `outputs/reports/anomaly_scorecard.json` — Summary statistics
- `outputs/reports/kridshdristi_report.pdf` — Full PDF report
- `outputs/anomalies/anomaly_scores.png` — Anomaly heatmap

## Data Sources

| Satellite | Bands Used | Resolution | Access |
|-----------|-----------|------------|--------|
| **Sentinel-2** | B02, B03, B04, B08, B11, B12 | 10m | Copernicus Open Access Hub |
| **Landsat-8** | B2, B3, B4, B5, B6, B7 | 30m | USGS EarthExplorer |
| **MODIS** | B1-B7 | 250m-1km | NASA Earthdata (for coarse resolution) |

## Configuration

Edit `configs/config.yaml` to:
- Change AOI bounding box
- Adjust cloud masking thresholds
- Tune stress classification thresholds
- Modify model hyperparameters
- Switch satellite source

## Credits

Built for Smart India Hackathon PS 85 — KRIDSHDRISTI
