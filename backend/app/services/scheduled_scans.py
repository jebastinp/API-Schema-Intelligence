from __future__ import annotations

import asyncio
import calendar
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.api_connection import APIConnection
from app.models.scan_job import ScanJob
from app.repositories.api_connection import APIConnectionRepository
from app.schemas.api_connection import APIConnectionBase
from app.schemas.scan_job import ScanJobStartRequest
from app.services.scan_runtime import create_scan_job

logger = get_logger("app.scheduled_scans")
SCHEDULER_TASK: asyncio.Task[None] | None = None


@dataclass(frozen=True)
class ScheduleParts:
    hour: int
    minute: int


def parse_schedule_time_utc(value: str | None) -> ScheduleParts:
    if value in {None, ""}:
        return ScheduleParts(hour=0, minute=0)
    hour_text, minute_text = value.split(":")
    return ScheduleParts(hour=int(hour_text), minute=int(minute_text))


def compute_next_scheduled_scan_at(
    *,
    frequency: str,
    reference_time: datetime,
    schedule_time_utc: str | None,
    schedule_day_of_week: int | None = None,
    schedule_day_of_month: int | None = None,
) -> datetime | None:
    if frequency == "manual":
        return None

    reference = reference_time.astimezone(UTC)
    schedule_time = parse_schedule_time_utc(schedule_time_utc)
    candidate = reference.replace(
        hour=schedule_time.hour,
        minute=schedule_time.minute,
        second=0,
        microsecond=0,
    )

    if frequency == "daily":
        if candidate <= reference:
            candidate += timedelta(days=1)
        return candidate

    if frequency == "weekly":
        target_day = schedule_day_of_week if schedule_day_of_week is not None else 0
        delta_days = (target_day - reference.weekday()) % 7
        candidate = candidate + timedelta(days=delta_days)
        if candidate <= reference:
            candidate += timedelta(days=7)
        return candidate

    if frequency == "monthly":
        if schedule_day_of_month is None:
            schedule_day_of_month = 1

        year = reference.year
        month = reference.month
        while True:
            last_day = calendar.monthrange(year, month)[1]
            target_day = min(schedule_day_of_month, last_day)
            candidate = datetime(
                year,
                month,
                target_day,
                schedule_time.hour,
                schedule_time.minute,
                tzinfo=UTC,
            )
            if candidate > reference:
                return candidate
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1

    raise ValueError(f"Unsupported schedule frequency: {frequency}")


def build_schedule_fields(payload: APIConnectionBase, *, reference_time: datetime | None = None) -> dict[str, object]:
    now = (reference_time or datetime.now(UTC)).astimezone(UTC)
    return {
        "scan_frequency": payload.scan_frequency,
        "schedule_time_utc": payload.schedule_time_utc,
        "schedule_day_of_week": payload.schedule_day_of_week,
        "schedule_day_of_month": payload.schedule_day_of_month,
        "auto_compare_schemas": payload.auto_compare_schemas,
        "next_scheduled_scan_at": compute_next_scheduled_scan_at(
            frequency=payload.scan_frequency,
            reference_time=now,
            schedule_time_utc=payload.schedule_time_utc,
            schedule_day_of_week=payload.schedule_day_of_week,
            schedule_day_of_month=payload.schedule_day_of_month,
        ),
    }


async def _connection_has_active_job(session, connection_id) -> bool:
    result = await session.execute(
        select(ScanJob.id).where(
            ScanJob.api_connection_id == connection_id,
            ScanJob.status.in_(["queued", "running"]),
        )
    )
    return result.first() is not None


async def run_due_scheduled_scans_once() -> int:
    if SessionLocal is None:
        logger.warning("Skipping scheduled scans because the database is not configured.")
        return 0

    started = 0
    async with SessionLocal() as session:
        repository = APIConnectionRepository(session)
        try:
            due_connections = await repository.list_due_for_scheduling(datetime.now(UTC))
        except ProgrammingError:
            logger.warning("Scheduled scan worker skipped because database migrations have not been applied yet.")
            return 0

        for connection in due_connections:
            if await _connection_has_active_job(session, connection.id):
                continue

            now = datetime.now(UTC)
            connection.next_scheduled_scan_at = compute_next_scheduled_scan_at(
                frequency=connection.scan_frequency,
                reference_time=now,
                schedule_time_utc=connection.schedule_time_utc,
                schedule_day_of_week=connection.schedule_day_of_week,
                schedule_day_of_month=connection.schedule_day_of_month,
            )
            connection.last_scan_status = "queued"
            await session.commit()

            await create_scan_job(
                connection,
                ScanJobStartRequest(
                    response_root_override=connection.response_root_node,
                    trigger_mode=connection.scan_frequency,
                ),
            )
            started += 1

    if started:
        logger.info("Started %s scheduled scan(s).", started)
    return started


async def _scheduler_loop() -> None:
    poll_interval = max(settings.scheduler_poll_interval_seconds, 15)
    while True:
        try:
            await run_due_scheduled_scans_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Scheduled scan loop failed.")
        await asyncio.sleep(poll_interval)


def start_scheduler() -> None:
    global SCHEDULER_TASK
    if not settings.scheduler_enabled:
        logger.info("Scheduled scan worker disabled by configuration.")
        return
    if SessionLocal is None:
        logger.info("Scheduled scan worker not started because Supabase is not configured.")
        return
    if SCHEDULER_TASK is not None and not SCHEDULER_TASK.done():
        return
    SCHEDULER_TASK = asyncio.create_task(_scheduler_loop())
    logger.info("Scheduled scan worker started.")


async def stop_scheduler() -> None:
    global SCHEDULER_TASK
    if SCHEDULER_TASK is None:
        return
    SCHEDULER_TASK.cancel()
    try:
        await SCHEDULER_TASK
    except asyncio.CancelledError:
        pass
    finally:
        SCHEDULER_TASK = None
