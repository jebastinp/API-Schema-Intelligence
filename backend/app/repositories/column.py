from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.column import Column
from app.repositories.base import Repository


class ColumnRepository(Repository[Column]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Column, session)

    async def create_many(self, entries: Sequence[dict]) -> list[Column]:
        columns = [Column(**entry) for entry in entries]
        self.session.add_all(columns)
        await self.session.flush()
        return columns
