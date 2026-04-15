"""MCP Server for CNG Sandbox."""

import asyncio
import logging
from mcp.server import Server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_server(sandbox_api_url: str) -> Server:
    """Create and configure MCP server."""
    server = Server("cng-sandbox")
    return server


async def main():
    """Run the MCP server."""
    import os
    sandbox_api_url = os.getenv("SANDBOX_API_URL", "http://localhost:8086")
    server = create_server(sandbox_api_url=sandbox_api_url)
    logger.info(f"CNG MCP Server starting (API: {sandbox_api_url})")
    async with server:
        logger.info("CNG MCP Server running")
        await asyncio.sleep(float('inf'))


def main_cli():
    """Synchronous entry point for CLI script."""
    asyncio.run(main())


if __name__ == "__main__":
    main_cli()
