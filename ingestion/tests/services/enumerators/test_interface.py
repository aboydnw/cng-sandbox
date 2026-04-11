from datetime import datetime, UTC

from src.services.enumerators import RemoteItem


def test_remote_item_accepts_minimum_fields():
    item = RemoteItem(
        href="https://data.source.coop/example/file.tif",
        datetime=None,
        bbox=None,
    )
    assert item.href == "https://data.source.coop/example/file.tif"
    assert item.datetime is None
    assert item.bbox is None


def test_remote_item_accepts_full_fields():
    dt = datetime(2024, 1, 1, tzinfo=UTC)
    item = RemoteItem(
        href="https://data.source.coop/example/file.tif",
        datetime=dt,
        bbox=[-10.0, -5.0, 10.0, 5.0],
    )
    assert item.datetime == dt
    assert item.bbox == [-10.0, -5.0, 10.0, 5.0]
