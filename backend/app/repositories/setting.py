import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting
from app.repositories.base import Repository


class SettingRepository(Repository[Setting]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Setting, session)

    async def list_for_user(self, user_id: uuid.UUID) -> list[Setting]:
        result = await self.session.execute(
            select(Setting)
            .where(Setting.user_id == user_id)
            .order_by(Setting.category.asc(), Setting.key.asc())
        )
        return list(result.scalars().all())

    async def get_for_user(self, user_id: uuid.UUID, *, category: str, key: str) -> Setting | None:
        result = await self.session.execute(
            select(Setting).where(
                Setting.user_id == user_id,
                Setting.category == category,
                Setting.key == key,
            )
        )
        return result.scalar_one_or_none()
