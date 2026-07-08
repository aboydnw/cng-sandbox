"""Reader-facing 'Ask this map' agent: config probe + SSE relay (Task 3)."""

from fastapi import APIRouter, Request

from src.config import Settings, get_settings

router = APIRouter(prefix="/api")


def chat_available(settings: Settings) -> bool:
    return settings.chat_enabled and bool(settings.anthropic_api_key_chat)


@router.get("/chat/config")
async def chat_config(request: Request):
    settings = getattr(request.app.state, "settings", None) or get_settings()
    return {"enabled": chat_available(settings)}
