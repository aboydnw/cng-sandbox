"""Colormaps resource - valid colormap names for datasets."""


async def list_colormaps_resource() -> str:
    """Generate a list of available colormaps."""
    colormaps = {
        "viridis": "Perceptually uniform, colorblind-friendly",
        "plasma": "High contrast, good for diverging data",
        "inferno": "Dark background, good for heat maps",
        "magma": "Sequential, good for low-to-high ranges",
        "cividis": "Colorblind-friendly, optimized for visibility",
        "twilight": "Cyclic, good for directional data",
        "RdBu": "Diverging red-to-blue, good for anomalies",
        "RdYlGn": "Diverging, natural for positive/negative contrasts",
        "gray": "Grayscale",
        "binary": "Black and white",
    }

    lines = ["# Available Colormaps\n",
             "Use these colormap names when configuring layers in stories.\n\n",
             "## Sequential (for ordered data like elevation, temperature)\n"]
    for cm in ["viridis", "plasma", "inferno", "magma", "cividis"]:
        lines.append(f"- `{cm}` — {colormaps[cm]}")

    lines.append("\n## Diverging (for data with a midpoint like anomalies)\n")
    for cm in ["RdBu", "RdYlGn"]:
        lines.append(f"- `{cm}` — {colormaps[cm]}")

    lines.append("\n## Cyclic (for directional or phase data)\n")
    lines.append(f"- `twilight` — {colormaps['twilight']}")

    lines.append("\n## Grayscale\n")
    for cm in ["gray", "binary"]:
        lines.append(f"- `{cm}` — {colormaps[cm]}")

    return "\n".join(lines)
