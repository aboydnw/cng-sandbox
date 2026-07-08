"""Reader-facing 'Ask this map' agent: config probe + SSE relay.

The relay is a thin proxy — it assembles the per-story system prompt and the
tool definitions, streams the Anthropic response over ``httpx``, and re-emits
text/tool_use events as SSE. It never executes a tool; the browser does.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.config import Settings, get_settings
from src.dependencies import get_session
from src.models.story import StoryRow
from src.rate_limit import limiter
from src.services.chat_context import build_system_blocks
from src.services.chat_relay import stream_anthropic

router = APIRouter(prefix="/api")


def chat_available(settings: Settings) -> bool:
    return settings.chat_enabled and bool(settings.anthropic_api_key_chat)


# 8 tool definitions — names and params match the frontend zod executors
# byte-for-byte (Tasks 5 & 6). The last tool carries the cache_control breakpoint
# so the whole tools array is cached alongside the system prompt.
CHAT_TOOLS: list[dict] = [
    {
        "name": "fly_to",
        "description": "Move the map camera to a location.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "longitude": {"type": "number"},
                "latitude": {"type": "number"},
                "zoom": {"type": "number"},
                "pitch": {"type": "number"},
                "bearing": {"type": "number"},
            },
            "required": ["longitude", "latitude", "zoom"],
        },
    },
    {
        "name": "go_to_chapter",
        "description": "Scroll the story to a chapter by its 0-based index.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {"chapter_index": {"type": "integer"}},
            "required": ["chapter_index"],
        },
    },
    {
        "name": "set_layer_visibility",
        "description": "Show or hide a map layer by its id.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "layer_id": {"type": "string"},
                "visible": {"type": "boolean"},
            },
            "required": ["layer_id", "visible"],
        },
    },
    {
        "name": "highlight_location",
        "description": "Drop a temporary labeled pin on the map.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "longitude": {"type": "number"},
                "latitude": {"type": "number"},
                "label": {"type": "string"},
            },
            "required": ["longitude", "latitude", "label"],
        },
    },
    {
        "name": "query_point",
        "description": "Read raster/zarr values at a point for the visible layers.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "longitude": {"type": "number"},
                "latitude": {"type": "number"},
            },
            "required": ["longitude", "latitude"],
        },
    },
    {
        "name": "get_area_statistics",
        "description": "Summary statistics (min/max/mean) over a bounding box.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "bbox": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 4,
                    "maxItems": 4,
                }
            },
            "required": ["bbox"],
        },
    },
    {
        "name": "query_features",
        "description": "Count and sample vector features, optionally filtered.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "collection_id": {"type": "string"},
                "cql2_filter": {"type": "string"},
            },
            "required": [],
        },
    },
    {
        "name": "get_timeseries",
        "description": "A compact time series at a point for temporal layers.",
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "longitude": {"type": "number"},
                "latitude": {"type": "number"},
            },
            "required": ["longitude", "latitude"],
        },
        "cache_control": {"type": "ephemeral"},
    },
]


# In-memory, single-process daily output-token budget. Resets on UTC date
# rollover. Matches state.py's ephemeral posture — adequate for the demo; a
# multi-process deploy would move this to shared storage.
_budget: dict = {"date": None, "used": 0}


def _budget_reset_if_stale() -> None:
    today = datetime.now(UTC).date()
    if _budget["date"] != today:
        _budget["date"] = today
        _budget["used"] = 0


def _budget_remaining(settings: Settings) -> int:
    _budget_reset_if_stale()
    return settings.chat_daily_token_budget - _budget["used"]


def _budget_add(n: int) -> None:
    _budget_reset_if_stale()
    _budget["used"] += n


class ChatRequest(BaseModel):
    story_id: str
    messages: list[dict]


@router.get("/chat/config")
async def chat_config(request: Request):
    settings = getattr(request.app.state, "settings", None) or get_settings()
    return {"enabled": chat_available(settings)}


@router.post("/chat")
# Static string: slowapi's decorator needs a literal. The configurable
# settings.chat_rate_limit is retained for documentation and future wiring.
@limiter.limit("10/minute")
async def chat(request: Request, body: ChatRequest):
    settings = getattr(request.app.state, "settings", None) or get_settings()
    if not chat_available(settings):
        raise HTTPException(status_code=404, detail="Not found")

    user_turns = sum(1 for m in body.messages if m.get("role") == "user")
    if user_turns > settings.chat_max_turns:
        raise HTTPException(status_code=400, detail="Conversation too long")

    if _budget_remaining(settings) <= 0:
        raise HTTPException(
            status_code=503, detail="The assistant is resting. Try again later."
        )

    session = get_session(request)
    try:
        story = session.get(StoryRow, body.story_id)
        if story is None or not (story.published or story.is_example):
            raise HTTPException(status_code=404, detail="Story not found")
        system = build_system_blocks(story, session)
    finally:
        session.close()

    async def _relay():
        async for event in stream_anthropic(
            api_key=settings.anthropic_api_key_chat,
            model=settings.chat_model,
            system=system,
            tools=CHAT_TOOLS,
            messages=body.messages,
            max_tokens=settings.chat_max_tokens,
            on_output_tokens=_budget_add,
        ):
            yield event

    return EventSourceResponse(_relay())
