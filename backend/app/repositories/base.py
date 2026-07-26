from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")


class Repository(Generic[ModelT]):
    def __init__(self, model: type[ModelT], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get(self, entity_id):
        result = await self.session.execute(select(self.model).where(self.model.id == entity_id))
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> ModelT:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance
