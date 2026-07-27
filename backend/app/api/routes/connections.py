import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.api_connection import APIConnectionRepository
from app.repositories.user import UserRepository
from app.schemas.api_connection import (
    APIConnectionCreate,
    APIConnectionRead,
    APIConnectionUpdate,
    APITestRequest,
    APITestResponse,
)
from app.schemas.auth import CurrentUser
from app.services.api_connection_tester import test_api_connection
from app.services.scheduled_scans import build_schedule_fields

router = APIRouter()


async def resolve_local_user_id(session: AsyncSession, user: CurrentUser) -> uuid.UUID:
    repository = UserRepository(session)
    try:
        local_user = await repository.get_by_supabase_user_id(user.supabase_user_id)
    except SQLAlchemyError as exc:
        raise RuntimeError("Supabase health check failed: database session is unavailable.") from exc
    if local_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not provisioned.")
    return local_user.id


@router.get("", response_model=list[APIConnectionRead])
async def list_connections(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user_id = await resolve_local_user_id(session, user)
    repository = APIConnectionRepository(session)
    return await repository.list_for_user(user_id)


@router.post("", response_model=APIConnectionRead, status_code=status.HTTP_201_CREATED)
async def create_connection(
    payload: APIConnectionCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user_id = await resolve_local_user_id(session, user)
    repository = APIConnectionRepository(session)
    data = payload.model_dump(mode="json")
    data.update(build_schedule_fields(payload))
    connection = await repository.create(user_id=user_id, **data)
    await session.commit()
    await session.refresh(connection)
    return connection


@router.put("/{connection_id}", response_model=APIConnectionRead)
async def update_connection(
    connection_id: uuid.UUID,
    payload: APIConnectionUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user_id = await resolve_local_user_id(session, user)
    repository = APIConnectionRepository(session)
    connection = await repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    data = payload.model_dump(mode="json")
    data.update(build_schedule_fields(payload))
    for field, value in data.items():
        setattr(connection, field, value)

    await session.commit()
    await session.refresh(connection)
    return connection


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    user_id = await resolve_local_user_id(session, user)
    repository = APIConnectionRepository(session)
    connection = await repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    await session.delete(connection)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", response_model=APITestResponse)
async def test_connection(
    payload: APITestRequest,
) -> APITestResponse:
    result = await test_api_connection(payload)
    return result
