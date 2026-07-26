import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.column import Column
from app.models.schema_version import SchemaVersion
from app.repositories.base import Repository


class SchemaVersionRepository(Repository[SchemaVersion]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SchemaVersion, session)

    async def next_version_number(self, connection_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.max(SchemaVersion.version_number)).where(
                SchemaVersion.api_connection_id == connection_id,
            )
        )
        current = result.scalar_one_or_none()
        return (current or 0) + 1

    async def get_latest_for_connection(self, connection_id: uuid.UUID) -> SchemaVersion | None:
        result = await self.session.execute(
            select(SchemaVersion)
            .options(selectinload(SchemaVersion.columns).selectinload(Column.statistics))
            .where(SchemaVersion.api_connection_id == connection_id)
            .order_by(SchemaVersion.version_number.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_connection(
        self,
        version_id: uuid.UUID,
        connection_id: uuid.UUID,
    ) -> SchemaVersion | None:
        result = await self.session.execute(
            select(SchemaVersion)
            .options(selectinload(SchemaVersion.columns).selectinload(Column.statistics))
            .where(
                SchemaVersion.id == version_id,
                SchemaVersion.api_connection_id == connection_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_connection(self, connection_id: uuid.UUID) -> list[SchemaVersion]:
        result = await self.session.execute(
            select(SchemaVersion)
            .options(selectinload(SchemaVersion.columns).selectinload(Column.statistics))
            .where(SchemaVersion.api_connection_id == connection_id)
            .order_by(SchemaVersion.version_number.desc())
        )
        return list(result.scalars().all())
