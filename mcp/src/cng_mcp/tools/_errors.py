"""Shared error handling for MCP tools."""

import functools
import json
from collections.abc import Awaitable, Callable

import httpx
from mcp.types import TextContent


def _error_body(response: httpx.Response) -> str:
    """Extract a readable error message from an API error response.

    FastAPI errors arrive as ``{"detail": "..."}``; surface just the detail
    when present, otherwise fall back to the raw body or reason phrase.
    """
    text = response.text.strip()
    if not text:
        return response.reason_phrase
    try:
        detail = json.loads(text).get("detail")
    except (json.JSONDecodeError, AttributeError):
        return text
    return detail if isinstance(detail, str) else text


def surface_api_errors(
    func: Callable[..., Awaitable[TextContent]],
) -> Callable[..., Awaitable[TextContent]]:
    """Wrap a tool coroutine so sandbox API errors become readable TextContent.

    Without this, an HTTP error surfaces to the calling agent as a terse
    ``httpx.HTTPStatusError`` with no FastAPI ``detail`` body. This catches the
    error and returns the response body text so the agent gets the actionable
    message.
    """

    @functools.wraps(func)
    async def wrapper(*args, **kwargs) -> TextContent:
        try:
            return await func(*args, **kwargs)
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            body = _error_body(exc.response)
            return TextContent(
                type="text",
                text=f"Sandbox API error (HTTP {status}): {body}",
            )

    return wrapper
