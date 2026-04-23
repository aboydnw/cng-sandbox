import uuid
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models.base import Base
from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow


def _make_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_dataset_to_dict_includes_render_mode_none_by_default():
    session = _make_session()
    row = DatasetRow(
        id=str(uuid.uuid4()),
        filename="a.tif",
        dataset_type="raster",
        format_pair="GeoTIFF->COG",
        tile_url="https://example/tiles/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
    )
    session.add(row)
    session.commit()
    assert row.to_dict()["render_mode"] is None


def test_dataset_to_dict_round_trips_render_mode():
    session = _make_session()
    row = DatasetRow(
        id=str(uuid.uuid4()),
        filename="a.tif",
        dataset_type="raster",
        format_pair="GeoTIFF->COG",
        tile_url="https://example/tiles/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
        render_mode="client",
    )
    session.add(row)
    session.commit()
    assert row.to_dict()["render_mode"] == "client"


def test_connection_to_dict_includes_render_mode_none_by_default():
    session = _make_session()
    row = ConnectionRow(
        id=str(uuid.uuid4()),
        name="c",
        url="https://example.com/x.cog",
        connection_type="cog",
        created_at=datetime.now(UTC),
    )
    session.add(row)
    session.commit()
    assert row.to_dict()["render_mode"] is None


def test_connection_to_dict_round_trips_render_mode():
    session = _make_session()
    row = ConnectionRow(
        id=str(uuid.uuid4()),
        name="c",
        url="https://example.com/x.cog",
        connection_type="cog",
        created_at=datetime.now(UTC),
        render_mode="server",
    )
    session.add(row)
    session.commit()
    assert row.to_dict()["render_mode"] == "server"
