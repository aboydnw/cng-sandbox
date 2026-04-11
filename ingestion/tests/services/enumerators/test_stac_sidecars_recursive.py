from unittest.mock import patch

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
