import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scan_job import ScanJob
from app.repositories.base import Repository


class ScanJobRepository(Repository[ScanJob]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ScanJob, session)

    async def get_for_connection(self, scan_job_id: uuid.UUID, connection_id: uuid.UUID) -> ScanJob | None:
        result = await self.session.execute(
            select(ScanJob).where(
                ScanJob.id == scan_job_id,
                ScanJob.api_connection_id == connection_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_connection(self, connection_id: uuid.UUID, limit: int = 10) -> list[ScanJob]:
        result = await self.session.execute(
            select(ScanJob)
            .where(ScanJob.api_connection_id == connection_id)
            .order_by(ScanJob.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
