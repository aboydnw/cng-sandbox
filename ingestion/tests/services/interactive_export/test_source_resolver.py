from contextlib import contextmanager
from types import SimpleNamespace

import httpx
import pytest

from src.services.interactive_export import source_resolver


def test_resolve_raster_source_passes_through_https():
    assert (
        source_resolver.resolve_raster_source("https://example.com/foo.tif")
        == "https://example.com/foo.tif"
    )


def test_resolve_raster_source_passes_through_local_path():
    assert (
        source_resolver.resolve_raster_source("/tmp/fixtures/foo.tif")
        == "/tmp/fixtures/foo.tif"
    )


def test_resolve_raster_source_translates_storage_url():
    fake_storage = SimpleNamespace(bucket="my-bucket")
    out = source_resolver.resolve_raster_source(
        "/storage/datasets/abc/converted/data.tif", storage=fake_storage
    )
    assert out == "/vsis3/my-bucket/datasets/abc/converted/data.tif"


def test_resolve_raster_source_strips_leading_slashes_in_key():
    fake_storage = SimpleNamespace(bucket="b")
    out = source_resolver.resolve_raster_source(
        "/storage///datasets/abc/data.tif", storage=fake_storage
    )
    assert out == "/vsis3/b/datasets/abc/data.tif"


def test_vector_source_path_passes_through_non_storage_url(tmp_path):
    local = tmp_path / "foo.geojson"
    local.write_text("{}")
    with source_resolver.vector_source_path(str(local)) as path:
        assert path == str(local)


def test_vector_source_path_normalizes_obstore_error_to_value_error(monkeypatch):
    def fake_get(store, key):
        raise RuntimeError("boom")

    monkeypatch.setattr(source_resolver.obstore, "get", fake_get)
    fake_storage = SimpleNamespace(bucket="b", store=object())

    import pytest

    with (
        pytest.raises(ValueError, match="vector source unavailable"),
        source_resolver.vector_source_path(
            "/storage/datasets/abc/data.geojson", storage=fake_storage
        ),
    ):
        pass


def test_vector_source_path_downloads_storage_url(monkeypatch, tmp_path):
    payload = b'{"type":"FeatureCollection","features":[]}'

    class FakeResult:
        def bytes(self):
            return payload

    seen_keys: list[str] = []

    def fake_get(store, key):
        seen_keys.append(key)
        return FakeResult()

    monkeypatch.setattr(source_resolver.obstore, "get", fake_get)
    fake_storage = SimpleNamespace(bucket="b", store=object())

    import os

    with source_resolver.vector_source_path(
        "/storage/datasets/abc/converted/data.geojson", storage=fake_storage
    ) as path:
        assert path.endswith(".geojson")
        with open(path, "rb") as f:
            assert f.read() == payload
    # tempfile cleaned up after context exit
    assert not os.path.exists(path)
    assert seen_keys == ["datasets/abc/converted/data.geojson"]


def test_fetch_trips_json_streams_http_response(monkeypatch, tmp_path):
    response = httpx.Response(
        200,
        content=b'{"tracks":[]}',
        request=httpx.Request("GET", "https://example.com/trips.json"),
    )

    @contextmanager
    def fake_stream(*args, **kwargs):
        yield response

    monkeypatch.setattr(source_resolver, "validate_url_safe", lambda _url: None)
    monkeypatch.setattr(source_resolver.httpx, "stream", fake_stream)
    out = tmp_path / "trips.json"

    source_resolver.fetch_trips_json("https://example.com/trips.json", out)

    assert out.read_bytes() == b'{"tracks":[]}'


def test_fetch_trips_json_rejects_stream_over_limit(monkeypatch, tmp_path):
    response = httpx.Response(
        200,
        content=b"123456",
        request=httpx.Request("GET", "https://example.com/trips.json"),
    )

    @contextmanager
    def fake_stream(*args, **kwargs):
        yield response

    monkeypatch.setattr(source_resolver, "validate_url_safe", lambda _url: None)
    monkeypatch.setattr(source_resolver.httpx, "stream", fake_stream)
    monkeypatch.setattr(source_resolver, "MAX_TRIPS_BYTES", 5)
    out = tmp_path / "trips.json"

    with pytest.raises(ValueError, match="exceeds the 5-byte export limit"):
        source_resolver.fetch_trips_json("https://example.com/trips.json", out)

    assert not out.exists()
