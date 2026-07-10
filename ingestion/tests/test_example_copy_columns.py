from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow


def test_dataset_to_dict_exposes_is_example_copy(db_session):
    row = DatasetRow(
        filename="f.tif",
        dataset_type="cog",
        format_pair="geotiff_cog",
        tile_url="/cog/tiles/x",
        metadata_json="{}",
        workspace_id="ws1",
        is_example_copy=True,
        seeded_from_id="master-1",
    )
    db_session.add(row)
    db_session.commit()
    d = row.to_dict()
    assert d["is_example_copy"] is True


def test_connection_to_dict_exposes_is_example_copy(db_session):
    row = ConnectionRow(
        name="c",
        url="https://x",
        connection_type="zarr",
        workspace_id="ws1",
        is_example_copy=True,
        seeded_from_id="master-2",
    )
    db_session.add(row)
    db_session.commit()
    assert row.to_dict()["is_example_copy"] is True
