from src.models import workspace_example_state as wes


def test_get_state_defaults_to_none(db_session):
    assert wes.get_state(db_session, "ws1") == "none"


def test_set_state_upserts(db_session):
    wes.set_state(db_session, "ws1", "seeded")
    assert wes.get_state(db_session, "ws1") == "seeded"
    wes.set_state(db_session, "ws1", "removed")
    assert wes.get_state(db_session, "ws1") == "removed"
