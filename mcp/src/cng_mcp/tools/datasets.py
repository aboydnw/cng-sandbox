"""Tools for dataset operations."""

from mcp.types import TextContent
from cng_mcp.client.sandbox_api import SandboxAPIClient


async def read_datasets_tool(client: SandboxAPIClient) -> TextContent:
    """List all datasets in workspace."""
    datasets = await client.get_datasets()
    if not datasets:
        return TextContent(type="text", text="No datasets found in workspace.")

    lines = ["# Datasets in Workspace\n"]
    for ds in datasets:
        ds_id = ds.get("id", "")
        filename = ds.get("filename", "")
        ds_type = ds.get("dataset_type", "")
        is_example = ds.get("is_example", False)
        metadata = ds.get("metadata", {})
        bbox = metadata.get("bbox", [])

        example_badge = " [EXAMPLE]" if is_example else ""
        lines.append(f"## {filename}{example_badge}")
        lines.append(f"- **ID**: {ds_id}")
        lines.append(f"- **Type**: {ds_type}")
        if bbox and len(bbox) == 4:
            lines.append(f"- **Bounds**: W={bbox[0]}, S={bbox[1]}, E={bbox[2]}, N={bbox[3]}")
        lines.append("")

    return TextContent(type="text", text="\n".join(lines))
