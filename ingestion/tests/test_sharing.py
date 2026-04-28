import json

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services import sharing


def _make_dataset(session, **kwargs):
    defaults = dict(
        id=kwargs.pop("id", "d1"),
        filename="x.tif",
        dataset_type="raster",
        format_pair="geotiff_to_cog",
        tile_url="/raster/x",
        workspace_id=kwargs.pop("workspace_id", "ownerWS"),
    )
    defaults.update(kwargs)
    row = DatasetRow(**defaults)
    session.add(row)
    session.commit()
    return row


def _make_connection(session, **kwargs):
    defaults = dict(
        id=kwargs.pop("id", "c1"),
        name="X",
        url="https://example.com/x.pmtiles",
        connection_type="pmtiles",
        workspace_id=kwargs.pop("workspace_id", "ownerWS"),
    )
    defaults.update(kwargs)
    row = ConnectionRow(**defaults)
    session.add(row)
    session.commit()
    return row


def _make_story(session, *, published, dataset_id=None, chapter_layer_config=None):
    chapters = []
    if chapter_layer_config is not None:
        chapters.append(
            {
                "id": "ch1",
                "order": 0,
                "type": "scrollytelling",
                "title": "C",
                "narrative": "",
                "map_state": {},
                "transition": "fly-to",
                "overlay_position": "left",
                "layer_config": chapter_layer_config,
            }
        )
    row = StoryRow(
        id="s1",
        title="S",
        dataset_id=dataset_id,
        chapters_json=json.dumps(chapters),
        published=published,
        workspace_id="ownerWS",
    )
    session.add(row)
    session.commit()
    return row


def test_owner_can_read_dataset(db_session):
    row = _make_dataset(db_session)
    assert sharing.can_read_dataset(db_session, row, "ownerWS") is True


def test_non_owner_cannot_read_private_dataset(db_session):
    row = _make_dataset(db_session)
    assert sharing.can_read_dataset(db_session, row, "otherWS") is False


def test_anonymous_cannot_read_private_dataset(db_session):
    row = _make_dataset(db_session)
    assert sharing.can_read_dataset(db_session, row, "") is False


def test_example_dataset_readable_by_anyone(db_session):
    row = _make_dataset(db_session, is_example=True, workspace_id=None)
    assert sharing.can_read_dataset(db_session, row, "") is True


def test_shared_dataset_readable_by_anyone(db_session):
    row = _make_dataset(db_session, is_shared=True)
    assert sharing.can_read_dataset(db_session, row, "") is True


def test_dataset_referenced_by_published_story_readable(db_session):
    row = _make_dataset(db_session)
    _make_story(db_session, published=True, chapter_layer_config={"dataset_id": row.id})
    assert sharing.can_read_dataset(db_session, row, "") is True


def test_dataset_referenced_by_unpublished_story_not_readable(db_session):
    row = _make_dataset(db_session)
    _make_story(
        db_session, published=False, chapter_layer_config={"dataset_id": row.id}
    )
    assert sharing.can_read_dataset(db_session, row, "") is False


def test_dataset_referenced_by_top_level_published_story_readable(db_session):
    row = _make_dataset(db_session)
    _make_story(db_session, published=True, dataset_id=row.id)
    assert sharing.can_read_dataset(db_session, row, "") is True


def test_owner_can_read_connection(db_session):
    row = _make_connection(db_session)
    assert sharing.can_read_connection(db_session, row, "ownerWS") is True


def test_non_owner_cannot_read_private_connection(db_session):
    row = _make_connection(db_session)
    assert sharing.can_read_connection(db_session, row, "otherWS") is False


def test_anonymous_cannot_read_private_connection(db_session):
    row = _make_connection(db_session)
    assert sharing.can_read_connection(db_session, row, "") is False


def test_shared_connection_readable_by_anyone(db_session):
    row = _make_connection(db_session, is_shared=True)
    assert sharing.can_read_connection(db_session, row, "") is True


def test_connection_referenced_by_published_story_readable(db_session):
    row = _make_connection(db_session)
    _make_story(
        db_session, published=True, chapter_layer_config={"connection_id": row.id}
    )
    assert sharing.can_read_connection(db_session, row, "") is True


def test_connection_referenced_by_unpublished_story_not_readable(db_session):
    row = _make_connection(db_session)
    _make_story(
        db_session, published=False, chapter_layer_config={"connection_id": row.id}
    )
    assert sharing.can_read_connection(db_session, row, "") is False


def _make_story_with_chart(session, *, published, chart_source):
    chapter = {
        "id": "ch1",
        "order": 0,
        "type": "chart",
        "title": "Chart chapter",
        "chart": {"source": chart_source},
    }
    row = StoryRow(
        id="s1",
        title="S",
        dataset_id=None,
        chapters_json=json.dumps([chapter]),
        published=published,
        workspace_id="ownerWS",
    )
    session.add(row)
    session.commit()
    return row


def test_dataset_timeseries_chart_source_grants_read(db_session):
    row = _make_dataset(db_session)
    _make_story_with_chart(
        db_session,
        published=True,
        chart_source={"kind": "dataset_timeseries", "dataset_id": row.id, "point": [0, 0]},
    )
    assert sharing.is_dataset_referenced_by_published_story(db_session, row.id) is True
    assert sharing.is_dataset_referenced_by_published_story(db_session, "ds-other") is False


def test_dataset_histogram_chart_source_grants_read(db_session):
    row = _make_dataset(db_session)
    _make_story_with_chart(
        db_session,
        published=True,
        chart_source={"kind": "dataset_histogram", "dataset_id": row.id},
    )
    assert sharing.is_dataset_referenced_by_published_story(db_session, row.id) is True


def test_chart_source_unpublished_story_does_not_grant_read(db_session):
    row = _make_dataset(db_session)
    _make_story_with_chart(
        db_session,
        published=False,
        chart_source={"kind": "dataset_timeseries", "dataset_id": row.id, "point": [0, 0]},
    )
    assert sharing.is_dataset_referenced_by_published_story(db_session, row.id) is False


def test_csv_chart_source_does_not_match_dataset(db_session):
    row = _make_dataset(db_session)
    _make_story_with_chart(
        db_session,
        published=True,
        chart_source={"kind": "csv", "url": "https://example.com/data.csv"},
    )
    assert sharing.is_dataset_referenced_by_published_story(db_session, row.id) is False
