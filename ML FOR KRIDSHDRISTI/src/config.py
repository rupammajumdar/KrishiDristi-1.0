from pathlib import Path
import yaml


_ROOT = Path(__file__).resolve().parent.parent


def load_config(config_path: str | Path | None = None) -> dict:
    if config_path is None:
        config_path = _ROOT / "configs" / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


def get_project_root() -> Path:
    return _ROOT
