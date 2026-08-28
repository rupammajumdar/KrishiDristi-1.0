"""
Evaluation metrics for segmentation and anomaly detection.

Metrics:
  - IoU (Intersection over Union) — for water body segmentation
  - Precision / Recall / F1 — for anomaly flags
  - OA (Overall Accuracy) & Kappa — for stress classification
  - MSE / MAE — for reconstruction quality
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    cohen_kappa_score,
    accuracy_score,
)


# ── Segmentation metrics ─────────────────────────────────────────

def intersection_over_union(pred: np.ndarray, gt: np.ndarray) -> float:
    """Binary IoU (water vs non-water)."""
    pred = pred.astype(bool)
    gt = gt.astype(bool)
    inter = (pred & gt).sum()
    union = (pred | gt).sum()
    if union == 0:
        return 1.0  # both empty
    return float(inter / union)


def dice_coefficient(pred: np.ndarray, gt: np.ndarray) -> float:
    pred = pred.astype(bool)
    gt = gt.astype(bool)
    inter = (pred & gt).sum()
    denom = pred.sum() + gt.sum()
    if denom == 0:
        return 1.0
    return float(2 * inter / denom)


def pixel_accuracy(pred: np.ndarray, gt: np.ndarray) -> float:
    return float((pred == gt).sum() / gt.size)


# ── Anomaly detection metrics ────────────────────────────────────

def anomaly_precision_recall_f1(
    pred_anomaly: np.ndarray,
    gt_anomaly: np.ndarray,
) -> dict:
    """pred_anomaly / gt_anomaly: boolean arrays."""
    p = precision_score(gt_anomaly, pred_anomaly, zero_division=0)
    r = recall_score(gt_anomaly, pred_anomaly, zero_division=0)
    f1 = f1_score(gt_anomaly, pred_anomaly, zero_division=0)
    return {"precision": round(p, 4), "recall": round(r, 4), "f1": round(f1, 4)}


def anomaly_auc(scores: np.ndarray, gt_anomaly: np.ndarray) -> float | None:
    """Compute AUC-ROC if sklearn roc_auc_score is available."""
    try:
        from sklearn.metrics import roc_auc_score
        return round(float(roc_auc_score(gt_anomaly.astype(int), scores)), 4)
    except Exception:
        return None


# ── Classification metrics ───────────────────────────────────────

def classification_report(pred: np.ndarray, gt: np.ndarray) -> dict:
    """Multi-class classification report for stress levels."""
    labels = [0, 1, 2]  # severe, moderate, healthy (exclude no-veg=3)
    names = ["severe_stress", "moderate_stress", "healthy"]
    oa = accuracy_score(gt, pred)
    kappa = cohen_kappa_score(gt, pred)
    cm = confusion_matrix(gt, pred, labels=labels).tolist()

    per_class = {}
    for i, name in enumerate(names):
        tp = cm[i][i]
        row_sum = sum(cm[i])
        col_sum = sum(r[i] for r in cm)
        per_class[name] = {
            "support": int(row_sum),
            "recall": round(tp / row_sum, 4) if row_sum > 0 else 0.0,
            "precision": round(tp / col_sum, 4) if col_sum > 0 else 0.0,
        }

    return {
        "overall_accuracy": round(oa, 4),
        "kappa": round(kappa, 4),
        "confusion_matrix": cm,
        "per_class": per_class,
    }


# ── Reconstruction quality ──────────────────────────────────────

def reconstruction_mse(original: np.ndarray, reconstructed: np.ndarray) -> float:
    return float(np.mean((original - reconstructed) ** 2))


def reconstruction_mae(original: np.ndarray, reconstructed: np.ndarray) -> float:
    return float(np.mean(np.abs(original - reconstructed)))


# ── Comprehensive evaluation ────────────────────────────────────

def evaluate_water_segmentation(
    pred_masks: list[np.ndarray],
    gt_masks: list[np.ndarray],
    dates: list[str] | None = None,
) -> dict:
    """Evaluate water segmentation across multiple time steps."""
    ious, dices, accs = [], [], []
    per_step = []

    for i, (pred, gt) in enumerate(zip(pred_masks, gt_masks)):
        iou = intersection_over_union(pred, gt)
        dice = dice_coefficient(pred, gt)
        acc = pixel_accuracy(pred, gt)
        ious.append(iou)
        dices.append(dice)
        accs.append(acc)
        step = {"iou": round(iou, 4), "dice": round(dice, 4), "pixel_acc": round(acc, 4)}
        if dates:
            step["date"] = dates[i]
        per_step.append(step)

    return {
        "mean_iou": round(np.mean(ious), 4),
        "mean_dice": round(np.mean(dices), 4),
        "mean_pixel_accuracy": round(np.mean(accs), 4),
        "per_step": per_step,
    }


def evaluate_anomaly_detection(
    pred_scores: np.ndarray,
    gt_anomaly: np.ndarray,
    threshold: float = 0.7,
) -> dict:
    pred_flags = pred_scores >= threshold
    metrics = anomaly_precision_recall_f1(pred_flags, gt_anomaly)
    metrics["auc_roc"] = anomaly_auc(pred_scores, gt_anomaly)
    metrics["threshold"] = threshold
    return metrics
