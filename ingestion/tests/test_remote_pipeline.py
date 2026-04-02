from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from src.models import Job, JobStatus
from src.services.cog_checker import CogCheckResult


@dataclass
class FakeBandMeta:
    band_count: int
    band_names: list[str]
    color_interpretation: list[str]
    dtype: str


class TestReadRemoteBounds:
    @pytest.mark.asyncio
    async def test_returns_bbox_and_geojson(self, monkeypatch):
        import rasterio
        from src.services import remote_pipeline

        class FakeSrc:
            crs = None
            bounds = type("B", (), {"left": -10, "bottom": -20, "right": 10, "top": 20})()

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

        monkeypatch.setattr(rasterio, "open", lambda path: FakeSrc())

        bbox, geom = await remote_pipeline.read_remote_bounds("https://example.com/file.tif")
        assert bbox == [-10, -20, 10, 20]
        assert geom["type"] == "Polygon"
        assert len(geom["coordinates"][0]) == 5


class TestEstimateTotalSize:
    @pytest.mark.asyncio
    async def test_estimates_from_content_length(self, monkeypatch):
        from src.services import remote_pipeline

        class FakeResponse:
            headers = {"content-length": "1000"}

        class FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                pass

            async def head(self, url, follow_redirects=True):
                return FakeResponse()

        monkeypatch.setattr(remote_pipeline.httpx, "AsyncClient", lambda **kw: FakeClient())

        result = await remote_pipeline._estimate_total_size(
            ["http://a.tif", "http://b.tif", "http://c.tif", "http://d.tif"]
        )
        assert result == 4000

    @pytest.mark.asyncio
    async def test_returns_none_when_no_sizes(self, monkeypatch):
        from src.services import remote_pipeline

        class FakeResponse:
            headers = {}

        class FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                pass

            async def head(self, url, follow_redirects=True):
                return FakeResponse()

        monkeypatch.setattr(remote_pipeline.httpx, "AsyncClient", lambda **kw: FakeClient())

        result = await remote_pipeline._estimate_total_size(["http://a.tif"])
        assert result is None


