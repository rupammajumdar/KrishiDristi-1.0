"""
Time-series anomaly detection for vegetation health & water body extent.

Architecture options:
  - LSTM AutoEncoder  (recommended for limited GPU — reconstructs normal patterns)
  - 1D-CNN AutoEncoder (lighter alternative)
  - Statistical baseline (Z-score / IQR) as fallback

The LSTM-AE learns to reconstruct "normal" temporal sequences; high
reconstruction error = anomaly.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from src.config import load_config

CFG = load_config()


# ══════════════════════════════════════════════════════════════════
#  LSTM Auto-Encoder
# ══════════════════════════════════════════════════════════════════

class LSTMAutoEncoder(nn.Module):
    """Encoder: LSTM → latent; Decoder: LSTM → Linear → reconstructed sequence."""

    def __init__(self, input_dim: int, hidden_dim: int, num_layers: int, dropout: float = 0.2):
        super().__init__()
        self.seq_len = CFG["models"]["anomaly_detection"]["sequence_length"]

        # Encoder
        self.encoder = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )

        # Decoder
        self.decoder = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        self.fc = nn.Linear(hidden_dim, input_dim)

    def forward(self, x):
        # x: (batch, seq_len, input_dim)
        _, (z, _) = self.encoder(x)
        # Repeat latent for each decoder step
        dec_input = z[-1].unsqueeze(1).repeat(1, self.seq_len, 1)
        dec_out, _ = self.decoder(dec_input)
        recon = self.fc(dec_out)
        return recon


# ══════════════════════════════════════════════════════════════════
#  1D-CNN Auto-Encoder (lighter alternative)
# ══════════════════════════════════════════════════════════════════

class CNN1DAutoEncoder(nn.Module):
    def __init__(self, input_dim: int, latent_dim: int = 16):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv1d(input_dim, 32, 5, padding=2),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(32, 16, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.decoder = nn.Sequential(
            nn.Linear(16, 32 * 6),
            nn.ReLU(),
            nn.Unflatten(1, (32, 6)),
            nn.ConvTranspose1d(32, input_dim, 4, stride=2, padding=1),
        )

    def forward(self, x):
        # x: (B, seq, features) → transpose for Conv1d: (B, features, seq)
        z = self.encoder(x.transpose(1, 2))
        recon = self.decoder(z).transpose(1, 2)
        return recon[:, :x.size(1), :]


# ══════════════════════════════════════════════════════════════════
#  Data preparation
# ══════════════════════════════════════════════════════════════════

def build_pixel_ts(index_stack: np.ndarray) -> np.ndarray:
    """Convert a (T, H, W) index stack to (N_pixels, T) per-pixel time-series."""
    T, H, W = index_stack.shape
    return index_stack.reshape(T, -1).T  # (H*W, T)


def build_sequences(ts: np.ndarray, seq_len: int) -> np.ndarray:
    """Slide a window of *seq_len* over each pixel time-series.

    If ts is (T,): returns (T - seq_len + 1, seq_len, 1)
    If ts is (N_pixels, T): returns (N_pixels * (T - seq_len + 1), seq_len, 1)
    """
    if ts.ndim == 1:
        T = len(ts)
        if T < seq_len:
            return np.empty((0, seq_len, 1), dtype=np.float32)
        starts = np.arange(0, T - seq_len + 1)
        seqs = np.stack([ts[s : s + seq_len, np.newaxis] for s in starts])
        return seqs.astype(np.float32)
    elif ts.ndim == 2:
        N_pixels, T = ts.shape
        if T < seq_len:
            return np.empty((0, seq_len, 1), dtype=np.float32)
        num_windows = T - seq_len + 1
        seqs_list = []
        for s in range(num_windows):
            window = ts[:, s : s + seq_len, np.newaxis]  # (N_pixels, seq_len, 1)
            seqs_list.append(window)
        return np.concatenate(seqs_list, axis=0).astype(np.float32)
    return np.empty((0, seq_len, 1), dtype=np.float32)


# ══════════════════════════════════════════════════════════════════
#  Training
# ══════════════════════════════════════════════════════════════════

def train_anomaly_model(
    normal_sequences: np.ndarray,
    val_split: float = 0.2,
    save_path: str | None = None,
    model_type: str = "lstm",
    epochs: int | None = None,
    lr: float | None = None,
    batch_size: int | None = None,
    device: str = "auto",
) -> nn.Module:
    """Train an autoencoder on normal (non-anomalous) sequences.

    normal_sequences: (N, seq_len, features)
    """
    cfg = CFG["models"]["anomaly_detection"]
    train_cfg = CFG["training"]

    input_dim = normal_sequences.shape[-1]
    epochs = epochs or train_cfg["epochs"]
    lr = lr or train_cfg["learning_rate"]
    batch_size = batch_size or train_cfg["batch_size"]

    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"

    if model_type == "lstm":
        model = LSTMAutoEncoder(
            input_dim=input_dim,
            hidden_dim=cfg["hidden_dim"],
            num_layers=cfg["num_layers"],
            dropout=cfg["dropout"],
        )
    else:
        model = CNN1DAutoEncoder(input_dim=input_dim)

    model = model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()

    # Split
    n = len(normal_sequences)
    idx = np.random.permutation(n)
    split = int(n * (1 - val_split))
    train_idx, val_idx = idx[:split], idx[split:]

    train_ds = TensorDataset(torch.from_numpy(normal_sequences[train_idx]))
    val_ds = TensorDataset(torch.from_numpy(normal_sequences[val_idx]))
    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=batch_size)

    best_val = float("inf")
    patience = train_cfg["early_stopping_patience"]
    wait = 0

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0
        for (batch,) in train_dl:
            batch = batch.to(device)
            recon = model(batch)
            loss = criterion(recon, batch)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch.size(0)

        model.eval()
        val_loss = 0
        with torch.no_grad():
            for (batch,) in val_dl:
                batch = batch.to(device)
                recon = model(batch)
                val_loss += criterion(recon, batch).item() * batch.size(0)

        train_loss /= len(train_ds)
        val_loss /= len(val_ds)

        if epoch % 5 == 0 or epoch == 1:
            print(f"  Epoch {epoch:3d}/{epochs}  train_loss={train_loss:.6f}  val_loss={val_loss:.6f}")

        if val_loss < best_val:
            best_val = val_loss
            wait = 0
            if save_path:
                Path(save_path).parent.mkdir(parents=True, exist_ok=True)
                torch.save(model.state_dict(), save_path)
        else:
            wait += 1
            if wait >= patience:
                print(f"  Early stopping at epoch {epoch}")
                break

    return model


# ══════════════════════════════════════════════════════════════════
#  Inference & Anomaly Scoring
# ══════════════════════════════════════════════════════════════════

def compute_anomaly_scores(
    model: nn.Module,
    sequences: np.ndarray,
    H: int,
    W: int,
    seq_len: int = 12,
    device: str = "cpu",
) -> np.ndarray:
    """Compute per-pixel anomaly scores (MSE reconstruction error) -> (H, W).

    sequences: (H*W, seq_len, 1) or (N, seq_len, D)
    """
    model.eval()
    N = len(sequences)
    tensor = torch.from_numpy(sequences).to(device)
    errors = []

    with torch.no_grad():
        for i in range(0, N, 1024):
            batch = tensor[i : i + 1024]
            recon = model(batch)
            err = ((recon - batch) ** 2).mean(dim=(1, 2)).cpu().numpy()
            errors.append(err)

    all_errors = np.concatenate(errors, axis=0) if errors else np.zeros((H * W,))
    if len(all_errors) == H * W:
        scores = all_errors.reshape(H, W).astype(np.float32)
    else:
        scores = np.zeros((H, W), dtype=np.float32)
        scores.flat[:len(all_errors)] = all_errors

    smin, smax = float(scores.min()), float(scores.max())
    if smax > smin:
        scores = (scores - smin) / (smax - smin)
    return scores


def detect_anomalies_statistical(
    ts: np.ndarray,
    z_threshold: float = 3.0,
) -> np.ndarray:
    """Fallback: Z-score based anomaly detection.

    ts: (T, N_pixels)
    Returns boolean anomaly mask (N_pixels,).
    """
    mean = np.mean(ts, axis=0)
    std = np.std(ts, axis=0) + 1e-8
    z = np.abs((ts - mean) / std)
    return z.max(axis=0) > z_threshold


# ══════════════════════════════════════════════════════════════════
#  Anomaly Report
# ══════════════════════════════════════════════════════════════════

def anomaly_summary(scores: np.ndarray, threshold: float = 0.7) -> dict:
    """Summarize anomalies from a score map."""
    anomaly_mask = scores >= threshold
    total_pixels = scores.size
    anomaly_pixels = anomaly_mask.sum()
    return {
        "total_pixels": int(total_pixels),
        "anomaly_pixels": int(anomaly_pixels),
        "anomaly_fraction": round(anomaly_pixels / total_pixels, 4),
        "mean_score": round(float(scores.mean()), 4),
        "max_score": round(float(scores.max()), 4),
        "threshold": threshold,
    }
