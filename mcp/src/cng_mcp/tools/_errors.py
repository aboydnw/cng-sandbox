"""Shared error handling for MCP tools."""

import functools
from collections.abc import Awaitable, Callable

import httpx
from mcp.types import TextContent


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
            body = exc.response.text.strip() or exc.response.reason_phrase
            return TextContent(
                type="text",
                text=f"Sandbox API error (HTTP {status}): {body}",
            )

    return wrapper
