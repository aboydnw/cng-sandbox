"""HTTP client for CNG Sandbox API."""

from typing import Any, Optional
import httpx


class SandboxAPIClient:
    """Async HTTP client for sandbox ingestion API."""

    def __init__(self, api_url: str, http_client: Optional[httpx.AsyncClient] = None):
        self.api_url = api_url.rstrip("/")
        self.http_client = http_client or httpx.AsyncClient()

    async def get_datasets(self) -> list[dict[str, Any]]:
        """Get all datasets in workspace."""
        response = await self.http_client.get(f"{self.api_url}/api/datasets")
        response.raise_for_status()
        return response.json().get("datasets", [])

    async def get_story(self, story_id: str) -> dict[str, Any]:
        """Get story by ID."""
        response = await self.http_client.get(f"{self.api_url}/api/stories/{story_id}")
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
        )
        response.raise_for_status()
        return response.json()

    async def update_story(self, story_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        """Update an existing story."""
        response = await self.http_client.patch(
            f"{self.api_url}/api/stories/{story_id}",
            json=updates,
        )
        response.raise_for_status()
        return response.json()

    async def get_connections(self) -> list[dict[str, Any]]:
        """Get all external tile source connections."""
        response = await self.http_client.get(f"{self.api_url}/api/connections")
        response.raise_for_status()
        return response.json().get("connections", [])

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
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()
