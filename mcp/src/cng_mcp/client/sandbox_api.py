"""HTTP client for CNG Sandbox API."""

from typing import Any, Optional
from urllib.parse import quote
import httpx


class SandboxAPIClient:
    """Async HTTP client for sandbox ingestion API."""

    def __init__(
        self,
        api_url: str,
        workspace_id: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self.api_url = api_url.rstrip("/")
        self.workspace_id = workspace_id
        self.http_client = http_client or httpx.AsyncClient()

    def _headers(self) -> dict[str, str]:
        if self.workspace_id:
            return {"X-Workspace-Id": self.workspace_id}
        return {}

    async def get_datasets(self) -> list[dict[str, Any]]:
        """Get all datasets visible to the caller's workspace."""
        response = await self.http_client.get(
            f"{self.api_url}/api/datasets", headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

    async def get_story(self, story_id: str) -> dict[str, Any]:
        """Get story by ID."""
        response = await self.http_client.get(
            f"{self.api_url}/api/stories/{quote(story_id, safe='')}",
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def create_story(
        self,
        title: str,
        description: str,
        chapters: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Create a new story."""
        response = await self.http_client.post(
            f"{self.api_url}/api/stories",
            json={"title": title, "description": description, "chapters": chapters},
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def update_story(self, story_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        """Update an existing story."""
        response = await self.http_client.patch(
            f"{self.api_url}/api/stories/{quote(story_id, safe='')}",
            json=updates,
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def get_connections(self) -> list[dict[str, Any]]:
        """Get all external tile source connections in the caller's workspace."""
        response = await self.http_client.get(
            f"{self.api_url}/api/connections", headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

    async def validate_layer_config(
        self,
        dataset_id: str,
        colormap: str,
        rescale_min: Optional[float] = None,
        rescale_max: Optional[float] = None,
    ) -> dict[str, Any]:
        """Validate a layer configuration before creating a chapter."""
        payload: dict[str, Any] = {"dataset_id": dataset_id, "colormap": colormap}
        if rescale_min is not None:
            payload["rescale_min"] = rescale_min
        if rescale_max is not None:
            payload["rescale_max"] = rescale_max
        response = await self.http_client.post(
            f"{self.api_url}/api/validate-layer-config",
            json=payload,
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()
