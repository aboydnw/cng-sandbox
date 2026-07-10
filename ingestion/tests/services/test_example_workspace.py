import json
import uuid

from src.models import workspace_example_state as wes
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services import example_workspace


def _master_dataset(session, url):
    row = DatasetRow(
        id=str(uuid.uuid4()),
        filename="m.tif",
        dataset_type="cog",
        format_pair="geotiff_cog",
        tile_url="/cog/tiles/master",
        metadata_json=json.dumps({"source_url": url}),
        is_example=True,
    )
    session.add(row)
    session.commit()
    return row


def _master_story(session, dataset_id):
    chapters = [
        {
            "id": "c1",
            "order": 0,
            "type": "map",
            "title": "t",
            "narrative": "n",
            "map_state": {
                "center": [0, 0],
                "zoom": 1,
                "bearing": 0,
                "pitch": 0,
                "basemap": "voyager",
            },
            "layer_config": {
                "dataset_id": dataset_id,
                "colormap": "viridis",
                "opacity": 1.0,
                "basemap": "voyager",
            },
        }
    ]
    row = StoryRow(
        id=str(uuid.uuid4()),
        title="Master Story",
        dataset_id=dataset_id,
        chapters_json=json.dumps(chapters),
        is_example=True,
    )
    session.add(row)
    session.commit()
    return row


def test_seed_clones_masters_into_workspace(db_session):
    ds = _master_dataset(db_session, "https://data/x")
    story = _master_story(db_session, ds.id)

    result = example_workspace.seed_workspace_examples(db_session, "ws1")

    clones = (
        db_session.query(DatasetRow)
        .filter(DatasetRow.workspace_id == "ws1", DatasetRow.is_example_copy.is_(True))
        .all()
    )
    assert len(clones) == 1
    clone = clones[0]
    assert clone.is_example is False
    assert clone.seeded_from_id == ds.id
    assert clone.tile_url == ds.tile_url

    story_clones = (
        db_session.query(StoryRow)
        .filter(StoryRow.workspace_id == "ws1", StoryRow.is_example_copy.is_(True))
        .all()
    )
    assert len(story_clones) == 1
    chapters = json.loads(story_clones[0].chapters_json)
    assert chapters[0]["layer_config"]["dataset_id"] == clone.id
    assert result["story_id_map"][story.id] == story_clones[0].id
    assert wes.get_state(db_session, "ws1") == "seeded"


def test_seed_is_clean_slate(db_session):
    ds = _master_dataset(db_session, "https://data/x")
    _master_story(db_session, ds.id)
    example_workspace.seed_workspace_examples(db_session, "ws1")
    example_workspace.seed_workspace_examples(db_session, "ws1")
    copies = (
        db_session.query(DatasetRow)
        .filter(DatasetRow.workspace_id == "ws1", DatasetRow.is_example_copy.is_(True))
        .count()
    )
    assert copies == 1


def test_seed_leaves_user_rows_untouched(db_session):
    _master_dataset(db_session, "https://data/x")
    user = DatasetRow(
        id=str(uuid.uuid4()),
        filename="u.tif",
        dataset_type="cog",
        format_pair="geotiff_cog",
        tile_url="/cog/tiles/user",
        metadata_json="{}",
        workspace_id="ws1",
    )
    db_session.add(user)
    db_session.commit()
    example_workspace.seed_workspace_examples(db_session, "ws1")
    assert db_session.get(DatasetRow, user.id) is not None


def test_remove_deletes_only_copies(db_session):
    _master_dataset(db_session, "https://data/x")
    user = DatasetRow(
        id=str(uuid.uuid4()),
        filename="u.tif",
        dataset_type="cog",
        format_pair="geotiff_cog",
        tile_url="/cog/tiles/user",
        metadata_json="{}",
        workspace_id="ws1",
    )
    db_session.add(user)
    db_session.commit()
    example_workspace.seed_workspace_examples(db_session, "ws1")

    count = example_workspace.remove_workspace_examples(db_session, "ws1")

    assert count == 1
    remaining = (
        db_session.query(DatasetRow).filter(DatasetRow.workspace_id == "ws1").all()
    )
    assert [r.id for r in remaining] == [user.id]
    assert wes.get_state(db_session, "ws1") == "removed"
