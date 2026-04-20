from src.models.story import StoryRow


def test_story_row_has_is_example_defaulting_false(db_session):
    row = StoryRow(id="t1", title="T", chapters_json="[]")
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    assert row.is_example is False


def test_story_row_is_example_can_be_true(db_session):
    row = StoryRow(id="t2", title="T", chapters_json="[]", is_example=True)
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    assert row.is_example is True
