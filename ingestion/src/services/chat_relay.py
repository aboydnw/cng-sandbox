"""Stream the Anthropic Messages API over raw ``httpx`` and map it to our SSE.

The backend is a thin proxy: it never runs a tool. It re-emits the model's text
deltas and completed ``tool_use`` blocks as small SSE events the browser turns
into chips and executes locally. Output-token usage is reported back through a
callback so the caller can bill a global daily budget.
"""

import json
from collections.abc import AsyncIterator, Callable

import httpx

_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"


async def stream_anthropic(
    *,
    api_key: str,
    model: str,
    system: list[dict],
    tools: list[dict],
    messages: list[dict],
    max_tokens: int,
    on_output_tokens: Callable[[int], None],
) -> AsyncIterator[dict]:
    """POST to Anthropic with ``stream=true`` and yield our own SSE event dicts.

    Yields dicts shaped ``{"event": "text"|"tool_use"|"done"|"error", "data": str}``
    where ``data`` is a JSON string. ``on_output_tokens`` is invoked with the
    ``message_delta`` usage so the caller can meter spend.
    """
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "stream": True,
        "system": system,
        "tools": tools,
        "messages": messages,
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": _ANTHROPIC_VERSION,
        "content-type": "application/json",
    }

    tool_blocks: dict[int, dict] = {}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            async with client.stream(
                "POST", _ANTHROPIC_URL, headers=headers, json=body
            ) as response:
                if response.status_code != 200:
                    await response.aread()
                    yield {
                        "event": "error",
                        "data": json.dumps(
                            {"message": "Upstream error", "status": response.status_code}
                        ),
                    }
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[len("data:") :].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        event = json.loads(payload)
                    except json.JSONDecodeError:
                        continue

                    async for out in _handle_event(event, tool_blocks, on_output_tokens):
                        yield out
    except httpx.HTTPError:
        yield {
            "event": "error",
            "data": json.dumps({"message": "Connection error"}),
        }


async def _handle_event(
    event: dict,
    tool_blocks: dict[int, dict],
    on_output_tokens: Callable[[int], None],
) -> AsyncIterator[dict]:
    etype = event.get("type")

    if etype == "content_block_start":
        block = event.get("content_block", {})
        if block.get("type") == "tool_use":
            tool_blocks[event.get("index", 0)] = {
                "id": block.get("id"),
                "name": block.get("name"),
                "json": "",
            }
        return

    if etype == "content_block_delta":
        delta = event.get("delta", {})
        dtype = delta.get("type")
        if dtype == "text_delta":
            yield {"event": "text", "data": json.dumps({"text": delta.get("text", "")})}
        elif dtype == "input_json_delta":
            block = tool_blocks.get(event.get("index", 0))
            if block is not None:
                block["json"] += delta.get("partial_json", "")
        return

    if etype == "content_block_stop":
        block = tool_blocks.pop(event.get("index", 0), None)
        if block is not None:
            try:
                parsed = json.loads(block["json"]) if block["json"] else {}
            except json.JSONDecodeError:
                parsed = {}
            yield {
                "event": "tool_use",
                "data": json.dumps(
                    {"id": block["id"], "name": block["name"], "input": parsed}
                ),
            }
        return

    if etype == "message_delta":
        usage = event.get("usage", {})
        output_tokens = usage.get("output_tokens")
        if output_tokens:
            on_output_tokens(output_tokens)
        return

    if etype == "message_stop":
        yield {"event": "done", "data": json.dumps({"stop_reason": "end_turn"})}
        return

    if etype == "error":
        yield {
            "event": "error",
            "data": json.dumps(event.get("error", {"message": "error"})),
        }
