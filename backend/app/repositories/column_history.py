from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.column_history import ColumnHistory
from app.repositories.base import Repository


class ColumnHistoryRepository(Repository[ColumnHistory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ColumnHistory, session)

    async def create_many(self, entries: Sequence[dict]) -> list[ColumnHistory]:
        history_rows = [ColumnHistory(**entry) for entry in entries]
        self.session.add_all(history_rows)
        await self.session.flush()
        return history_rows
