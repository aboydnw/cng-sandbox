# Bug Report Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users on map/story pages report rendering issues with one click, creating a GitHub issue with dataset/story IDs and console logs — no PII.

**Architecture:** Frontend captures console errors in a ring buffer and presents a modal with optional description + context preview. Submits to a new `/api/bug-report` backend endpoint that creates a GitHub issue via the REST API. GitHub token stays server-side.

**Tech Stack:** React 19, Chakra UI v3, Vitest, FastAPI, Pydantic, httpx (GitHub API calls), pytest

**Spec:** `docs/superpowers/specs/2026-03-22-bug-report-button-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/lib/consoleCapture.ts` | Ring buffer capturing console.error/warn |
| Create | `frontend/src/lib/__tests__/consoleCapture.test.ts` | Tests for ring buffer |
| Create | `frontend/src/lib/bugReport.ts` | API call to submit bug report |
| Create | `frontend/src/lib/__tests__/bugReport.test.ts` | Tests for API call |
| Create | `frontend/src/components/BugReportModal.tsx` | Modal UI component |
| Create | `frontend/src/components/BugReportLink.tsx` | Header link that opens the modal |
| Modify | `frontend/src/main.tsx` | Initialize console capture |
| Modify | `frontend/src/pages/MapPage.tsx:325` | Add BugReportLink to Header children |
| Modify | `frontend/src/pages/StoryEditorPage.tsx:362` | Add BugReportLink to Header children |
| Modify | `frontend/src/pages/StoryReaderPage.tsx:347-365` | Add BugReportLink to custom header |
| Create | `ingestion/src/routes/bug_report.py` | POST /api/bug-report endpoint |
| Create | `ingestion/tests/test_bug_report.py` | Backend endpoint tests |
| Modify | `ingestion/src/config.py:8-34` | Add github_token, github_repo fields |
| Modify | `ingestion/src/app.py:87-94` | Register bug_report router |

---

### Task 1: Console Log Capture Module

**Files:**
- Create: `frontend/src/lib/consoleCapture.ts`
- Create: `frontend/src/lib/__tests__/consoleCapture.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/__tests__/consoleCapture.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initConsoleCapture, getRecentLogs, clearLogs } from "../consoleCapture";

let cleanup: (() => void) | undefined;

beforeEach(() => {
  cleanup = initConsoleCapture();
});

afterEach(() => {
  cleanup?.();
  clearLogs();
});

describe("consoleCapture", () => {
  it("captures console.error calls", () => {
    console.error("test error");
    const logs = getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].message).toContain("test error");
  });

  it("captures console.warn calls", () => {
    console.warn("test warning");
    const logs = getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("warn");
  });

  it("does not capture console.log", () => {
    console.log("should be ignored");
    const logs = getRecentLogs();
    expect(logs).toHaveLength(0);
  });

  it("limits buffer to 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      console.error(`error ${i}`);
    }
    const logs = getRecentLogs();
    expect(logs).toHaveLength(50);
    expect(logs[0].message).toContain("error 10");
  });

  it("includes timestamps", () => {
    console.error("timed");
    const logs = getRecentLogs();
    expect(logs[0].timestamp).toBeDefined();
    expect(typeof logs[0].timestamp).toBe("string");
  });

  it("clearLogs empties the buffer", () => {
    console.error("something");
    clearLogs();
    expect(getRecentLogs()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/__tests__/consoleCapture.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement consoleCapture**

Create `frontend/src/lib/consoleCapture.ts`:

```typescript
export interface LogEntry {
  timestamp: string;
  level: "error" | "warn";
  message: string;
}

const MAX_ENTRIES = 50;
const buffer: LogEntry[] = [];

export function getRecentLogs(): LogEntry[] {
  return [...buffer];
}

export function clearLogs(): void {
  buffer.length = 0;
}

