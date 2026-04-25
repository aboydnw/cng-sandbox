"""Application-level rate limiting via slowapi.

Exposes a module-level `limiter` singleton so route modules can apply
`@limiter.limit(...)` decorators without importing from `src.app` (which would
create a circular import). The limiter is wired into the FastAPI app inside
`create_app()`.
"""

import logging

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


def _key_func(request: Request) -> str:
    """Key by combined workspace + remote IP.

    Combining the two prevents header-rotation bypass: an attacker on a single
    IP cannot escape rate limits by minting a fresh `X-Workspace-Id` per
    request, while real users on different IPs remain independently bucketed
    per workspace.
    """
    workspace_id = request.headers.get("X-Workspace-Id") or "anon"
    return f"{workspace_id}:{get_remote_address(request)}"


limiter = Limiter(key_func=_key_func, default_limits=["300/minute"])


def _retry_after_seconds(detail: str) -> int:
    parts = detail.split(" per ")
    if len(parts) != 2:
        return 60
    quantity, _, unit = parts[1].partition(" ")
    try:
        n = int(quantity) if quantity.isdigit() else 1
    except ValueError:
        n = 1
    seconds = {
        "second": 1,
        "seconds": 1,
        "minute": 60,
        "minutes": 60,
        "hour": 3600,
        "hours": 3600,
        "day": 86400,
        "days": 86400,
    }.get(unit.strip().lower(), 60)
    return max(1, n * seconds)


def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Log a grep-friendly warning and return a 429 response."""
    remote_ip = request.client.host if request.client else None
    logger.warning(
        "rate_limit_exceeded path=%s workspace=%s ip=%s limit=%s",
        request.url.path,
        request.headers.get("X-Workspace-Id"),
        remote_ip,
        exc.detail,
    )
    response = JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )
    response.headers["Retry-After"] = str(_retry_after_seconds(exc.detail))
    return response
