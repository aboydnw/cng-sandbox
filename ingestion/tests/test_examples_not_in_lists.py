import uuid

from src.models.dataset import DatasetRow


def _add_master_dataset(app):
    session = app.state.db_session_factory()
    try:
        row = DatasetRow(
            id=str(uuid.uuid4()),
            filename="m.tif",
            dataset_type="cog",
            format_pair="geotiff_cog",
            tile_url="/cog/tiles/master",
            metadata_json="{}",
            is_example=True,
        )
        session.add(row)
        session.commit()
        return row.id
    finally:
        session.close()


def test_master_examples_excluded_from_dataset_list(client, app):
    _add_master_dataset(app)
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    assert resp.json() == []


def test_deleting_example_copy_does_not_teardown_storage(client, app, monkeypatch):
    import src.routes.datasets as datasets_route

    def _boom(*args, **kwargs):
        raise AssertionError("delete_dataset must not run for example copies")

    monkeypatch.setattr(datasets_route, "delete_dataset", _boom)

    session = app.state.db_session_factory()
    try:
        clone = DatasetRow(
            id=str(uuid.uuid4()),
            filename="c.tif",
            dataset_type="cog",
            format_pair="geotiff_cog",
            tile_url="/cog/tiles/shared",
            metadata_json="{}",
            workspace_id="testABCD",
            is_example_copy=True,
            seeded_from_id="master-1",
        )
        session.add(clone)
        session.commit()
        clone_id = clone.id
    finally:
        session.close()

    resp = client.delete(f"/api/datasets/{clone_id}")
    assert resp.status_code in (200, 204), resp.text
