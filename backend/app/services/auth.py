from __future__ import annotations

import time
from urllib.parse import urljoin

import httpx
from jose import JWTError, jwt

from app.core.config import settings
from app.schemas.auth import CurrentUser


class AuthError(Exception):
    pass


_JWKS_CACHE_TTL_SECONDS = 600
_jwks_cache: dict | None = None
_jwks_cache_expires_at = 0.0


def _issuer_url() -> str:
    if not settings.supabase_project_url:
        raise AuthError("Supabase project URL is not configured.")
    return urljoin(settings.supabase_project_url.rstrip("/") + "/", "auth/v1")


def _jwks_url() -> str:
    return urljoin(_issuer_url().rstrip("/") + "/", ".well-known/jwks.json")


async def _fetch_jwks() -> dict:
    global _jwks_cache, _jwks_cache_expires_at

    now = time.monotonic()
    if _jwks_cache is not None and now < _jwks_cache_expires_at:
        return _jwks_cache

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(_jwks_url())
            response.raise_for_status()
    except Exception as exc:
        raise AuthError("Failed to load Supabase signing keys.") from exc

    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("keys"), list):
        raise AuthError("Supabase signing keys response is invalid.")

    _jwks_cache = payload
    _jwks_cache_expires_at = now + _JWKS_CACHE_TTL_SECONDS
    return payload


async def decode_supabase_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg")

    if algorithm in {"ES256", "RS256"}:
      jwks = await _fetch_jwks()
      key_id = header.get("kid")
      if not key_id:
          raise AuthError("Supabase access token is missing a key identifier.")

      matching_keys = [key for key in jwks["keys"] if key.get("kid") == key_id]
      if not matching_keys:
          raise AuthError("Supabase signing key for this token was not found.")

      try:
          return jwt.decode(
              token,
              {"keys": matching_keys},
              algorithms=[algorithm],
              issuer=_issuer_url(),
              options={"verify_aud": False},
          )
      except JWTError as exc:
          raise AuthError("Invalid Supabase access token.") from exc

    if not settings.supabase_jwt_secret:
        raise AuthError("Supabase JWT secret is not configured.")

    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            issuer=_issuer_url(),
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise AuthError("Invalid Supabase access token.") from exc


async def current_user_from_token(token: str) -> CurrentUser:
    payload = await decode_supabase_token(token)
    return CurrentUser(
        supabase_user_id=payload["sub"],
        email=payload.get("email", ""),
        full_name=payload.get("user_metadata", {}).get("full_name"),
    )
