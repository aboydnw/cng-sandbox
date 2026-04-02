"""Tests for the URL discovery service."""

from __future__ import annotations

import pytest

from src.services.discovery import DiscoveredFile, extract_file_links, fetch_and_discover


class TestExtractFileLinks:
    def test_extracts_tif_links_from_html(self):
        html = """
        <html><body>
          <a href="data1.tif">data1</a>
          <a href="data2.tif">data2</a>
          <a href="readme.html">readme</a>
        </body></html>
        """
        results = extract_file_links(html, "http://example.com/files/")
        assert len(results) == 2
        assert all(r.url.endswith(".tif") for r in results)

    def test_extracts_multiple_formats(self):
        html = """
        <html><body>
          <a href="raster.tif">tif</a>
          <a href="vectors.geojson">geojson</a>
          <a href="climate.nc">nc</a>
          <a href="notes.txt">txt</a>
        </body></html>
        """
        results = extract_file_links(html, "http://example.com/")
        assert len(results) == 1
        urls = {r.url for r in results}
        assert len(urls) == 1

    def test_resolves_relative_urls(self):
        html = '<html><body><a href="subdir/file.tif">file</a></body></html>'
        results = extract_file_links(html, "http://example.com/data/")
        assert len(results) == 1
        assert results[0].url == "http://example.com/data/subdir/file.tif"
        assert results[0].filename == "file.tif"

    def test_deduplicates_links(self):
        html = """
        <html><body>
          <a href="data.tif">link1</a>
          <a href="data.tif">link2</a>
        </body></html>
        """
        results = extract_file_links(html, "http://example.com/")
        assert len(results) == 1

    def test_returns_empty_for_no_geospatial_files(self):
        html = '<html><body><a href="readme.md">readme</a></body></html>'
        results = extract_file_links(html, "http://example.com/")
        assert results == []

    def test_filters_to_most_common_extension(self):
        html = """
        <html><body>
          <a href="a.tif">a</a>
          <a href="b.tif">b</a>
          <a href="c.tif">c</a>
          <a href="d.geojson">d</a>
        </body></html>
        """
        results = extract_file_links(html, "http://example.com/")
        assert len(results) == 3
        assert all(r.url.endswith(".tif") for r in results)


class TestFetchAndDiscover:
    @pytest.mark.asyncio
    async def test_fetches_html_and_extracts_links(self, monkeypatch):
        html = """
        <html><body>
          <a href="dataset.tif">dataset</a>
        </body></html>
        """

        class FakeResponse:
            headers = {"content-type": "text/html"}
            text = html

        class FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def get(self, url):
                return FakeResponse()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

        results = await fetch_and_discover("http://example.com/files/")
        assert len(results) == 1
        assert results[0].filename == "dataset.tif"
        assert results[0].url == "http://example.com/files/dataset.tif"