export function initConsoleCapture(): () => void {
  const originalError = console.error;
  const originalWarn = console.warn;

  const capture = (level: "error" | "warn", args: unknown[]) => {
    const message = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    buffer.push({ timestamp: new Date().toISOString(), level, message });
    if (buffer.length > MAX_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_ENTRIES);
    }
  };

  console.error = (...args: unknown[]) => {
    capture("error", args);
    originalError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    capture("warn", args);
    originalWarn.apply(console, args);
  };

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/__tests__/consoleCapture.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/consoleCapture.ts frontend/src/lib/__tests__/consoleCapture.test.ts
git commit -m "feat: add console log capture ring buffer for bug reports"
```

---

### Task 2: Bug Report API Client

**Files:**
- Create: `frontend/src/lib/bugReport.ts`
- Create: `frontend/src/lib/__tests__/bugReport.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/__tests__/bugReport.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitBugReport } from "../bugReport";
import type { LogEntry } from "../consoleCapture";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("submitBugReport", () => {
  const basePayload = {
    description: "Map won't load",
    page_url: "/map/ds-123",
    dataset_id: "ds-123",
    console_logs: [] as LogEntry[],
  };

  it("posts to /api/bug-report and returns the issue URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ issue_url: "https://github.com/org/repo/issues/1" }),
    });

    const result = await submitBugReport(basePayload);
    expect(mockFetch).toHaveBeenCalledWith("/api/bug-report", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }));
    expect(result.issue_url).toBe("https://github.com/org/repo/issues/1");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ detail: "GitHub API error" }),
    });

    await expect(submitBugReport(basePayload)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/__tests__/bugReport.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement bugReport API client**

Create `frontend/src/lib/bugReport.ts`:

```typescript
import type { LogEntry } from "./consoleCapture";

export interface BugReportPayload {
  description: string;
  page_url: string;
  dataset_id?: string;
  story_id?: string;
  dataset_ids?: string[];
  console_logs: LogEntry[];
}

interface BugReportResponse {
  issue_url: string;
}

export async function submitBugReport(payload: BugReportPayload): Promise<BugReportResponse> {
  const resp = await fetch("/api/bug-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error("Unable to submit report. Please try again later.");
  }
  return resp.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/__tests__/bugReport.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/bugReport.ts frontend/src/lib/__tests__/bugReport.test.ts
git commit -m "feat: add bug report API client"
```

---

### Task 3: Bug Report Modal + Link Components

**Files:**
- Create: `frontend/src/components/BugReportModal.tsx`
- Create: `frontend/src/components/BugReportLink.tsx`

- [ ] **Step 1: Create BugReportModal component**

Create `frontend/src/components/BugReportModal.tsx`:

```tsx
import { useState } from "react";
import { Box, Button, Flex, Heading, Text, Textarea } from "@chakra-ui/react";
import { getRecentLogs } from "../lib/consoleCapture";
import { submitBugReport } from "../lib/bugReport";
import type { BugReportPayload } from "../lib/bugReport";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  datasetId?: string;
  storyId?: string;
  datasetIds?: string[];
}

export function BugReportModal({ open, onClose, datasetId, storyId, datasetIds }: BugReportModalProps) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  if (!open) return null;

  const logs = getRecentLogs();

  const handleSubmit = async () => {
    setStatus("submitting");
    const payload: BugReportPayload = {
      description,
      page_url: window.location.pathname,
      dataset_id: datasetId,
      story_id: storyId,
      dataset_ids: datasetIds,
      console_logs: logs,
    };
    try {
      const result = await submitBugReport(payload);
      setIssueUrl(result.issue_url);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const handleClose = () => {
    setDescription("");
    setStatus("idle");
    setIssueUrl(null);
    onClose();
  };

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {/* Backdrop */}
      <Box position="absolute" inset={0} bg="blackAlpha.500" onClick={handleClose} />

      {/* Modal */}
      <Box
        position="relative"
        bg="white"
        borderRadius="md"
        shadow="lg"
        maxW="480px"
        w="90%"
        p={6}
      >
        {status === "success" ? (
          <Box textAlign="center">
            <Heading size="sm" mb={3}>Report submitted</Heading>
            <Text fontSize="sm" color="gray.600" mb={4}>
              Thank you for helping us improve.
              {issueUrl && (
                <>
                  {" "}
                  <a href={issueUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#CF3F02", textDecoration: "underline" }}>
                    View issue
                  </a>
                </>
              )}
            </Text>
            <Button size="sm" onClick={handleClose}>Close</Button>
          </Box>
        ) : (
          <>
            <Heading size="sm" mb={2}>Report a rendering issue</Heading>
            <Text fontSize="xs" color="gray.500" mb={4}>
              No personal information is shared. Only the details shown below are sent.
            </Text>

            <Textarea
              placeholder="Describe what you're seeing (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="sm"
              mb={4}
              rows={3}
            />

            <Box fontSize="xs" color="gray.600" mb={4} p={3} bg="gray.50" borderRadius="sm">
              <Text fontWeight={600} mb={1}>What will be sent:</Text>
              {datasetId && <Text>Dataset: {datasetId}</Text>}
              {storyId && <Text>Story: {storyId}</Text>}
              {datasetIds && datasetIds.length > 0 && (
                <Text>Datasets: {datasetIds.join(", ")}</Text>
              )}
              <Text>Page: {window.location.pathname}</Text>
              <Text>Console logs: {logs.length} entries</Text>
              {logs.length > 0 && (
                <Box mt={2}>
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: "11px" }}>
                      Show console logs
                    </summary>
                    <Box
                      mt={1}
                      maxH="120px"
                      overflowY="auto"
                      fontFamily="mono"
                      fontSize="10px"
                      p={2}
                      bg="gray.100"
                      borderRadius="sm"
                    >
                      {logs.map((log, i) => (
                        <Text key={i} color={log.level === "error" ? "red.600" : "orange.600"}>
                          [{log.level}] {log.message}
                        </Text>
                      ))}
                    </Box>
                  </details>
                </Box>
              )}
            </Box>

            {status === "error" && (
              <Text fontSize="sm" color="red.600" mb={3}>
                Unable to submit report. Please try again later.
              </Text>
            )}

            <Flex gap={2} justify="flex-end">
              <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
              <Button
                size="sm"
                bg="brand.orange"
                color="white"
                onClick={handleSubmit}
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Submitting..." : "Submit report"}
              </Button>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Create BugReportLink component**

Create `frontend/src/components/BugReportLink.tsx`:

```tsx
import { useState } from "react";
import { Text } from "@chakra-ui/react";
import { BugReportModal } from "./BugReportModal";

interface BugReportLinkProps {
  datasetId?: string;
  storyId?: string;
  datasetIds?: string[];
}

export function BugReportLink({ datasetId, storyId, datasetIds }: BugReportLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text
        as="button"
        fontSize="xs"
        color="brand.textSecondary"
        cursor="pointer"
        _hover={{ color: "brand.brown" }}
        onClick={() => setOpen(true)}
      >
        This data isn't rendering properly?
      </Text>
      <BugReportModal
        open={open}
        onClose={() => setOpen(false)}
        datasetId={datasetId}
        storyId={storyId}
        datasetIds={datasetIds}
      />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BugReportModal.tsx frontend/src/components/BugReportLink.tsx
git commit -m "feat: add bug report modal and link components"
```

---

### Task 4: Wire Up Frontend — Pages + Console Capture Init

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/pages/MapPage.tsx:325`
- Modify: `frontend/src/pages/StoryEditorPage.tsx:362`
- Modify: `frontend/src/pages/StoryReaderPage.tsx:347-365`

- [ ] **Step 1: Initialize console capture in main.tsx**

In `frontend/src/main.tsx`, add at the top (after imports):

```typescript
import { initConsoleCapture } from "./lib/consoleCapture";
initConsoleCapture();
```

This runs once on app startup as a module side effect.

- [ ] **Step 2: Add BugReportLink to MapPage Header**

In `frontend/src/pages/MapPage.tsx`, import and add to the Header children (around line 325). Add `<BugReportLink datasetId={dataset.id} />` as the first child of `<Header>`:

```tsx
import { BugReportLink } from "../components/BugReportLink";
```

Inside the loaded-state `<Header>` block (line 325):
```tsx
<Header>
  <BugReportLink datasetId={dataset.id} />
  <ShareButton />
  {/* ... existing buttons ... */}
</Header>
```

- [ ] **Step 3: Add BugReportLink to StoryEditorPage Header**

In `frontend/src/pages/StoryEditorPage.tsx`, import and add to the Header children (around line 362):

```tsx
import { BugReportLink } from "../components/BugReportLink";
```

Inside the `<Header>` block, add the link inside the existing button `<Flex>` (around line 377), not before the title input:
```tsx
<Flex gap={2} align="center">
  <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
  <Button size="sm" variant="outline" onClick={() => window.open(`/story/${story.id}`, "_blank")}>
    Preview
  </Button>
  {/* ... existing Publish button ... */}
</Flex>
```

- [ ] **Step 4: Add BugReportLink to StoryReaderPage custom header**

In `frontend/src/pages/StoryReaderPage.tsx`, import and add to the custom header Flex (around line 350-365). StoryReaderPage does **not** use the `<Header>` component — it has a custom `<Flex>` bar. Add the link between the title and the "Made with" text:

```tsx
import { BugReportLink } from "../components/BugReportLink";
```

Inside the header Flex, after the Heading and before the "Made with" Text:
```tsx
<Flex h="48px" px={5} align="center" borderBottom="1px solid" borderColor="gray.200" bg="white" flexShrink={0}>
  <Heading size="sm" fontWeight={600} color="gray.800">
    {story.title}
  </Heading>
  <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
  <Text ml="auto" fontSize="xs" color="gray.500">
    Made with CNG Sandbox
  </Text>
</Flex>
```

Note: Add `ml={4}` to the BugReportLink's Text element or wrap it with appropriate spacing so it doesn't crowd the title. The `ml="auto"` on "Made with" will push it right.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/main.tsx frontend/src/pages/MapPage.tsx frontend/src/pages/StoryEditorPage.tsx frontend/src/pages/StoryReaderPage.tsx
git commit -m "feat: wire bug report link into map and story pages"
```

---

### Task 5: Backend — Config + Endpoint

**Files:**
- Modify: `ingestion/src/config.py:8-34`
- Create: `ingestion/src/routes/bug_report.py`
- Modify: `ingestion/src/app.py:87-94`
- Create: `ingestion/tests/test_bug_report.py`

- [ ] **Step 1: Write the failing backend tests**

Create `ingestion/tests/test_bug_report.py`:

```python
from contextlib import asynccontextmanager
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings
from src.models.base import Base


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture
def github_client():
    """Test client with GitHub settings configured (non-empty token/repo).
    The endpoint reads settings from request.app.state.settings, which
    create_app stores. No lru_cache concerns."""
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
        github_token="fake-token",
        github_repo="org/repo",
    )
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    app = create_app(settings, lifespan=_noop_lifespan)
    app.state.db_session_factory = sessionmaker(bind=engine)
    yield TestClient(app, raise_server_exceptions=False)
    engine.dispose()


def test_submit_bug_report_creates_github_issue(github_client):
    payload = {
        "description": "Map colors look wrong",
        "page_url": "/map/ds-123",
        "dataset_id": "ds-123",
        "console_logs": [
            {"timestamp": "2026-03-22T10:00:00Z", "level": "error", "message": "tile load failed"},
        ],
    }
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"html_url": "https://github.com/org/repo/issues/1"}
    mock_response.raise_for_status = MagicMock()

    with patch("src.routes.bug_report.httpx.post", return_value=mock_response):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 200
    assert resp.json()["issue_url"] == "https://github.com/org/repo/issues/1"


