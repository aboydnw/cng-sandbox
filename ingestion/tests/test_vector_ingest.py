from src.services.vector_ingest import build_table_name, get_vector_tile_url


def test_build_table_name():
    name = build_table_name("abc-123")
    assert name == "sandbox_abc123"


def test_build_table_name_sanitizes():
    name = build_table_name("abc-123-def-456")
    assert name == "sandbox_abc123def456"
    assert "-" not in name


def test_get_vector_tile_url():
    url = get_vector_tile_url("abc-123", tiler_url="http://localhost:8083")
    assert "sandbox_abc123" in url
    assert "{z}" in url
