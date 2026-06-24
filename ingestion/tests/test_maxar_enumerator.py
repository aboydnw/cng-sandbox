import pathlib

import httpx
import pytest

from src.services.enumerators.maxar import enumerate_maxar_event

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "maxar"


def _local_transport():
    def handler(request: httpx.Request) -> httpx.Response:
        name = request.url.path.rsplit("/", 1)[-1]
        body = (FIXTURES / name).read_text()
        return httpx.Response(200, text=body)

    return httpx.MockTransport(handler)


@pytest.fixture
def _patch_client(monkeypatch):
    transport = _local_transport()
    orig = httpx.AsyncClient

    def patched(*args, **kwargs):
        kwargs["transport"] = transport
        return orig(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", patched)


async def test_enumerate_maxar_event_yields_visual_hrefs(_patch_client):
    items = await enumerate_maxar_event("https://maxar/collection.json")

    hrefs = sorted(i.href for i in items)
    assert hrefs == ["https://maxar/a/visual.tif", "https://maxar/b/visual.tif"]
    assert all(i.bbox is not None for i in items)
    assert all(i.datetime is not None for i in items)


async def test_enumerate_maxar_event_filters_by_date(_patch_client):
    items = await enumerate_maxar_event(
        "https://maxar/collection.json", max_date="2023-08-31T00:00:00Z"
    )

    assert [i.href for i in items] == ["https://maxar/a/visual.tif"]


async def test_enumerate_maxar_event_rejects_naive_date_bound(_patch_client):
    with pytest.raises(ValueError):
        await enumerate_maxar_event(
            "https://maxar/collection.json", max_date="2023-08-31"
        )