class TestRunRemotePipeline:
    @pytest.mark.asyncio
    async def test_zero_copy_mosaic_sets_ready_status(self, monkeypatch):
        from src.services import remote_pipeline

        job = Job(filename="test.tif", workspace_id="ws1")

        monkeypatch.setattr(
            remote_pipeline,
            "check_remote_is_cog",
            lambda url: _async_return(CogCheckResult(is_cog=True, has_tiling=True, has_overviews=True)),
        )

        sample_bbox = [-10.0, -20.0, 10.0, 20.0]
        sample_geom = {
            "type": "Polygon",
            "coordinates": [[[-10, -20], [10, -20], [10, 20], [-10, 20], [-10, -20]]],
        }
        monkeypatch.setattr(
            remote_pipeline,
            "read_remote_bounds",
            lambda url: _async_return((sample_bbox, sample_geom)),
        )

        monkeypatch.setattr(
            remote_pipeline.stac_ingest,
            "ingest_mosaic_raster",
            lambda **kw: _async_return("/raster/collections/sandbox-x/tiles/{z}/{x}/{y}"),
        )

        persisted = []
        monkeypatch.setattr(
            remote_pipeline,
            "persist_dataset",
            lambda factory, ds: persisted.append(ds),
        )

        import rasterio

        class FakeRemoteSrc:
            count = 1
            descriptions = ["Band 1"]
            colorinterp = [rasterio.enums.ColorInterp.gray]
            dtypes = ["float32"]

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

        monkeypatch.setattr(
            "rasterio.open",
            lambda path: FakeRemoteSrc(),
        )

        discovered = [
            {"url": "https://example.com/a.tif", "filename": "a.tif"},
            {"url": "https://example.com/b.tif", "filename": "b.tif"},
        ]

        await remote_pipeline.run_remote_pipeline(
            job, discovered, mode="mosaic", db_session_factory=MagicMock()
        )

        assert job.status == JobStatus.READY
        assert len(persisted) == 1
        ds = persisted[0]
        assert ds.is_zero_copy is True
        assert ds.is_mosaic is True
        assert ds.is_temporal is False
        assert ds.expires_at is None

    @pytest.mark.asyncio
    async def test_zero_copy_temporal_orders_files(self, monkeypatch):
        from src.services import remote_pipeline

        job = Job(filename="test.tif", workspace_id="ws1")

        monkeypatch.setattr(
            remote_pipeline,
            "check_remote_is_cog",
            lambda url: _async_return(CogCheckResult(is_cog=True, has_tiling=True, has_overviews=True)),
        )

        sample_bbox = [0.0, 0.0, 1.0, 1.0]
        sample_geom = {
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        }
        monkeypatch.setattr(
            remote_pipeline,
            "read_remote_bounds",
            lambda url: _async_return((sample_bbox, sample_geom)),
        )

        ingested_datetimes = []

        async def fake_ingest(**kw):
            ingested_datetimes.extend(kw.get("datetimes", []))
            return "/raster/tiles/{z}/{x}/{y}"

        monkeypatch.setattr(remote_pipeline.stac_ingest, "ingest_mosaic_raster", fake_ingest)

        persisted = []
        monkeypatch.setattr(
            remote_pipeline,
            "persist_dataset",
            lambda factory, ds: persisted.append(ds),
        )

        import rasterio

        class FakeRemoteSrc:
            count = 1
            descriptions = ["B1"]
            colorinterp = [rasterio.enums.ColorInterp.gray]
            dtypes = ["uint8"]

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

        monkeypatch.setattr("rasterio.open", lambda path: FakeRemoteSrc())

        discovered = [
            {"url": "https://example.com/data_2024-03-01.tif", "filename": "data_2024-03-01.tif"},
            {"url": "https://example.com/data_2024-01-01.tif", "filename": "data_2024-01-01.tif"},
        ]

        await remote_pipeline.run_remote_pipeline(
            job, discovered, mode="temporal", db_session_factory=MagicMock()
        )

        assert job.status == JobStatus.READY
        ds = persisted[0]
        assert ds.is_temporal is True
        assert len(ds.timesteps) == 2
        assert len(ingested_datetimes) == 2
        assert ingested_datetimes[0] < ingested_datetimes[1]

    @pytest.mark.asyncio
    async def test_pipeline_sets_failed_on_exception(self, monkeypatch):
        from src.services import remote_pipeline

        job = Job(filename="test.tif")

        monkeypatch.setattr(
            remote_pipeline,
            "check_remote_is_cog",
            lambda url: _async_raise(RuntimeError("network error")),
        )

        await remote_pipeline.run_remote_pipeline(
            job,
            [{"url": "https://example.com/a.tif", "filename": "a.tif"}],
            mode="mosaic",
            db_session_factory=MagicMock(),
        )

        assert job.status == JobStatus.FAILED
        assert "network error" in job.error

    @pytest.mark.asyncio
    async def test_rejects_oversized_non_cog(self, monkeypatch):
        from src.services import remote_pipeline

        job = Job(filename="test.tif")

        monkeypatch.setattr(
            remote_pipeline,
            "check_remote_is_cog",
            lambda url: _async_return(CogCheckResult(is_cog=False, has_tiling=False, has_overviews=False)),
        )

        monkeypatch.setattr(
            remote_pipeline,
            "_estimate_total_size",
            lambda urls: _async_return(20_000_000_000),
        )

        await remote_pipeline.run_remote_pipeline(
            job,
            [{"url": "https://example.com/a.tif", "filename": "a.tif"}],
            mode="mosaic",
            db_session_factory=MagicMock(),
        )

        assert job.status == JobStatus.FAILED
        assert "limit" in job.error.lower()


async def _async_return(value):
    return value


async def _async_raise(exc):
    raise exc
