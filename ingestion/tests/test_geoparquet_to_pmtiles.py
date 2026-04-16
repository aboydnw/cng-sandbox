"""Tests for the GeoParquet → PMTiles conversion service."""

import shutil
from pathlib import Path

import pytest

from src.services import geoparquet_to_pmtiles

FIXTURE = Path(__file__).parent / "fixtures" / "tiny.parquet"

needs_tippecanoe = pytest.mark.skipif(
    shutil.which("tippecanoe") is None, reason="tippecanoe not installed"
)


@needs_tippecanoe
def test_convert_local_parquet_to_pmtiles(tmp_path):
    out = tmp_path / "tiny.pmtiles"
    result = geoparquet_to_pmtiles.convert_to_pmtiles(
        source_url=str(FIXTURE),
        output_path=str(out),
    )
    assert out.exists()
    assert out.stat().st_size > 0
    assert result.feature_count == 10
    assert result.min_zoom is not None
    assert result.max_zoom is not None


@needs_tippecanoe
def test_pmtiles_output_is_readable(tmp_path):
    out = tmp_path / "tiny.pmtiles"
    geoparquet_to_pmtiles.convert_to_pmtiles(
        source_url=str(FIXTURE),
        output_path=str(out),
    )
    # PMTiles v3 header: magic at byte 0, min_zoom at byte 100, max_zoom at byte 101.
    with out.open("rb") as fh:
        header = fh.read(102)
    assert header[:7] == b"PMTiles"
    min_zoom, max_zoom = header[100], header[101]
    assert min_zoom <= max_zoom


def test_upload_pmtiles_uses_storage_and_returns_proxy_url(tmp_path):
    out = tmp_path / "x.pmtiles"
    out.write_bytes(b"fake-pmtiles-bytes")

    uploaded = {}

    class FakeStorage:
        def upload_file(self, file_path, key):
            uploaded["file_path"] = file_path
            uploaded["key"] = key

    tile_url = geoparquet_to_pmtiles.upload_pmtiles(
        str(out), "conn-123", storage=FakeStorage()
    )
    assert uploaded["key"] == "connections/conn-123/data.pmtiles"
    assert uploaded["file_path"] == str(out)
    assert tile_url == "/pmtiles/connections/conn-123/data.pmtiles"


def test_run_conversion_updates_connection_row(db_session, monkeypatch):
    import uuid

    from src.models.connection import ConnectionRow

    conn_id = str(uuid.uuid4())
    db_session.add(
        ConnectionRow(
            id=conn_id,
            name="t",
            url="https://example.com/tiny.parquet",
            connection_type="geoparquet",
            render_path="server",
            conversion_status="pending",
            workspace_id="ws-1",
        )
    )
    db_session.commit()

    monkeypatch.setattr(
        geoparquet_to_pmtiles,
        "convert_to_pmtiles",
        lambda source_url, output_path: geoparquet_to_pmtiles.ConversionResult(
            output_path=output_path,
            feature_count=10,
            min_zoom=0,
            max_zoom=9,
            file_size=3500,
        ),
    )
    monkeypatch.setattr(
        geoparquet_to_pmtiles,
        "upload_pmtiles",
        lambda path, cid, storage=None: f"/pmtiles/connections/{cid}/data.pmtiles",
    )

    geoparquet_to_pmtiles.run_conversion(conn_id, db_session)

    row = db_session.get(ConnectionRow, conn_id)
    assert row.conversion_status == "ready"
    assert row.tile_url == f"/pmtiles/connections/{conn_id}/data.pmtiles"
    assert row.feature_count == 10
    assert row.tile_type == "vector"
    assert row.conversion_error is None


def test_run_conversion_marks_failed_on_error(db_session, monkeypatch):
    import uuid

    from src.models.connection import ConnectionRow

    conn_id = str(uuid.uuid4())
    db_session.add(
        ConnectionRow(
            id=conn_id,
            name="t",
            url="/nonexistent/path.parquet",
            connection_type="geoparquet",
            render_path="server",
            conversion_status="pending",
            workspace_id="ws-1",
        )
    )
    db_session.commit()

    geoparquet_to_pmtiles.run_conversion(conn_id, db_session)

    row = db_session.get(ConnectionRow, conn_id)
    assert row.conversion_status == "failed"
    assert row.conversion_error is not None


def test_run_conversion_no_op_when_row_missing(db_session):
    geoparquet_to_pmtiles.run_conversion("does-not-exist", db_session)
    # should not raise
