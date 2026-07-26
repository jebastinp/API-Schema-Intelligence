import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.base import Repository


class NotificationRepository(Repository[Notification]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Notification, session)

    async def list_for_user(self, user_id: uuid.UUID, *, limit: int = 20) -> list[Notification]:
        result = await self.session.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def unread_count_for_user(self, user_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .order_by(Notification.created_at.desc())
        )
        return len(list(result.scalars().all()))

    async def get_for_user(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification | None:
        result = await self.session.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def mark_all_as_read(self, user_id: uuid.UUID) -> list[Notification]:
        notifications = await self.list_for_user(user_id, limit=200)
        updated: list[Notification] = []
        for notification in notifications:
            if notification.is_read:
                continue
            notification.is_read = True
            updated.append(notification)
        await self.session.flush()
        return updated
