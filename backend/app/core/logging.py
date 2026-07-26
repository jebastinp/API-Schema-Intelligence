import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core.config import settings


def configure_logging(level: str = "INFO") -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    formatter = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")

    if root_logger.handlers:
        for handler in root_logger.handlers:
            handler.setLevel(root_logger.level)
            handler.setFormatter(formatter)
        return

    console_handler = logging.StreamHandler()
    console_handler.setLevel(root_logger.level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    log_file = Path(settings.log_path) / "schema-studio.log"
    file_handler = RotatingFileHandler(log_file, maxBytes=1_048_576, backupCount=5)
    file_handler.setLevel(root_logger.level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
