from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generated_sql import GeneratedSQL
from app.repositories.base import Repository


class GeneratedSQLRepository(Repository[GeneratedSQL]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GeneratedSQL, session)
