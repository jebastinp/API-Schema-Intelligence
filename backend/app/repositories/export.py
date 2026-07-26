import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.export import Export
from app.repositories.base import Repository


class ExportRepository(Repository[Export]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Export, session)

    async def list_for_user(self, user_id: uuid.UUID, limit: int = 20) -> list[Export]:
        result = await self.session.execute(
            select(Export)
            .where(Export.user_id == user_id)
            .order_by(Export.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
