import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_connection import APIConnection
from app.repositories.base import Repository


class APIConnectionRepository(Repository[APIConnection]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(APIConnection, session)

    async def list_for_user(self, user_id: uuid.UUID) -> list[APIConnection]:
        result = await self.session.execute(
            select(APIConnection)
            .where(APIConnection.user_id == user_id)
            .order_by(APIConnection.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_for_user(self, connection_id: uuid.UUID, user_id: uuid.UUID) -> APIConnection | None:
        result = await self.session.execute(
            select(APIConnection).where(
                APIConnection.id == connection_id,
                APIConnection.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_due_for_scheduling(self, reference_time: datetime, limit: int = 20) -> list[APIConnection]:
        result = await self.session.execute(
            select(APIConnection)
            .where(
                APIConnection.status == "active",
                APIConnection.scan_frequency.in_(["daily", "weekly", "monthly"]),
                APIConnection.next_scheduled_scan_at.is_not(None),
                APIConnection.next_scheduled_scan_at <= reference_time,
            )
            .order_by(APIConnection.next_scheduled_scan_at.asc(), APIConnection.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())
