from datetime import UTC, datetime, timedelta

from src.models import expiry
from src.models.dataset import DatasetRow
from src.models.story import StoryRow


def _make_dataset_row(**overrides) -> DatasetRow:
    defaults = {
        "id": "ds-1",
        "filename": "f.tif",
        "dataset_type": "raster",
        "format_pair": "geotiff-to-cog",
        "tile_url": "/tiles/f",
        "created_at": datetime(2026, 6, 1, tzinfo=UTC),
    }
    defaults.update(overrides)
    return DatasetRow(**defaults)


def test_effective_expires_at_defaults_to_created_plus_retention():
    created = datetime(2026, 6, 1, tzinfo=UTC)
    assert expiry.effective_expires_at(created) == created + timedelta(
        days=expiry.RETENTION_DAYS
    )


def test_effective_expires_at_prefers_explicit_expiry():
    created = datetime(2026, 6, 1, tzinfo=UTC)
    explicit = datetime(2026, 6, 5, tzinfo=UTC)
    assert expiry.effective_expires_at(created, explicit) == explicit


def test_effective_expires_at_is_none_for_examples():
    created = datetime(2026, 6, 1, tzinfo=UTC)
    explicit = datetime(2026, 6, 5, tzinfo=UTC)
    assert expiry.effective_expires_at(created, explicit, is_example=True) is None


def test_dataset_to_dict_computes_expires_at_from_created_at():
    row = _make_dataset_row()
    expected = row.created_at + timedelta(days=expiry.RETENTION_DAYS)
    assert row.to_dict()["expires_at"] == expected.isoformat()


def test_dataset_to_dict_keeps_explicit_expires_at():
    explicit = datetime(2026, 6, 5, tzinfo=UTC)
    row = _make_dataset_row(expires_at=explicit)
    assert row.to_dict()["expires_at"] == explicit.isoformat()


def test_example_dataset_to_dict_has_null_expires_at():
    row = _make_dataset_row(
        is_example=True, expires_at=datetime(2026, 6, 5, tzinfo=UTC)
    )
    assert row.to_dict()["expires_at"] is None


def test_story_response_includes_expires_at(client):
    resp = client.post("/api/stories", json={"title": "Expiring story"})
    assert resp.status_code == 201
    data = resp.json()
    created = datetime.fromisoformat(data["created_at"])
    expected = created + timedelta(days=expiry.RETENTION_DAYS)
    assert datetime.fromisoformat(data["expires_at"]) == expected


def test_example_story_has_null_expires_at(client, db_session):
    db_session.add(
        StoryRow(
            id="example-story",
            title="Example",
            is_example=True,
            created_at=datetime(2026, 6, 1, tzinfo=UTC),
            updated_at=datetime(2026, 6, 1, tzinfo=UTC),
        )
    )
    db_session.commit()

    resp = client.get("/api/stories/examples")
    assert resp.status_code == 200
    stories = {s["id"]: s for s in resp.json()}
    assert stories["example-story"]["expires_at"] is None
