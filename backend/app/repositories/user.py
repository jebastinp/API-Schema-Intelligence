import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base import Repository


class UserRepository(Repository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_supabase_user_id(self, supabase_user_id: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.supabase_user_id == supabase_user_id)
        )
        return result.scalar_one_or_none()

    async def upsert_from_supabase_claims(
        self,
        *,
        supabase_user_id: str,
        email: str,
        full_name: str | None,
    ) -> User:
        user = await self.get_by_supabase_user_id(supabase_user_id)
        if user is None:
            user = await self.create(
                supabase_user_id=supabase_user_id,
                email=email,
                full_name=full_name,
            )
            return user

        user.email = email
        user.full_name = full_name
        await self.session.flush()
        return user
