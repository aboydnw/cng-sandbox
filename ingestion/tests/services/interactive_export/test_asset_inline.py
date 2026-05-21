import httpx

from src.services.interactive_export import asset_inline


def test_fetch_writes_to_assets_dir(tmp_path, monkeypatch):
    def fake_get(url, *args, **kwargs):
        request = httpx.Request("GET", url)
        return httpx.Response(
            200,
            content=b"\x89PNG\r\n\x1a\n" + b"\x00" * 16,
            request=request,
            headers={"content-type": "image/png"},
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    monkeypatch.setattr(asset_inline, "validate_url_safe", lambda url: None)

    out = asset_inline.fetch_into(
        url="https://example.com/x.png",
        assets_dir=tmp_path,
        slug="ch1-image",
    )
    assert out == "ch1-image.png"
    assert (tmp_path / "ch1-image.png").read_bytes().startswith(b"\x89PNG")


def test_fetch_uses_url_extension_when_content_type_missing(tmp_path, monkeypatch):
    def fake_get(url, *args, **kwargs):
        return httpx.Response(200, content=b"GIF89a", request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    monkeypatch.setattr(asset_inline, "validate_url_safe", lambda url: None)

    out = asset_inline.fetch_into(
        url="https://example.com/x.gif",
        assets_dir=tmp_path,
        slug="ch1-image",
    )
    assert out == "ch1-image.gif"


def test_fetch_failure_returns_none(tmp_path, monkeypatch):
    def fake_get(url, *args, **kwargs):
        return httpx.Response(404, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    monkeypatch.setattr(asset_inline, "validate_url_safe", lambda url: None)

    out = asset_inline.fetch_into(
        url="https://example.com/missing.png",
        assets_dir=tmp_path,
        slug="ch1-image",
    )
    assert out is None


def test_fetch_rejects_disallowed_url(tmp_path, monkeypatch):
    from src.services.url_validation import SSRFError

    def bad_validate(url):
        raise SSRFError("disallowed")

    monkeypatch.setattr(asset_inline, "validate_url_safe", bad_validate)

    out = asset_inline.fetch_into(
        url="http://127.0.0.1/x.png",
        assets_dir=tmp_path,
        slug="ch1-image",
    )
    assert out is None
