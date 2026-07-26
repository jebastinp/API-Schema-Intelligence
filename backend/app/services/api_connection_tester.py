import time

import httpx

from app.schemas.api_connection import APITestRequest, APITestResponse

DEFAULT_TEST_COUNT = 10000


def _response_excerpt(response: httpx.Response, limit: int = 400) -> str:
    body = response.text.strip()
    if not body:
        return ""
    compact = " ".join(body.split())
    return compact[:limit]


async def build_request_headers(payload: APITestRequest) -> dict[str, str]:
    headers = dict(payload.headers)
    headers.setdefault("Accept", "application/json")

    auth_type = payload.authentication_type.lower()
    has_oauth_credentials = bool(payload.token_url and payload.client_id and payload.client_secret)

    if has_oauth_credentials and auth_type in {"oauth2_client_credentials", "bearer", "basic", "none", "api_key"}:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            token_response = await client.post(
                str(payload.token_url),
                data={
                    "grant_type": payload.grant_type or "client_credentials",
                    "client_id": payload.client_id,
                    "client_secret": payload.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_payload = token_response.json()

        access_token = token_payload.get("access_token")
        if not access_token:
            raise ValueError("Token response did not include access_token.")

        headers["Authorization"] = f"Bearer {access_token}"
        return headers

    if auth_type == "bearer" and payload.client_secret:
        headers.setdefault("Authorization", f"Bearer {payload.client_secret}")

    return headers


async def test_api_connection(payload: APITestRequest) -> APITestResponse:
    started = time.perf_counter()

    try:
        headers = await build_request_headers(payload)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(
                str(payload.base_url),
                headers=headers,
                params={payload.count_parameter or "count": DEFAULT_TEST_COUNT},
            )
        elapsed = int((time.perf_counter() - started) * 1000)

        if 200 <= response.status_code < 400:
            return APITestResponse(
                success=True,
                status_code=response.status_code,
                message="API connection test succeeded.",
                response_time_ms=elapsed,
            )

        return APITestResponse(
            success=False,
            status_code=response.status_code,
            message=(
                f"API returned status {response.status_code}."
                + (f" Response: {_response_excerpt(response)}" if _response_excerpt(response) else "")
            ),
            response_time_ms=elapsed,
        )
    except Exception as exc:
        elapsed = int((time.perf_counter() - started) * 1000)
        return APITestResponse(
            success=False,
            message=str(exc),
            response_time_ms=elapsed,
        )
