from sqlalchemy import inspect


def test_datasets_table_created(db_engine):
    inspector = inspect(db_engine)
    assert "datasets" in inspector.get_table_names()
