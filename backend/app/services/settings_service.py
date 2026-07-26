from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.core.config import settings as runtime_settings
from app.repositories.setting import SettingRepository
from app.schemas.settings import (
    NamingRulesSettingsValue,
    SQLRulesSettingsValue,
    SMTPSettingsValue,
    ScannerRulesSettingsValue,
    SettingsEnvelope,
    SupabaseSettingsValue,
    SystemSettingsValue,
    ThemeSettingsValue,
    XQueryRulesSettingsValue,
)

SETTINGS_KEY = "preferences"


def default_settings_envelope() -> SettingsEnvelope:
    return SettingsEnvelope(
        supabase=SupabaseSettingsValue(
            project_url=runtime_settings.supabase_project_url or "",
            anon_key_hint="Configured" if runtime_settings.supabase_anon_key else "",
            service_role_key_hint="Configured" if runtime_settings.supabase_service_role_key else "",
            jwt_secret_configured=bool(runtime_settings.supabase_jwt_secret),
            database_url_configured=bool(runtime_settings.supabase_db_url),
        ),
        smtp=SMTPSettingsValue(),
        naming_rules=NamingRulesSettingsValue(),
        scanner_rules=ScannerRulesSettingsValue(
            persist_raw_responses=True,
            schema_compare_after_scan=True,
        ),
        theme=ThemeSettingsValue(),
        xquery_rules=XQueryRulesSettingsValue(),
        sql_rules=SQLRulesSettingsValue(),
        system_settings=SystemSettingsValue(
            scheduler_enabled=runtime_settings.scheduler_enabled,
        ),
    )


def _envelope_to_storage_map(envelope: SettingsEnvelope) -> dict[str, dict[str, Any]]:
    return {
        "supabase": envelope.supabase.model_dump(mode="json"),
        "smtp": envelope.smtp.model_dump(mode="json"),
        "naming_rules": envelope.naming_rules.model_dump(mode="json"),
        "scanner_rules": envelope.scanner_rules.model_dump(mode="json"),
        "theme": envelope.theme.model_dump(mode="json"),
        "xquery_rules": envelope.xquery_rules.model_dump(mode="json"),
        "sql_rules": envelope.sql_rules.model_dump(mode="json"),
        "system_settings": envelope.system_settings.model_dump(mode="json"),
    }


async def load_user_settings(repository: SettingRepository, user_id) -> SettingsEnvelope:  # noqa: ANN001
    defaults = default_settings_envelope()
    merged: dict[str, Any] = _envelope_to_storage_map(defaults)

    stored_rows = await repository.list_for_user(user_id)
    for row in stored_rows:
        if row.key != SETTINGS_KEY or row.category not in merged:
            continue
        current = deepcopy(merged[row.category])
        current.update(row.value or {})
        merged[row.category] = current

    return SettingsEnvelope(
        supabase=SupabaseSettingsValue.model_validate(merged["supabase"]),
        smtp=SMTPSettingsValue.model_validate(merged["smtp"]),
        naming_rules=NamingRulesSettingsValue.model_validate(merged["naming_rules"]),
        scanner_rules=ScannerRulesSettingsValue.model_validate(merged["scanner_rules"]),
        theme=ThemeSettingsValue.model_validate(merged["theme"]),
        xquery_rules=XQueryRulesSettingsValue.model_validate(merged["xquery_rules"]),
        sql_rules=SQLRulesSettingsValue.model_validate(merged["sql_rules"]),
        system_settings=SystemSettingsValue.model_validate(merged["system_settings"]),
    )


async def save_user_settings(repository: SettingRepository, user_id, envelope: SettingsEnvelope) -> SettingsEnvelope:  # noqa: ANN001
    values = _envelope_to_storage_map(envelope)
    for category, value in values.items():
        row = await repository.get_for_user(user_id, category=category, key=SETTINGS_KEY)
        if row is None:
            await repository.create(
                user_id=user_id,
                category=category,
                key=SETTINGS_KEY,
                value=value,
                description=f"{category.replace('_', ' ').title()} settings",
            )
            continue
        row.value = value
        row.description = f"{category.replace('_', ' ').title()} settings"
        await repository.session.flush()
    return envelope
