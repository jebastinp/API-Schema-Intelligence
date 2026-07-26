from datetime import UTC, datetime

from app.schemas.api_connection import APIConnectionCreate
from app.services.scheduled_scans import build_schedule_fields, compute_next_scheduled_scan_at


def test_compute_next_daily_schedule_rolls_forward_after_cutoff():
    reference = datetime(2026, 7, 25, 22, 30, tzinfo=UTC)

    next_run = compute_next_scheduled_scan_at(
        frequency="daily",
        reference_time=reference,
        schedule_time_utc="21:15",
    )

    assert next_run == datetime(2026, 7, 26, 21, 15, tzinfo=UTC)


def test_compute_next_weekly_schedule_uses_requested_weekday():
    reference = datetime(2026, 7, 25, 10, 0, tzinfo=UTC)  # Saturday

    next_run = compute_next_scheduled_scan_at(
        frequency="weekly",
        reference_time=reference,
        schedule_time_utc="09:00",
        schedule_day_of_week=0,
    )

    assert next_run == datetime(2026, 7, 27, 9, 0, tzinfo=UTC)


def test_build_schedule_fields_clears_next_run_for_manual_connections():
    payload = APIConnectionCreate(
        name="SuccessFactors",
        base_url="https://example.com/odata/v2/User",
        authentication_type="oauth2_client_credentials",
        headers={},
        status="active",
        scan_frequency="manual",
        schedule_time_utc=None,
    )

    fields = build_schedule_fields(payload, reference_time=datetime(2026, 7, 25, 8, 0, tzinfo=UTC))

    assert fields["next_scheduled_scan_at"] is None
