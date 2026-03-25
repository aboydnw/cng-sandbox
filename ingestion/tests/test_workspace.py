import pytest
from fastapi import HTTPException

from src.workspace import validate_workspace_id


def test_valid_workspace_id():
    validate_workspace_id("abcd1234")


def test_rejects_too_short():
    with pytest.raises(HTTPException):
        validate_workspace_id("abc")


def test_rejects_too_long():
    with pytest.raises(HTTPException):
        validate_workspace_id("abcdefghi")


def test_rejects_special_characters():
    with pytest.raises(HTTPException):
        validate_workspace_id("abcd-123")


def test_rejects_empty():
    with pytest.raises(HTTPException):
        validate_workspace_id("")
