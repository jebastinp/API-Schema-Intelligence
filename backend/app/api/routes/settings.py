from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.routes.connections import resolve_local_user_id
from app.db.session import get_db
from app.repositories.setting import SettingRepository
from app.schemas.auth import CurrentUser
from app.schemas.settings import SettingsResponse, SettingsUpdateRequest
from app.services.settings_service import load_user_settings, save_user_settings

router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    user_id = await resolve_local_user_id(session, user)
    repository = SettingRepository(session)
    settings = await load_user_settings(repository, user_id)
    return SettingsResponse(settings=settings)


@router.put("", response_model=SettingsResponse)
async def update_settings(
    payload: SettingsUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    user_id = await resolve_local_user_id(session, user)
    repository = SettingRepository(session)
    settings = await save_user_settings(repository, user_id, payload.settings)
    await session.commit()
    return SettingsResponse(settings=settings)
