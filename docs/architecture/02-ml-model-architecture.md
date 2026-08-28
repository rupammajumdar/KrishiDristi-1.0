# 02 — ML Model Architecture

The predictive core is implemented in `backend/app/services/ml_engine.py` and
trained offline in the `ML FOR KRIDSHDRISTI/` workspace. Three trained checkpoints
are loaded at runtime into a single `MLEngine` that also performs location-aware
yield regression, weather telemetry and SHAP-style explainability.

## 1. Model Inventory & Checkpoints

| Model | File | Framework | Purpose | Inputs |
|-------|------|-----------|---------|--------|
| Random Forest Vegetation Stress | `rf_stress.joblib` | scikit-learn | Stress class (0/1/2) | `[NDVI, NDWI, MNDWI, EVI]` |
| LSTM AutoEncoder | `lstm_anomaly_best.pth` | PyTorch | Temporal anomaly score (recon error) | NDVI time-series (12 steps) |
| U-Net Water Boundary | `unet_water_best.pth` | PyTorch | Water-body segmentation | 4-band satellite patch |
| Yield Regressor (location-aware) | built-in | algorithmic | kg/ha + change % | spectral + location + weather |

## 2. ML Engine DatalLow

```
Live Sentinel-2 indices  ──►  NDVI, NDWI, NDMI, MNDWI (satellite.py / GEE)
                                   │
                                   ▼
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
   run_rf_stress_inference              run_lstm_anomaly_inference
   (Random Forest, 4 features)          (LSTM AutoEncoder, 12-step NDVI)
        │  stress_class_id                    │  anomaly_score
        │  0=Severe,1=Mod,2=Healthy           │  anomaly_detected (>=0.40)
        ▼                                     ▼
   ┌──────────────────────────────────────────────────────────┐
   │            get_location_context(lat, lon,                │
   │                district, state)                          │
   │   → agro-climatic zone, soil type, KVK,                  │
   │     drought vuln, regional yield modifier                │
   └───────────────────────────┬──────────────────────────────┘
                               │ baseline = crop_yield × modifier
                               ▼
   Live OpenWeather ──► rainfall_mm, temp_c
                               │
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │  Yield Regressor (calibrated, condition-matched)         │
   │  predicted = baseline × NDVI_factor × NDWI_factor        │
   │             × temp_factor × stress_penalty × anomaly_pen │
   └───────────────────────────┬──────────────────────────────┘
                               ▼
            yield_change_pct, triggered_alert, feature_importance
```

## 3. Random Forest Stress Classifier (`run_rf_stress_inference`)

- Features: **`[NDVI, NDWI, MNDWI, EVI]`**. MNDWI = `NDWI - 0.08`, EVI = `NDVI × 0.82`.
- Model was trained with classes **{1 = moderate, 2 = healthy}** only (class 0 never
  existed in training data). Probabilities are mapped generically, then **overridden by
  spectral sanity thresholds** so the output is defensible:

```
IF  NDVI < 0.25  OR  NDWI < -0.30        → class 0 SEVERE   (p_severe ≥ 0.70)
ELIF NDVI ≥ 0.55 AND NDWI ≥ -0.15       → class 2 HEALTHY   (p_healthy ≥ 0.65)
ELSE                                     → class 1 MODERATE  (p_moderate ≥ 0.50)
```

- Output object: `stress_class_id`, `stress_label`, `probabilities`
  (`healthy / moderate_stress / severe_stress`, normalized to sum 1.0),
  `features_used`, `status_color`.

## 4. LSTM AutoEncoder Anomaly Detection (`run_lstm_anomaly_inference`)

- Architecture: **Encoder LSTM → latent → Decoder LSTM → Linear → reconstruction**.
  `input_dim=1, hidden_dim=64, num_layers=2, seq_len=12`.
