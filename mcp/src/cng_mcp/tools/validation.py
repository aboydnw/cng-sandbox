"""Tools for layer and configuration validation."""

from typing import Optional
from mcp.types import TextContent
from cng_mcp.client.sandbox_api import SandboxAPIClient


async def validate_layer_config_tool(
    client: SandboxAPIClient,
    dataset_id: str,
    colormap: str,
    rescale_min: Optional[float] = None,
    rescale_max: Optional[float] = None,
) -> TextContent:
    """Validate a layer configuration before creating a chapter."""
    if not dataset_id:
        return TextContent(type="text", text="Error: dataset_id is required")
    if not colormap:
        return TextContent(type="text", text="Error: colormap is required")

    result = await client.validate_layer_config(
        dataset_id=dataset_id,
        colormap=colormap,
        rescale_min=rescale_min,
        rescale_max=rescale_max,
    )

    valid = result.get("valid", False)
    error = result.get("error", "")

    if valid:
        lines = [
            "# Layer Configuration Valid\n",
            f"Dataset: `{dataset_id}`",
            f"Colormap: `{colormap}`",
        ]
        if rescale_min is not None:
            lines.append(f"Rescale: [{rescale_min}, {rescale_max}]")
    else:
        lines = [
            "# Layer Configuration Invalid\n",
            f"Dataset: `{dataset_id}`",
            f"Colormap: `{colormap}`",
        ]
        if error:
            lines.append(f"\n**Error**: {error}")
    return TextContent(type="text", text="\n".join(lines))
