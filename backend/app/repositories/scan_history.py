import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_connection import APIConnection
from app.models.scan_history import ScanHistory
from app.repositories.base import Repository


class ScanHistoryRepository(Repository[ScanHistory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ScanHistory, session)

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        connection_id: uuid.UUID | None = None,
        limit: int = 25,
    ) -> list[ScanHistory]:
        query = (
            select(ScanHistory)
            .join(APIConnection, APIConnection.id == ScanHistory.api_connection_id)
            .where(APIConnection.user_id == user_id)
            .order_by(ScanHistory.started_at.desc())
            .limit(limit)
        )
        if connection_id is not None:
            query = query.where(ScanHistory.api_connection_id == connection_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())
