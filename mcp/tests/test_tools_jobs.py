import pytest
from unittest.mock import AsyncMock, MagicMock
from mcp.types import TextContent
from cng_mcp.tools.jobs import get_job_status_tool, poll_job
from cng_mcp.client.sandbox_api import SandboxAPIClient


def _make_response(json_data):
    response = MagicMock()
    response.json = MagicMock(return_value=json_data)
    response.raise_for_status = MagicMock()
    return response


@pytest.mark.asyncio
async def test_get_job_status_tool(mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response(
        {"id": "job1", "status": "ready", "dataset_id": "ds1"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    result = await get_job_status_tool(client, job_id="job1")
    assert isinstance(result, TextContent)
    assert "ready" in result.text
    assert "ds1" in result.text


@pytest.mark.asyncio
async def test_poll_job_returns_on_ready(mock_http_client):
    responses = [
        _make_response({"id": "j", "status": "converting"}),
        _make_response({"id": "j", "status": "ready", "dataset_id": "ds1"}),
    ]
    mock_http_client.get = AsyncMock(side_effect=responses)
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    sleeps = AsyncMock()
    job = await poll_job(client, "j", interval=0, timeout=10, sleep=sleeps)
    assert job["status"] == "ready"
    assert mock_http_client.get.await_count == 2


@pytest.mark.asyncio
async def test_poll_job_times_out(mock_http_client):
    mock_http_client.get = AsyncMock(return_value=_make_response({"id": "j", "status": "converting"}))
    client = SandboxAPIClient(api_url="http://localhost:8086", http_client=mock_http_client)
    calls = {"n": 0}

    async def fake_sleep(_):
        calls["n"] += 1

    monotonic_vals = iter([0.0, 5.0, 11.0])

    with pytest.raises(TimeoutError):
        await poll_job(client, "j", interval=0, timeout=10, sleep=fake_sleep,
                       _now=lambda: next(monotonic_vals))
