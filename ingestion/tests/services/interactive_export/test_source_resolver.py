from types import SimpleNamespace

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
