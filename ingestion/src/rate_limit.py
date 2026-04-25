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
    """Key by X-Workspace-Id when present, fall back to remote IP."""
    return request.headers.get("X-Workspace-Id") or get_remote_address(request)


limiter = Limiter(key_func=_key_func, default_limits=["300/minute"])


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
    response.headers["Retry-After"] = "60"
    return response
