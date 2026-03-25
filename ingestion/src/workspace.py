"""Workspace ID validation and extraction."""

import re

from fastapi import Header, HTTPException

_WORKSPACE_RE = re.compile(r"^[a-zA-Z0-9]{8}$")


def validate_workspace_id(workspace_id: str) -> str:
    if not _WORKSPACE_RE.match(workspace_id):
        raise HTTPException(status_code=400, detail="Invalid workspace ID")
    return workspace_id


def get_workspace_id(x_workspace_id: str = Header(default="")) -> str:
    return validate_workspace_id(x_workspace_id)


def get_optional_workspace_id(x_workspace_id: str = Header(default="")) -> str | None:
    if not x_workspace_id:
        return None
    return validate_workspace_id(x_workspace_id)