def test_submit_bug_report_requires_context(github_client):
    payload = {
        "description": "Something broke",
        "page_url": "/map/ds-123",
        "console_logs": [],
    }
    resp = github_client.post("/api/bug-report", json=payload)
    assert resp.status_code == 422


def test_submit_bug_report_with_story_context(github_client):
    payload = {
        "description": "",
        "page_url": "/story/s-456",
        "story_id": "s-456",
        "dataset_ids": ["ds-1", "ds-2"],
        "console_logs": [],
    }
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"html_url": "https://github.com/org/repo/issues/2"}
    mock_response.raise_for_status = MagicMock()

    with patch("src.routes.bug_report.httpx.post", return_value=mock_response):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 200


def test_submit_bug_report_github_unavailable(github_client):
    payload = {
        "description": "Broken",
        "page_url": "/map/ds-123",
        "dataset_id": "ds-123",
        "console_logs": [],
    }
    with patch("src.routes.bug_report.httpx.post", side_effect=Exception("connection failed")):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 502


def test_submit_bug_report_not_configured(client):
    """Uses the default client fixture (empty github_token/github_repo)."""
    payload = {
        "description": "",
        "page_url": "/map/ds-123",
        "dataset_id": "ds-123",
        "console_logs": [],
    }
    resp = client.post("/api/bug-report", json=payload)
    assert resp.status_code == 503