- Reconstruction error → calibrated anomaly score: `anomaly_score = min(1, recon × 4.5)`.
- Anomaly is flagged when `anomaly_score >= 0.40`.
- When no historical sequence is provided, a smooth seasonal ramp ending at the
  current NDVI is synthesized so healthy fields stay in the normal range.
- Fallback (torch absent): statistical deviation from expected NDVI (0.52).

## 5. U-Net Water Body Segmentation

- Lightweight U-Net: `in_channels=4, base_filters=32, depth=4`
  (encoder `DoubleConv→MaxPool`, bottleneck, `ConvTranspose` upsample + skip links,
  final 1-ch sigmoid).
- Detects water bodies from multispectral patches; used for water-resource analysis.
- In degraded mode falls back to `NDWI`-based water delineation.

## 6. Calibrated Yield Regressor (`predict_yield`)

### 6.1 Baseline
`baseline = baseline_yields[crop] × regional_modifier`

Realistic **district-level average yields** (kg/ha), e.g. cotton 520, rice 2100,
wheat 2900, soybean 1050. Keeps predicted loss believable (avoids fake −80%).

### 6.2 Feature Factors (each measured against seasonal norm)
| Factor | Formula | Clamp |
|--------|---------|-------|
| NDVI factor | `mean_ndvi / norm_ndvi` | `[0.30, 1.25]` |
| NDWI factor | `1.0 + mean_ndwi × 0.8` | `[0.70, 1.15]` |
| Temp factor | `1.0 − \|temp − 27.5\| × 0.022` | `[0.75, 1.10]` |
| Stress penalty | severe=0.80, moderate=0.92, healthy=1.0 | — |
| Anomaly penalty | `1 − max(0, score − 0.40)` | `[0.85, 1.0]` |

> Rainfall is **not** a direct multiplier (NDVI/NDWI already integrate water stress;
> double-counting manufactured fake losses).

### 6.3 Outputs
- `predicted_yield_kg_ha`, `confidence_lower/upper` (±12%).
- `yield_change_pct` vs a condition-matched reference season.
- `triggered_alert` — only when vegetation is actually stressed:
  a healthy canopy (stress class 2) **never** triggers a drought alert, even if the
  LSTM score crosses its noisy threshold.
- `feature_importance` — SHAP-like, normalized to sum 1.0.
- `input_snapshot_json` — full input for explainability & audit (NDVI, NDWI, rainfall,
  temp, baseline, weather source, ML flags, RF/LSTM sub-results, location context).

## 7. Location Intelligence (`get_location_context`)

Coordinate- and name-driven routing to India's agro-climatic zones. Region matching
is **checked first by state/district name**, with coordinate boxes as a narrower
fallback (Chhattisgarh is prioritized before Madhya Pradesh so Raipur is not mislabelled).
Each region sets: `agro_zone`, `soil_type`, `KVK` hub, `drought_vulnerability`,
`regional_yield_modifier`. Examples:

| Region | soil | KVK | modifier |
|--------|------|-----|----------|
| Marathwada (Jalna) | Deep Black Cotton (Vertisols) | VNMKV Parbhani | 0.96 |
| Chhattisgarh (Raipur) | Red & Yellow (Alfisols) | IGKV Raipur | 1.05 |
| Punjab (Ludhiana) | Deep Alluvial Loam | PAU Ludhiana | 1.25 |

## 8. Model Registry & Versioning

- Per-crop active versions (e.g. `v1.2.0-rf-cotton`).
- `set_active_version()` allows swapping live models per crop.
- Prediction history persists model version + input snapshot for insurer/admin audit.

## 9. Consistency Contract (Score ⇄ Tasks ⇄ Backend)

The dashboard health score and the advisory tasks must agree. Backend returns exact
`ml_stress_classification` + `input_snapshot_json` (NDVI/NDWI); the frontend derives
its score from NDVI + yield and the task generator uses the **same risk level**,
so a healthy canopy shows "Optimal Vigor / maintenance" and a stressed canopy shows
urgent irrigation — never contradictory.
