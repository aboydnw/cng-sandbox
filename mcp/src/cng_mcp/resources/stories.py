"""Story templates resource."""


async def list_story_templates_resource() -> str:
    """Generate a list of story templates agents can use."""
    templates = [
        {
            "name": "Regional Comparison",
            "description": "Compare datasets across geographic regions",
            "structure": [
                {"title": "Overview", "description": "Show global or continental view"},
                {"title": "Regional Focus", "description": "Zoom into specific area"},
                {"title": "Insights", "description": "Summary and takeaways"},
            ],
        },
        {
            "name": "Time Series Analysis",
            "description": "Show temporal trends in data",
            "structure": [
                {"title": "Baseline", "description": "Initial state"},
                {"title": "Mid-period", "description": "Transition period"},
                {"title": "Recent", "description": "Current state"},
                {"title": "Trends", "description": "Analysis of changes"},
            ],
        },
        {
            "name": "Data Exploration",
            "description": "Free-form exploration of a single dataset",
            "structure": [
                {"title": "Overview", "description": "Full extent"},
                {"title": "Detail", "description": "Zoomed perspective"},
            ],
        },
    ]

    lines = ["# Story Templates\n",
             "Use these templates as starting points for agent-driven story creation.\n"]
    for template in templates:
        lines.append(f"## {template['name']}\n")
        lines.append(f"{template['description']}\n")
        lines.append("**Structure:**\n")
        for i, chapter_desc in enumerate(template["structure"], 1):
            lines.append(f"  {i}. **{chapter_desc['title']}**: {chapter_desc['description']}")
        lines.append("")
    return "\n".join(lines)