```

**Important:** The `github_client` fixture creates its own app with `github_token="fake-token"` and `github_repo="org/repo"` stored on `app.state.settings`. The endpoint reads from `request.app.state.settings`, so no `@lru_cache` issues. The `test_submit_bug_report_not_configured` test uses the default `client` fixture from `conftest.py`, which has empty defaults — so it naturally hits the 503 path.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_bug_report.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Add config fields**

In `ingestion/src/config.py`, add two fields to the `Settings` class after the CORS block:

```python
    # GitHub bug reporting
    github_token: str = ""
    github_repo: str = ""
```

- [ ] **Step 4: Implement the bug report endpoint**

Create `ingestion/src/routes/bug_report.py`:

```python
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
            f"<details>",
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
            # Labels may not exist — retry without labels
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
```

- [ ] **Step 5: Store settings on app.state and register the router in app.py**

In `ingestion/src/app.py`, add `app.state.settings = settings` after the existing `app.state.db_session_factory` line (around line 74). This allows the bug report endpoint to read settings from `request.app.state.settings` rather than calling `get_settings()` (which has `@lru_cache` issues in tests).

```python
    app.state.settings = settings
```

Then add alongside the existing router imports (around line 90):

```python
    from src.routes.bug_report import router as bug_report_router
    app.include_router(bug_report_router)
```

- [ ] **Step 6: Run backend tests to verify they pass**

Run: `cd ingestion && uv run pytest tests/test_bug_report.py -v`
Expected: All 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add ingestion/src/config.py ingestion/src/routes/bug_report.py ingestion/src/app.py ingestion/tests/test_bug_report.py
git commit -m "feat: add POST /api/bug-report endpoint for GitHub issue creation"
```

---

### Task 6: End-to-End Smoke Test

- [ ] **Step 1: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests PASS (existing + new)

- [ ] **Step 2: Run all backend tests**

Run: `cd ingestion && uv run pytest -v`
Expected: All tests PASS (existing + new)

- [ ] **Step 3: Manual smoke test**

1. Start the stack: `docker compose up -d --build`
2. Open `http://localhost:5185`
3. Upload a test file, navigate to the map page
4. Verify "This data isn't rendering properly?" link appears in the header
5. Click it — modal should open with dataset ID and console log count
6. Close without submitting (since GITHUB_TOKEN isn't configured, submit would return 503)
7. Check browser console for any errors

- [ ] **Step 4: Final commit (if any fixups needed)**

Stage only the specific files that were fixed — do not use `git add -A`.
