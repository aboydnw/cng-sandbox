"""Bug report endpoint — creates GitHub issues from user reports."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, model_validator

router = APIRouter(prefix="/api")


class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str


class BugReportRequest(BaseModel):
    description: str = ""
    page_url: str
    dataset_id: str | None = None
    story_id: str | None = None
    dataset_ids: list[str] | None = None
    console_logs: list[LogEntry] = []

    @model_validator(mode="after")
    def require_context(self):
        if not self.dataset_id and not self.story_id:
            raise ValueError("At least one of dataset_id or story_id is required")
        return self


def _build_issue_title(req: BugReportRequest) -> str:
    if req.description.strip():
        title = req.description.strip()
        return title[:80] + "..." if len(title) > 80 else title
    page_type = "Story" if req.story_id else "Dataset"
    primary_id = req.story_id or req.dataset_id
    return f"[Bug Report] {page_type} — {primary_id}"


def _build_issue_body(req: BugReportRequest) -> str:
    lines = ["## Description", "", req.description or "No description provided", "", "## Context", ""]
    lines.append(f"- **Page:** {req.page_url}")
    if req.dataset_id:
        lines.append(f"- **Dataset ID:** {req.dataset_id}")
    if req.story_id:
        lines.append(f"- **Story ID:** {req.story_id}")
    if req.dataset_ids:
        lines.append(f"- **Dataset IDs:** {', '.join(req.dataset_ids)}")
    lines.append(f"- **Reported at:** {datetime.now(timezone.utc).isoformat()}")

    if req.console_logs:
        log_text = "\n".join(f"[{e.timestamp}] {e.level.upper()}: {e.message}" for e in req.console_logs)
        lines.extend([
            "",
            "<details>",
            f"<summary>Console logs ({len(req.console_logs)} entries)</summary>",
            "",
            "```",
            log_text,
            "```",
            "",
            "</details>",
        ])

    return "\n".join(lines)


@router.post("/bug-report")
def submit_bug_report(req: BugReportRequest, request: Request):
    settings = request.app.state.settings
    if not settings.github_token or not settings.github_repo:
        raise HTTPException(status_code=503, detail="Bug reporting is not configured")

    title = _build_issue_title(req)
    body = _build_issue_body(req)

    try:
        resp = httpx.post(
            f"https://api.github.com/repos/{settings.github_repo}/issues",
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
            },
            json={"title": title, "body": body, "labels": ["bug", "user-reported"]},
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 422:
            try:
                resp = httpx.post(
                    f"https://api.github.com/repos/{settings.github_repo}/issues",
                    headers={
                        "Authorization": f"Bearer {settings.github_token}",
                        "Accept": "application/vnd.github+json",
                    },
                    json={"title": title, "body": body},
                    timeout=10,
                )
                resp.raise_for_status()
            except Exception:
                raise HTTPException(status_code=502, detail="Unable to create issue")
        else:
            raise HTTPException(status_code=502, detail="Unable to create issue")
    except Exception:
        raise HTTPException(status_code=502, detail="Unable to create issue")

    return {"issue_url": resp.json()["html_url"]}
