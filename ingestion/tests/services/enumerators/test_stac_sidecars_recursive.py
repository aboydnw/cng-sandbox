from unittest.mock import patch

import httpx
import pytest

from src.services.enumerators.stac_sidecars import _list_sidecars_recursive


@pytest.mark.asyncio
async def test_recursive_walks_nested_prefixes():
    """Fake a two-level tree: year/month/day containing sidecars."""
    calls = []

    async def fake_list_one_level(bucket_url: str, prefix: str):
        calls.append(prefix)
        tree = {
            "": (["2024/"], []),
            "2024/": (["2024/01/"], []),
            "2024/01/": (
                [],
                [
                    "2024/01/file1.stac-item.json",
                    "2024/01/file1.tif",
                    "2024/01/file2.stac-item.json",
                    "2024/01/file2.tif",
                ],
            ),
        }
        return tree[prefix]

    with patch(
        "src.services.enumerators.stac_sidecars._list_one_level",
        new=fake_list_one_level,
    ):
        sidecars = await _list_sidecars_recursive(
            "https://data.source.coop/testing/example/"
        )

    assert sorted(sidecars) == [
        "https://data.source.coop/testing/example/2024/01/file1.stac-item.json",
        "https://data.source.coop/testing/example/2024/01/file2.stac-item.json",
    ]
    assert sorted(calls) == sorted(["", "2024/", "2024/01/"])


@pytest.mark.asyncio
async def test_recursive_respects_start_prefix():
    """start_prefix should limit the walk to a subtree."""
    from src.services.enumerators.stac_sidecars import _list_sidecars_recursive

    calls = []

    async def fake_list_one_level(bucket_url: str, prefix: str):
        calls.append(prefix)
        tree = {
            "": (["2023/", "2024/", "2025/"], []),
            "2024/": (["2024/01/"], []),
            "2024/01/": ([], ["2024/01/a.stac-item.json"]),
        }
        return tree.get(prefix, ([], []))

    with patch(
        "src.services.enumerators.stac_sidecars._list_one_level",
        new=fake_list_one_level,
    ):
        sidecars = await _list_sidecars_recursive(
            "https://data.source.coop/testing/example/",
            start_prefix="2024/",
        )

    assert sidecars == [
        "https://data.source.coop/testing/example/2024/01/a.stac-item.json"
    ]
    assert "2023/" not in calls
    assert "2025/" not in calls
    assert "2024/" in calls
    assert "2024/01/" in calls


@pytest.mark.asyncio
async def test_recursive_depth_limit():
    """Extremely deep trees should not recurse indefinitely."""

    async def fake_list_one_level(bucket_url: str, prefix: str):
        depth = prefix.count("/")
        return ([f"{prefix}d{depth}/"], [])

    with patch(
        "src.services.enumerators.stac_sidecars._list_one_level",
        new=fake_list_one_level,
    ):
        sidecars = await _list_sidecars_recursive(
            "https://data.source.coop/testing/infinite/",
            max_depth=5,
        )

    assert sidecars == []


@pytest.mark.asyncio
async def test_list_one_level_follows_continuation_token():
    """S3 listings with IsTruncated=true should be paginated."""
    from src.services.enumerators.stac_sidecars import _list_one_level

    page1_xml = """<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>testing</Name>
  <Prefix>example/</Prefix>
  <Delimiter>/</Delimiter>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>tok-page-2</NextContinuationToken>
  <Contents><Key>example/a.stac-item.json</Key></Contents>
  <CommonPrefixes><Prefix>example/sub1/</Prefix></CommonPrefixes>
</ListBucketResult>"""

    page2_xml = """<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>testing</Name>
  <Prefix>example/</Prefix>
  <Delimiter>/</Delimiter>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>example/b.stac-item.json</Key></Contents>
  <CommonPrefixes><Prefix>example/sub2/</Prefix></CommonPrefixes>
</ListBucketResult>"""

    call_count = {"n": 0}

    async def fake_get(self, url, **kwargs):
        call_count["n"] += 1
        if "continuation-token" in url:
            assert "tok-page-2" in url
            return httpx.Response(200, text=page2_xml, request=httpx.Request("GET", url))
        return httpx.Response(200, text=page1_xml, request=httpx.Request("GET", url))

    with patch.object(httpx.AsyncClient, "get", new=fake_get):
        common, keys = await _list_one_level(
            "https://data.source.coop/testing/example/", ""
        )

    assert call_count["n"] == 2
    assert sorted(keys) == ["a.stac-item.json", "b.stac-item.json"]
    assert sorted(common) == ["sub1/", "sub2/"]
