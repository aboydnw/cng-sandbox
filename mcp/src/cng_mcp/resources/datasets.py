"""Datasets catalog resource."""

from cng_mcp.client.sandbox_api import SandboxAPIClient


async def list_datasets_resource(client: SandboxAPIClient) -> str:
    """Generate a formatted list of available datasets."""
    datasets = await client.get_datasets()
    if not datasets:
        return "No datasets available in workspace."

    lines = ["# Available Datasets\n"]
    for ds in datasets:
        ds_id = ds.get("id", "unknown")
        filename = ds.get("filename", "unknown")
        ds_type = ds.get("dataset_type", "unknown")
        is_example = ds.get("is_example", False)
        metadata = ds.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        bbox = metadata.get("bbox", [])
        crs = metadata.get("crs", "")
        example_note = " (example)" if is_example else ""
        lines.append(f"## {filename}{example_note}\n")
        lines.append(f"- **ID**: `{ds_id}`")
        lines.append(f"- **Type**: {ds_type}")
        lines.append(f"- **CRS**: {crs}")
        if bbox:
            lines.append(f"- **Bounds**: {bbox}")
        lines.append("")
    return "\n".join(lines)
