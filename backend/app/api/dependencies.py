from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.user import UserRepository
from app.schemas.auth import CurrentUser
from app.services.auth import AuthError, current_user_from_token


async def get_current_user(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        user = await current_user_from_token(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    repository = UserRepository(session)
    await repository.upsert_from_supabase_claims(
        supabase_user_id=user.supabase_user_id,
        email=user.email,
        full_name=user.full_name,
    )
    await session.commit()

    return user
