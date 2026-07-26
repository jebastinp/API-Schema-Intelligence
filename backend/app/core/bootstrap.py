from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


@dataclass(frozen=True)
class RuntimeDirectoryStatus:
    name: str
    path: str
    exists: bool


def ensure_runtime_directories() -> list[RuntimeDirectoryStatus]:
    directories: list[tuple[str, Path]] = [
        ("logs", settings.log_path),
        ("uploads", settings.upload_path),
        ("exports", settings.export_path),
        ("generated", settings.project_root / "generated"),
        ("scan_cache", settings.scan_cache_path),
    ]
    statuses: list[RuntimeDirectoryStatus] = []
    for name, path in directories:
        path.mkdir(parents=True, exist_ok=True)
        statuses.append(RuntimeDirectoryStatus(name=name, path=str(path), exists=path.exists()))
    return statuses


def verify_runtime_configuration() -> None:
    settings.assert_runtime_configured()
