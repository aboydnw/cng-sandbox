"""Tools for layer and configuration validation."""

from typing import Optional
from mcp.types import TextContent
from cng_mcp.client.sandbox_api import SandboxAPIClient
from cng_mcp.tools._errors import surface_api_errors


@surface_api_errors
async def validate_layer_config_tool(
    client: SandboxAPIClient,
    dataset_id: str,
    colormap: Optional[str] = None,
    rescale_min: Optional[float] = None,
    rescale_max: Optional[float] = None,
    color_mode: Optional[str] = None,
) -> TextContent:
    """Validate a layer configuration before creating a chapter.

    Raster layers need a `colormap`; point-cloud (copc) layers use `color_mode`
    (elevation/intensity/classification/rgb) instead, so a colormap is not
    required when `color_mode` is provided.
    """
    if not dataset_id:
        return TextContent(type="text", text="Error: dataset_id is required")
    if not color_mode and not colormap:
        return TextContent(
            type="text",
            text=(
                "Error: colormap is required (or color_mode for "
                "point-cloud/copc layers)"
            ),
        )

    result = await client.validate_layer_config(
        dataset_id=dataset_id,
        colormap=colormap,
        rescale_min=rescale_min,
        rescale_max=rescale_max,
        color_mode=color_mode,
    )

    valid = result.get("valid", False)
    error = result.get("error", "")

    style = f"Color mode: `{color_mode}`" if color_mode else f"Colormap: `{colormap}`"
    if valid:
        lines = [
            "# Layer Configuration Valid\n",
            f"Dataset: `{dataset_id}`",
            style,
        ]
        if rescale_min is not None or rescale_max is not None:
            lo = rescale_min if rescale_min is not None else "—"
            hi = rescale_max if rescale_max is not None else "—"
            lines.append(f"Rescale: [{lo}, {hi}]")
    else:
        lines = [
            "# Layer Configuration Invalid\n",
            f"Dataset: `{dataset_id}`",
            style,
        ]
        if error:
            lines.append(f"\n**Error**: {error}")
    return TextContent(type="text", text="\n".join(lines))
