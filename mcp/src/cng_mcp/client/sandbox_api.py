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

    async def create_connection(
        self,
        name: str,
        url: str,
        connection_type: str,
        bounds: Optional[list[float]] = None,
        min_zoom: Optional[int] = None,
        max_zoom: Optional[int] = None,
        tile_type: Optional[str] = None,
        band_count: Optional[int] = None,
        rescale: Optional[str] = None,
        config: Optional[dict[str, Any]] = None,
        geozarr_attrs: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a new external tile source connection."""
        payload: dict[str, Any] = {
            "name": name,
            "url": url,
            "connection_type": connection_type,
        }
        if bounds is not None:
            payload["bounds"] = bounds
        if min_zoom is not None:
            payload["min_zoom"] = min_zoom
        if max_zoom is not None:
            payload["max_zoom"] = max_zoom
        if tile_type is not None:
            payload["tile_type"] = tile_type
        if band_count is not None:
            payload["band_count"] = band_count
        if rescale is not None:
            payload["rescale"] = rescale
        if config is not None:
            payload["config"] = config
        if geozarr_attrs is not None:
            payload["geozarr_attrs"] = geozarr_attrs
        response = await self.http_client.post(
            f"{self.api_url}/api/connections",
            json=payload,
            headers=self._headers(),
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

    async def convert_url(self, url: str) -> dict[str, Any]:
        """Fetch and convert a remote file. Returns job info, or the existing
        dataset on a 409 duplicate instead of raising."""
        response = await self.http_client.post(
            f"{self.api_url}/api/convert-url",
            json={"url": url},
            headers=self._headers(),
        )
        if response.status_code == 409:
            return response.json()
        response.raise_for_status()
        return response.json()

    async def discover(self, url: str) -> dict[str, Any]:
        """Discover geospatial files at a URL or S3 prefix."""
        response = await self.http_client.post(
            f"{self.api_url}/api/discover",
            json={"url": url},
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def connect_remote(
        self, url: str, mode: str, files: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Connect remote files as a mosaic or temporal dataset."""
        response = await self.http_client.post(
            f"{self.api_url}/api/connect-remote",
            json={"url": url, "mode": mode, "files": files},
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def get_job(self, job_id: str) -> dict[str, Any]:
        """Get the status of a conversion job."""
        response = await self.http_client.get(
            f"{self.api_url}/api/jobs/{quote(job_id, safe='')}",
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()
