from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.column_statistics import ColumnStatistics
from app.repositories.base import Repository


class ColumnStatisticsRepository(Repository[ColumnStatistics]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ColumnStatistics, session)

    async def create_many(self, entries: Sequence[dict]) -> list[ColumnStatistics]:
        statistics = [ColumnStatistics(**entry) for entry in entries]
        self.session.add_all(statistics)
        await self.session.flush()
        return statistics
