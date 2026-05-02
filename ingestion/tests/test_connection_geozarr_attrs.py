"""ConnectionRow round-trips the geozarr_attrs field."""

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models.base import Base
from src.models.connection import ConnectionRow


def _make_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_geozarr_attrs_persisted_and_serialized():
    session = _make_session()
    try:
        attrs = {
            "spatial:dimensions": ["latitude", "longitude"],
            "spatial:transform": [0.1, 0, -180, 0, -0.1, 90],
            "spatial:shape": [1800, 3600],
            "proj:code": "EPSG:4326",
        }
        row = ConnectionRow(
            id=str(uuid.uuid4()),
            name="t",
            url="https://example.com/x.zarr",
            connection_type="zarr",
            geozarr_attrs=attrs,
            created_at=datetime.now(UTC),
        )
        session.add(row)
        session.commit()

        fetched = session.query(ConnectionRow).first()
        assert fetched.geozarr_attrs == attrs
        assert fetched.to_dict()["geozarr_attrs"] == attrs
    finally:
        session.close()


def test_geozarr_attrs_defaults_to_none():
    session = _make_session()
    try:
        row = ConnectionRow(
            id=str(uuid.uuid4()),
            name="t",
            url="https://example.com/x.zarr",
            connection_type="zarr",
            created_at=datetime.now(UTC),
        )
        session.add(row)
        session.commit()
        assert session.query(ConnectionRow).first().geozarr_attrs is None
        assert session.query(ConnectionRow).first().to_dict()["geozarr_attrs"] is None
    finally:
        session.close()


def test_geozarr_attrs_unused_keys_ignored_by_orm():
    session = _make_session()
    try:
        attrs = {"spatial:transform": [1, 2, 3, 4, 5, 6], "proj:code": "EPSG:4326"}
        row = ConnectionRow(
            id=str(uuid.uuid4()),
            name="t",
            url="https://example.com/x.zarr",
            connection_type="zarr",
            geozarr_attrs=json.loads(json.dumps(attrs)),
            created_at=datetime.now(UTC),
        )
        session.add(row)
        session.commit()
        assert session.query(ConnectionRow).first().geozarr_attrs == attrs
    finally:
        session.close()
