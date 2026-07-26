from types import SimpleNamespace

import pytest

from app.services.settings_service import SETTINGS_KEY, load_user_settings, save_user_settings


class FakeSettingRepository:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.created: list[SimpleNamespace] = []
        self.session = SimpleNamespace(flush=self._flush)

    async def _flush(self):
        return None

    async def list_for_user(self, user_id):  # noqa: ANN001
        return [row for row in self.rows if row.user_id == user_id]

    async def get_for_user(self, user_id, *, category: str, key: str):  # noqa: ANN001
        for row in self.rows:
            if row.user_id == user_id and row.category == category and row.key == key:
                return row
        return None

    async def create(self, **kwargs):
        row = SimpleNamespace(**kwargs)
        self.rows.append(row)
        self.created.append(row)
        return row


@pytest.mark.asyncio
async def test_load_user_settings_merges_defaults_with_saved_rows():
    repository = FakeSettingRepository(
        rows=[
            SimpleNamespace(
                user_id="user-1",
                category="theme",
                key=SETTINGS_KEY,
                value={"mode": "dark", "compact_density": True},
            ),
            SimpleNamespace(
                user_id="user-1",
                category="scanner_rules",
                key=SETTINGS_KEY,
                value={"default_page_size": 500},
            ),
        ]
    )

    settings = await load_user_settings(repository, "user-1")

    assert settings.theme.mode == "dark"
    assert settings.theme.compact_density is True
    assert settings.scanner_rules.default_page_size == 500
    assert settings.sql_rules.dialect == "postgresql"


@pytest.mark.asyncio
async def test_save_user_settings_creates_missing_rows():
    repository = FakeSettingRepository()
    settings = await load_user_settings(repository, "user-1")
    settings.smtp.host = "smtp.example.com"
    settings.system_settings.environment_label = "Enterprise"

    saved = await save_user_settings(repository, "user-1", settings)

    assert saved.smtp.host == "smtp.example.com"
    categories = {row.category for row in repository.rows}
    assert "smtp" in categories
    assert "system_settings" in categories
