from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generated_xquery import GeneratedXQuery
from app.repositories.base import Repository


class GeneratedXQueryRepository(Repository[GeneratedXQuery]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(GeneratedXQuery, session)
