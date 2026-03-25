# Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-based data isolation so each user's datasets and stories are private by default, without requiring accounts or authentication.

**Architecture:** All routes move under `/w/:workspaceId`. The frontend generates an 8-character alphanumeric workspace ID on first visit, stores it in localStorage, and includes it as an `X-Workspace-Id` header on all API calls. The backend adds a nullable `workspace_id` column to datasets and stories, filters list endpoints by it, and protects mutating endpoints with workspace matching.

**Tech Stack:** React Router v6, React context, FastAPI, SQLAlchemy, PostgreSQL, Chakra UI v3

**Spec:** `docs/superpowers/specs/2026-03-25-workspaces-design.md`

---

## File Structure

### Backend (new files)
- `ingestion/src/workspace.py` — Workspace ID validation helper + FastAPI dependency for extracting/validating the header
- `ingestion/migrations/005_add_workspace_id.sql` — SQL migration adding `workspace_id` column to both tables
- `ingestion/tests/test_workspace_filtering.py` — Tests for workspace filtering on list, create, delete, and patch endpoints

### Backend (modified files)
- `ingestion/src/models/dataset.py` — Add `workspace_id` column to `DatasetRow`, pass it through in `persist_dataset()`
- `ingestion/src/models/story.py` — Add `workspace_id` column to `StoryRow`
- `ingestion/src/routes/datasets.py` — Filter list by workspace, protect delete with workspace match
- `ingestion/src/routes/stories.py` — Filter list by workspace, store workspace on create, protect patch/delete with workspace match
- `ingestion/src/routes/upload.py` — Pass workspace ID from header into Job, thread it through to `persist_dataset()`
- `ingestion/src/models/__init__.py` — Add `workspace_id` field to `Job` and `Dataset` Pydantic models
- `ingestion/src/services/pipeline.py` — Pass `workspace_id` from job to dataset
- `ingestion/src/services/temporal_pipeline.py` — Same as above

### Frontend (new files)
- `frontend/src/hooks/useWorkspace.tsx` — Hook + context provider for workspace lifecycle (generate, persist, provide via context)
- `frontend/src/lib/api.ts` — Centralized fetch wrapper that auto-attaches `X-Workspace-Id` header
- `frontend/src/__tests__/useWorkspace.test.ts` — Tests for workspace generation, localStorage, and routing logic

### Frontend (modified files)
- `frontend/src/App.tsx` — Add workspace route prefix (`/w/:workspaceId/*`), add redirect logic at `/`
- `frontend/src/main.tsx` — Wrap App in WorkspaceProvider
- `frontend/src/components/Header.tsx` — Add workspace indicator, update nav links to include workspace prefix
- `frontend/src/components/ShareButton.tsx` — Already copies `window.location.href` which will include workspace prefix — no change needed
- `frontend/src/pages/DatasetsPage.tsx` — Use centralized fetch wrapper, update internal links to include workspace prefix
- `frontend/src/pages/UploadPage.tsx` — Update links to include workspace prefix
- `frontend/src/hooks/useConversionJob.ts` — Use centralized fetch wrapper so uploads include workspace header
- `frontend/src/lib/story/api.ts` — Use centralized fetch wrapper so story CRUD includes workspace header
- `frontend/src/pages/MapPage.tsx` — Update links to include workspace prefix
- `frontend/src/pages/StoryEditorPage.tsx` — Update links/publish URL to include workspace prefix
- `frontend/src/components/WelcomeToast.tsx` — New component for first-visit privacy message

---

## Task 1: Backend — Workspace validation helper

**Files:**
- Create: `ingestion/src/workspace.py`

- [ ] **Step 1: Write the test**

Create `ingestion/tests/test_workspace.py`:

```python
import re

import pytest
from fastapi import HTTPException

from src.workspace import validate_workspace_id, get_workspace_id


VALID_PATTERN = re.compile(r"^[a-zA-Z0-9]{8}$")


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_workspace.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.workspace'`

- [ ] **Step 3: Write the implementation**

Create `ingestion/src/workspace.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_workspace.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/workspace.py ingestion/tests/test_workspace.py
git commit -m "feat: add workspace ID validation helper"
```

---

## Task 2: Backend — Add workspace_id column to database models

**Files:**
- Create: `ingestion/migrations/005_add_workspace_id.sql`
- Modify: `ingestion/src/models/dataset.py:12-22` (DatasetRow class)
- Modify: `ingestion/src/models/story.py:13-23` (StoryRow class)
- Modify: `ingestion/src/models/__init__.py:70-87` (Job model), `ingestion/src/models/__init__.py:89-117` (Dataset model)

- [ ] **Step 1: Add migration SQL**

Create `ingestion/migrations/005_add_workspace_id.sql`:

```sql
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS workspace_id TEXT;
```

- [ ] **Step 2: Add workspace_id to DatasetRow**

In `ingestion/src/models/dataset.py`, add to `DatasetRow` class after the `created_at` column:

```python
workspace_id = Column(String, nullable=True)
```

Add `"workspace_id"` to the `_TOP_LEVEL_COLUMNS` frozenset.

Update `to_dict()` to include `workspace_id` in the returned dict. Add after the `"created_at"` line:

```python
"workspace_id": self.workspace_id,
```

Update `persist_dataset()` to accept and store workspace_id:

```python
def persist_dataset(db_session_factory, dataset) -> None:
    session = db_session_factory()
    try:
        row = DatasetRow(
            id=dataset.id,
            filename=dataset.filename,
            dataset_type=dataset.dataset_type.value,
            format_pair=dataset.format_pair.value,
            tile_url=dataset.tile_url,
            bounds_json=json.dumps(dataset.bounds) if dataset.bounds else None,
            metadata_json=json.dumps({
                k: v for k, v in dataset.model_dump().items()
                if k not in _TOP_LEVEL_COLUMNS
            }, default=str),
            created_at=dataset.created_at,
            workspace_id=getattr(dataset, "workspace_id", None),
        )
        session.add(row)
        session.commit()
    finally:
        session.close()
```

- [ ] **Step 3: Add workspace_id to StoryRow**

In `ingestion/src/models/story.py`, add to `StoryRow` class after `updated_at`:

```python
workspace_id = Column(String, nullable=True)
```

- [ ] **Step 4: Add workspace_id to Pydantic models**

In `ingestion/src/models/__init__.py`, add to `Job` model (after `scan_result` field):

```python
workspace_id: str | None = None
```

Add to `Dataset` model (after `created_at` field):

```python
workspace_id: str | None = None
```

- [ ] **Step 5: Run existing tests to verify nothing breaks**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v`
Expected: All existing tests PASS (column is nullable, so existing data is fine)

- [ ] **Step 6: Commit**

```bash
git add ingestion/migrations/005_add_workspace_id.sql ingestion/src/models/dataset.py ingestion/src/models/story.py ingestion/src/models/__init__.py
git commit -m "feat: add workspace_id column to datasets and stories"
```

---

## Task 3: Backend — Thread workspace_id through upload pipeline

**Files:**
- Modify: `ingestion/src/routes/upload.py:82-101` (upload_file), `ingestion/src/routes/upload.py:104-131` (convert_url), `ingestion/src/routes/upload.py:177-228` (upload_temporal), `ingestion/src/routes/upload.py:168-174` (_run_and_cleanup), `ingestion/src/routes/upload.py:231-238` (_run_temporal_and_cleanup)
- Modify: `ingestion/src/services/pipeline.py:390-406` (where Dataset is constructed and persisted)
- Modify: `ingestion/src/services/temporal_pipeline.py` (where Dataset is constructed and persisted)

- [ ] **Step 1: Update upload routes to read workspace header**

In `ingestion/src/routes/upload.py`, add imports:

```python
from fastapi import Depends
from src.workspace import get_workspace_id
```

Update `upload_file` to require workspace_id (returns 400 if missing/invalid per spec):

```python
@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    workspace_id: str = Depends(get_workspace_id),
):
```

After creating the job, set `job.workspace_id = workspace_id`.

Do the same for `convert_url` and `upload_temporal`.

- [ ] **Step 2: Thread workspace_id through pipeline to persist_dataset**

In `ingestion/src/services/pipeline.py`, at line ~404 where the `Dataset(...)` is constructed, add:

```python
workspace_id=job.workspace_id,
```

Do the same in `ingestion/src/services/temporal_pipeline.py` where the `Dataset(...)` is constructed.

- [ ] **Step 3: Run existing tests**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add ingestion/src/routes/upload.py ingestion/src/services/pipeline.py ingestion/src/services/temporal_pipeline.py
git commit -m "feat: thread workspace_id from upload header through pipeline"
```

---

## Task 4: Backend — Filter list endpoints and protect mutations by workspace

**Files:**
- Create: `ingestion/tests/test_workspace_filtering.py`
- Modify: `ingestion/src/routes/datasets.py:37-49` (list_datasets), `ingestion/src/routes/datasets.py:66-77` (delete_dataset_endpoint)
- Modify: `ingestion/src/routes/stories.py:41-60` (create_story), `ingestion/src/routes/stories.py:63-70` (list_stories), `ingestion/src/routes/stories.py:85-105` (update_story), `ingestion/src/routes/stories.py:108-118` (delete_story)

- [ ] **Step 1: Write the tests**

Create `ingestion/tests/test_workspace_filtering.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.app import create_app
from src.models.base import Base
from src.models.dataset import DatasetRow
from src.models.story import StoryRow


@pytest.fixture
def db_session_factory(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture
def client(db_session_factory):
    async def noop_lifespan(app):
        yield

    app = create_app(lifespan=noop_lifespan)
    app.state.db_engine = db_session_factory.kw["bind"]
    app.state.db_session_factory = db_session_factory

    return TestClient(app)


@pytest.fixture
def seed_data(client, db_session_factory):
    session = db_session_factory()

    ds_a = DatasetRow(
        id="ds-a", filename="a.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/a",
        workspace_id="aaaaaaaa",
    )
    ds_b = DatasetRow(
        id="ds-b", filename="b.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/b",
        workspace_id="bbbbbbbb",
    )
    ds_orphan = DatasetRow(
        id="ds-orphan", filename="orphan.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/orphan",
        workspace_id=None,
    )
    session.add_all([ds_a, ds_b, ds_orphan])

    st_a = StoryRow(id="st-a", title="Story A", workspace_id="aaaaaaaa")
    st_b = StoryRow(id="st-b", title="Story B", workspace_id="bbbbbbbb")
    session.add_all([st_a, st_b])

    session.commit()
    session.close()


def test_list_datasets_filtered_by_workspace(client, seed_data):
    resp = client.get("/api/datasets", headers={"X-Workspace-Id": "aaaaaaaa"})
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()]
    assert "ds-a" in ids
    assert "ds-b" not in ids
    assert "ds-orphan" not in ids


def test_list_datasets_no_header_returns_empty(client, seed_data):
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_dataset_by_id_ignores_workspace(client, seed_data):
    resp = client.get("/api/datasets/ds-b", headers={"X-Workspace-Id": "aaaaaaaa"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "ds-b"


def test_delete_dataset_wrong_workspace_returns_403(client, seed_data):
    resp = client.delete("/api/datasets/ds-a", headers={"X-Workspace-Id": "bbbbbbbb"})
    assert resp.status_code == 403


def test_delete_dataset_no_header_returns_400(client, seed_data):
    resp = client.delete("/api/datasets/ds-a")
    assert resp.status_code == 400


def test_list_stories_filtered_by_workspace(client, seed_data):
    resp = client.get("/api/stories", headers={"X-Workspace-Id": "aaaaaaaa"})
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert "st-a" in ids
    assert "st-b" not in ids


def test_create_story_stores_workspace(client, seed_data):
    resp = client.post(
        "/api/stories",
        json={"title": "New"},
        headers={"X-Workspace-Id": "aaaaaaaa"},
    )
    assert resp.status_code == 201
    story_id = resp.json()["id"]

    resp2 = client.get("/api/stories", headers={"X-Workspace-Id": "aaaaaaaa"})
    ids = [s["id"] for s in resp2.json()]
    assert story_id in ids


def test_patch_story_wrong_workspace_returns_403(client, seed_data):
    resp = client.patch(
        "/api/stories/st-a",
        json={"title": "Hacked"},
        headers={"X-Workspace-Id": "bbbbbbbb"},
    )
    assert resp.status_code == 403


def test_delete_story_wrong_workspace_returns_403(client, seed_data):
    resp = client.delete("/api/stories/st-a", headers={"X-Workspace-Id": "bbbbbbbb"})
    assert resp.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_workspace_filtering.py -v`
Expected: FAIL — list endpoints return all datasets regardless of header

- [ ] **Step 3: Update datasets.py list endpoint**

In `ingestion/src/routes/datasets.py`, update `list_datasets`:

```python
from src.workspace import validate_workspace_id

@router.get("/datasets")
async def list_datasets(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        rows = (
            session.query(DatasetRow)
            .filter(DatasetRow.workspace_id == workspace_id)
            .order_by(DatasetRow.created_at.desc())
            .all()
        )
        result = []
        for row in rows:
            d = row.to_dict()
            d["story_count"] = _story_count_for_dataset(session, row.id)
            result.append(d)
        return result
    finally:
        session.close()
```

- [ ] **Step 4: Update datasets.py delete endpoint**

In `ingestion/src/routes/datasets.py`, add import and update `delete_dataset_endpoint`:

```python
from src.workspace import validate_workspace_id
```

```python
@router.delete("/datasets/{dataset_id}")
async def delete_dataset_endpoint(dataset_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        s3 = getattr(request.app.state, "s3", None)
        storage = StorageService(s3_client=s3) if s3 else None
        result = await delete_dataset(session, dataset_id, storage=storage)
        return result
    finally:
        session.close()
```

- [ ] **Step 5: Update stories.py — create, list, patch, delete**

In `ingestion/src/routes/stories.py`, add import:

```python
from src.workspace import validate_workspace_id
```

Update `create_story` to read and store workspace_id:

```python
@router.post("/stories", status_code=201)
async def create_story(body: StoryCreate, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    session = _get_session(request)
    try:
        row = StoryRow(
            id=str(uuid.uuid4()),
            title=body.title,
            description=body.description,
            dataset_id=body.dataset_id,
            chapters_json=json.dumps([ch.model_dump() for ch in body.chapters]),
            published=body.published,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            workspace_id=workspace_id if workspace_id else None,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _row_to_response(row)
    finally:
        session.close()
```

Update `list_stories` to filter by workspace:

```python
@router.get("/stories")
async def list_stories(request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    if not workspace_id:
        return []
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        rows = (
            session.query(StoryRow)
            .filter(StoryRow.workspace_id == workspace_id)
            .order_by(StoryRow.created_at.desc())
            .all()
        )
        return [_row_to_response(r) for r in rows]
    finally:
        session.close()
```

Update `update_story` to check workspace match:

```python
@router.patch("/stories/{story_id}")
async def update_story(story_id: str, body: StoryUpdate, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if body.title is not None:
            row.title = body.title
        if body.description is not None:
            row.description = body.description
        if body.chapters is not None:
            row.chapters_json = json.dumps([ch.model_dump() for ch in body.chapters])
        if body.published is not None:
            row.published = body.published
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(row)
        return _row_to_response(row)
    finally:
        session.close()
```

Update `delete_story` to check workspace match:

```python
@router.delete("/stories/{story_id}", status_code=204)
async def delete_story(story_id: str, request: Request):
    workspace_id = request.headers.get("x-workspace-id", "")
    validate_workspace_id(workspace_id)
    session = _get_session(request)
    try:
        row = session.get(StoryRow, story_id)
        if not row:
            raise HTTPException(status_code=404, detail="Story not found")
        if row.workspace_id != workspace_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        session.delete(row)
        session.commit()
    finally:
        session.close()
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_workspace_filtering.py -v`
Expected: All tests PASS

- [ ] **Step 7: Run full backend test suite**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add ingestion/src/routes/datasets.py ingestion/src/routes/stories.py ingestion/tests/test_workspace_filtering.py
git commit -m "feat: filter list endpoints by workspace, protect mutations"
```

---

## Task 5: Frontend — Workspace hook and context provider

**Files:**
- Create: `frontend/src/hooks/useWorkspace.tsx`
- Create: `frontend/src/__tests__/useWorkspace.test.ts`

- [ ] **Step 1: Write the test**

Create `frontend/src/__tests__/useWorkspace.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const STORAGE_KEY = "myWorkspaceId";

function generateWorkspaceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

describe("generateWorkspaceId", () => {
  it("returns an 8-char alphanumeric string", () => {
    const id = generateWorkspaceId();
    expect(id).toMatch(/^[a-z0-9]{8}$/);
  });
});

describe("workspace localStorage logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves workspace ID", () => {
    const id = generateWorkspaceId();
    localStorage.setItem(STORAGE_KEY, id);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(id);
  });

  it("returns null when no workspace stored", () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run src/__tests__/useWorkspace.test.ts`
Expected: PASS (testing pure functions and localStorage, no component dependencies)

- [ ] **Step 3: Write the workspace hook and provider**

Create `frontend/src/hooks/useWorkspace.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useParams, Navigate, useLocation } from "react-router-dom";
import { setWorkspaceId } from "../lib/api";

const STORAGE_KEY = "myWorkspaceId";

export function generateWorkspaceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function getOrCreateHomeWorkspaceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const newId = generateWorkspaceId();
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
}

interface WorkspaceContextValue {
  workspaceId: string;
  isHomeWorkspace: boolean;
  workspacePath: (path: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const activeId = workspaceId!;

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, activeId);
    }
    setWorkspaceId(activeId);
  }, [activeId]);

  const value = useMemo(() => ({
    workspaceId: activeId,
    isHomeWorkspace: activeId === localStorage.getItem(STORAGE_KEY),
    workspacePath: (path: string) => `/w/${activeId}${path}`,
  }), [activeId]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function WorkspaceRedirect() {
  const location = useLocation();
  const homeId = getOrCreateHomeWorkspaceId();
  const rest = location.pathname === "/" ? "" : location.pathname;
  return <Navigate to={`/w/${homeId}${rest}${location.search}`} replace />;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useWorkspace.tsx frontend/src/__tests__/useWorkspace.test.ts
git commit -m "feat: add workspace hook and context provider"
```

---

## Task 6: Frontend — Centralized fetch wrapper with workspace header

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/__tests__/api.test.ts`

- [ ] **Step 1: Write the test**

Create `frontend/src/lib/__tests__/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { workspaceFetch, setWorkspaceId } from "../api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true });
  setWorkspaceId("test1234");
});

describe("workspaceFetch", () => {
  it("adds X-Workspace-Id header to requests", async () => {
    await workspaceFetch("/api/datasets");
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get("X-Workspace-Id")).toBe("test1234");
  });

  it("preserves existing headers", async () => {
    await workspaceFetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("X-Workspace-Id")).toBe("test1234");
  });

  it("works with FormData (no Content-Type override)", async () => {
    const body = new FormData();
    await workspaceFetch("/api/upload", { method: "POST", body });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get("X-Workspace-Id")).toBe("test1234");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run src/lib/__tests__/api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/api.ts`:

```typescript
let _workspaceId = "";

export function setWorkspaceId(id: string): void {
  _workspaceId = id;
}

export function getWorkspaceId(): string {
  return _workspaceId;
}

export function workspaceFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (_workspaceId) {
    headers.set("X-Workspace-Id", _workspaceId);
  }
  return fetch(input, { ...init, headers });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run src/lib/__tests__/api.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/__tests__/api.test.ts
git commit -m "feat: add centralized fetch wrapper with workspace header"
```

---

## Task 7: Frontend — Update routing and wire up workspace provider

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Update App.tsx with workspace routes**

Replace `frontend/src/App.tsx`:

```tsx
import { Routes, Route } from "react-router-dom";
import { WorkspaceProvider, WorkspaceRedirect } from "./hooks/useWorkspace";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import DatasetsPage from "./pages/DatasetsPage";
import StoryReaderPage from "./pages/StoryReaderPage";
import StoryEditorPage from "./pages/StoryEditorPage";
import StoryEmbedPage from "./pages/StoryEmbedPage";

function WorkspaceRoutes() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/map/:id" element={<MapPage />} />
        <Route path="/expired/:id" element={<ExpiredPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/story/new" element={<StoryEditorPage />} />
        <Route path="/story/:id" element={<StoryReaderPage />} />
        <Route path="/story/:id/edit" element={<StoryEditorPage />} />
      </Routes>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/story/:id/embed" element={<StoryEmbedPage />} />
      <Route path="/w/:workspaceId/*" element={<WorkspaceRoutes />} />
      <Route path="*" element={<WorkspaceRedirect />} />
    </Routes>
  );
}
```

Note: `WorkspaceRedirect` and the `setWorkspaceId` wiring are already included in the `useWorkspace.tsx` file written in Task 5. `WorkspaceRedirect` uses the `<Navigate>` component (not imperative `navigate()`) to avoid render-time side effects. `WorkspaceProvider` calls `setWorkspaceId` in a `useEffect`.

- [ ] **Step 4: Run frontend tests**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run`
Expected: All tests PASS (or identify tests that need route updates)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/hooks/useWorkspace.tsx
git commit -m "feat: add workspace routing and provider wiring"
```

---

## Task 8: Frontend — Update all fetch calls to use workspaceFetch

**Files:**
- Modify: `frontend/src/pages/DatasetsPage.tsx:47-54` (fetch datasets), `frontend/src/pages/DatasetsPage.tsx:67-74` (delete dataset)
- Modify: `frontend/src/hooks/useConversionJob.ts:183-186` (upload), `frontend/src/hooks/useConversionJob.ts:218-221` (convert-url), `frontend/src/hooks/useConversionJob.ts:265` (upload-temporal)
- Modify: `frontend/src/lib/story/api.ts` (all fetch calls)

- [ ] **Step 1: Update DatasetsPage.tsx**

Replace `fetch(` with `workspaceFetch(` for the datasets list and delete calls. Add import:

```typescript
import { workspaceFetch } from "../lib/api";
```

Change line 48: `fetch(\`${config.apiBase}/api/datasets\`)` → `workspaceFetch(\`${config.apiBase}/api/datasets\`)`

Change line 68-71: `fetch(\`${config.apiBase}/api/datasets/${ds.id}\`, { method: "DELETE" })` → `workspaceFetch(\`${config.apiBase}/api/datasets/${ds.id}\`, { method: "DELETE" })`

- [ ] **Step 2: Update useConversionJob.ts**

Replace `fetchWithRetry` with a version that uses `workspaceFetch`. The simplest approach: update the existing `fetchWithRetry` helper in the file to use `workspaceFetch` internally instead of `fetch`. Add import:

```typescript
import { workspaceFetch } from "../lib/api";
```

Find the `fetchWithRetry` function definition and replace its internal `fetch` call with `workspaceFetch`.

- [ ] **Step 3: Update story/api.ts**

Replace all `fetch(` calls with `workspaceFetch(`. Add import:

```typescript
import { workspaceFetch } from "../api";
```

Replace each `fetch(BASE, ...)` and `fetch(\`${BASE}/...\`, ...)` with `workspaceFetch(...)`.

- [ ] **Step 4: Update story API tests**

In `frontend/src/lib/story/__tests__/api.test.ts`, the tests mock `fetch` globally. Since `workspaceFetch` calls `fetch` internally, the mock still intercepts calls. However, `workspaceFetch` converts headers to a `Headers` object, so exact-match assertions on the second argument will fail. Update the test to also call `setWorkspaceId` in `beforeEach` and adjust assertions:

```typescript
import { setWorkspaceId } from "../../api";

beforeEach(() => {
  mockFetch.mockReset();
  setWorkspaceId("test1234");
});
```

For assertions, check method separately from the full init object:

```typescript
expect(mockFetch).toHaveBeenCalledWith(
  "/api/stories",
  expect.objectContaining({ method: "POST" }),
);
```

The `expect.objectContaining` matcher handles the `Headers` object since it only checks the specified keys.

- [ ] **Step 5: Run frontend tests**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DatasetsPage.tsx frontend/src/hooks/useConversionJob.ts frontend/src/lib/story/api.ts frontend/src/lib/story/__tests__/api.test.ts
git commit -m "feat: use workspaceFetch for all API calls"
```

---

## Task 9: Frontend — Update all internal links to use workspace prefix

**Files:**
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/pages/DatasetsPage.tsx` (links to `/map/:id` and `/`)
- Modify: `frontend/src/pages/UploadPage.tsx` (links)
- Modify: `frontend/src/pages/MapPage.tsx` (any links)
- Modify: `frontend/src/pages/StoryEditorPage.tsx` (publish URL, links)

- [ ] **Step 1: Update Header.tsx**

The header has links to `/` and `/datasets`. Update them to use `useWorkspace`:

```tsx
import { useWorkspace } from "../hooks/useWorkspace";

export function Header({ children }: HeaderProps) {
  const { workspacePath } = useWorkspace();
  // ...
  <Link to={workspacePath("/")} ...>
  <Link to={workspacePath("/datasets")} ...>
```

- [ ] **Step 2: Update DatasetsPage.tsx links**

Update the `<Link to="/">` (Upload new button) and `<Link to={`/map/${ds.id}`}>` to use `workspacePath`:

```tsx
import { useWorkspace } from "../hooks/useWorkspace";
// inside component:
const { workspacePath } = useWorkspace();
// ...
<Link to={workspacePath("/")}>
<Link to={workspacePath(`/map/${ds.id}`)}>
```

- [ ] **Step 3: Update UploadPage.tsx links**

Find any `<Link>` or `navigate()` calls and prefix with `workspacePath`. The upload page links to `/story/new` and `/datasets`.

- [ ] **Step 4: Update MapPage.tsx links**

Update any internal navigation links. The MapPage may link back to `/datasets` or `/`.

- [ ] **Step 5: Update StoryEditorPage.tsx**

The publish button copies a story URL. Update it to include the workspace prefix. Also update any `navigate()` calls. The story reader link should use workspace prefix. Note: the embed URL (`/story/:id/embed`) stays without workspace prefix per the spec.

- [ ] **Step 6: Manually verify by searching for hardcoded route paths**

Search for any remaining hardcoded `to="/` or `navigate("/` patterns that aren't workspace-aware:

Run: `cd /home/anthony/projects/cng-sandbox/frontend && grep -rn 'to="/' src/pages/ src/components/ --include="*.tsx" | grep -v embed | grep -v node_modules`

Fix any remaining hardcoded paths.

- [ ] **Step 7: Run frontend tests**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Header.tsx frontend/src/pages/DatasetsPage.tsx frontend/src/pages/UploadPage.tsx frontend/src/pages/MapPage.tsx frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: update all internal links to use workspace prefix"
```

---

## Task 10: Frontend — Workspace indicator and welcome toast

**Files:**
- Modify: `frontend/src/components/Header.tsx` (add workspace indicator)
- Create: `frontend/src/components/WelcomeToast.tsx`

- [ ] **Step 1: Add workspace indicator to Header**

Add a small clickable workspace ID display to the header, between the nav links and children:

```tsx
import { useWorkspace } from "../hooks/useWorkspace";
import { useState, useCallback } from "react";

// Inside Header component:
const { workspaceId } = useWorkspace();
const [copied, setCopied] = useState(false);

const copyWorkspaceUrl = useCallback(() => {
  const url = `${window.location.origin}/w/${workspaceId}`;
  navigator.clipboard.writeText(url);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}, [workspaceId]);

// In the JSX, after the nav links Flex and before children:
<Flex
  align="center"
  gap={1}
  px={2}
  py={1}
  borderRadius="md"
  bg="gray.100"
  cursor="pointer"
  onClick={copyWorkspaceUrl}
  title="Click to copy workspace link"
  fontSize="xs"
  color="gray.500"
>
  <Text>{copied ? "Copied!" : `Workspace ${workspaceId}`}</Text>
</Flex>
```

- [ ] **Step 2: Create WelcomeToast component**

Create `frontend/src/components/WelcomeToast.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Box, Flex, Text, CloseButton } from "@chakra-ui/react";

const STORAGE_KEY = "welcomeToastDismissed";

export function WelcomeToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  return (
    <Box
      position="fixed"
      bottom={4}
      left="50%"
      transform="translateX(-50%)"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      shadow="lg"
      p={4}
      maxW="480px"
      zIndex={1000}
    >
      <Flex justify="space-between" align="start" gap={3}>
        <Box>
          <Text fontWeight={600} fontSize="sm" mb={1}>
            Welcome to CNG Sandbox
          </Text>
          <Text fontSize="sm" color="gray.600">
            We've created a private workspace for you. Your data is only visible
            to people you share the link with. Bookmark this page to come back
            later.
          </Text>
        </Box>
        <CloseButton size="sm" onClick={dismiss} />
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 3: Add WelcomeToast to the workspace layout**

In `frontend/src/App.tsx`, add `<WelcomeToast />` inside `WorkspaceRoutes`:

```tsx
import { WelcomeToast } from "./components/WelcomeToast";

function WorkspaceRoutes() {
  return (
    <WorkspaceProvider>
      <WelcomeToast />
      <Routes>
        {/* ... */}
      </Routes>
    </WorkspaceProvider>
  );
}
```

- [ ] **Step 4: Run frontend tests**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Header.tsx frontend/src/components/WelcomeToast.tsx frontend/src/App.tsx
git commit -m "feat: add workspace indicator and welcome toast"
```

---

## Task 11: Integration testing — full stack verification

- [ ] **Step 1: Run the migration**

**Important:** SQLAlchemy's `Base.metadata.create_all()` only creates new tables — it does NOT add columns to existing tables. The migration SQL must be run manually against the existing database:

```bash
docker compose exec database psql -U postgres -d postgis -f /dev/stdin < ingestion/migrations/005_add_workspace_id.sql
```

For fresh databases (e.g., after `docker compose down -v`), the column will be created automatically by `create_all()`.

- [ ] **Step 2: Rebuild and start the stack**

```bash
docker compose -f docker-compose.yml build ingestion frontend
docker compose -f docker-compose.yml up -d
```

- [ ] **Step 3: Verify workspace redirect**

Open `http://localhost:5185` in a browser. Verify:
- Redirected to `/w/<8-char-id>`
- Welcome toast appears
- Workspace ID visible in header

- [ ] **Step 4: Verify dataset isolation**

Upload a file. Verify it appears in the datasets list. Open an incognito window — verify the datasets list is empty (different workspace).

- [ ] **Step 5: Verify story isolation**

Create a story. Verify it appears in the workspace. Verify it doesn't appear in another workspace.

- [ ] **Step 6: Verify sharing**

Copy the workspace URL from the header. Open it in incognito. Verify you see the same datasets and stories.

- [ ] **Step 7: Verify embed still works**

Publish a story and open its embed URL (`/story/:id/embed`). Verify it loads without workspace prefix.

- [ ] **Step 8: Run all tests**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v
cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run
```

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes for workspaces"
```

---

## Task 12: Frontend — Share workspace button on datasets page

**Files:**
- Modify: `frontend/src/pages/DatasetsPage.tsx`

The spec calls for a dedicated "Share workspace" button on the datasets page with the tooltip "Anyone with this link can view and add to this workspace." This is separate from the header workspace indicator.

- [ ] **Step 1: Add share button to DatasetsPage**

In the `DatasetsPage` header area (next to "Upload new" button), add a share workspace button:

```tsx
import { useWorkspace } from "../hooks/useWorkspace";
import { useState, useCallback } from "react";

// Inside component:
const { workspaceId } = useWorkspace();
const [shared, setShared] = useState(false);

const shareWorkspace = useCallback(() => {
  navigator.clipboard.writeText(`${window.location.origin}/w/${workspaceId}`);
  setShared(true);
  setTimeout(() => setShared(false), 2000);
}, [workspaceId]);

// In JSX, next to the "Upload new" button:
<Button
  size="sm"
  variant="outline"
  onClick={shareWorkspace}
  title="Anyone with this link can view and add to this workspace"
>
  {shared ? "Link copied!" : "Share workspace"}
</Button>
```

- [ ] **Step 2: Run frontend tests**

Run: `cd /home/anthony/projects/cng-sandbox/frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DatasetsPage.tsx
git commit -m "feat: add share workspace button to datasets page"
```

---

## Task 13: Backend — Data cleanup task

**Files:**
- Create: `ingestion/src/services/cleanup.py`
- Create: `ingestion/tests/test_cleanup.py`
- Modify: `ingestion/src/app.py` (register the cleanup task in lifespan)

The spec requires server-side data cleanup to replace the client-side-only TTL check. Raster datasets should be cleaned up when their R2 objects no longer exist. Vector datasets and stories (DB-only) should be cleaned up after 30 days.

- [ ] **Step 1: Write the test**

Create `ingestion/tests/test_cleanup.py`:

```python
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models.base import Base
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.cleanup import cleanup_expired_rows


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def test_deletes_old_rows_without_workspace(db_session):
    old = datetime.now(timezone.utc) - timedelta(days=31)
    db_session.add(DatasetRow(
        id="old-orphan", filename="old.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/old",
        workspace_id=None, created_at=old,
    ))
    db_session.add(DatasetRow(
        id="new-orphan", filename="new.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/new",
        workspace_id=None, created_at=datetime.now(timezone.utc),
    ))
    db_session.commit()

    deleted = cleanup_expired_rows(db_session, ttl_days=30, check_storage=False)
    assert "old-orphan" in deleted
    assert "new-orphan" not in deleted


def test_preserves_workspace_rows_within_ttl(db_session):
    recent = datetime.now(timezone.utc) - timedelta(days=10)
    db_session.add(DatasetRow(
        id="recent-ws", filename="r.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/r",
        workspace_id="abcd1234", created_at=recent,
    ))
    db_session.commit()

    deleted = cleanup_expired_rows(db_session, ttl_days=30, check_storage=False)
    assert "recent-ws" not in deleted


def test_deletes_expired_stories(db_session):
    old = datetime.now(timezone.utc) - timedelta(days=31)
    db_session.add(StoryRow(
        id="old-story", title="Old", workspace_id=None, created_at=old,
    ))
    db_session.commit()

    deleted = cleanup_expired_rows(db_session, ttl_days=30, check_storage=False)
    assert "old-story" in deleted
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_cleanup.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `ingestion/src/services/cleanup.py`:

```python
"""Periodic cleanup of expired datasets and stories."""

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow
from src.models.story import StoryRow

logger = logging.getLogger(__name__)


def cleanup_expired_rows(
    session: Session,
    ttl_days: int = 30,
    check_storage: bool = True,
    storage_service=None,
) -> list[str]:
    """Delete datasets and stories older than ttl_days. Returns list of deleted IDs."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    deleted = []

    expired_datasets = (
        session.query(DatasetRow)
        .filter(DatasetRow.created_at < cutoff)
        .all()
    )
    for row in expired_datasets:
        logger.info("Cleaning up expired dataset %s (%s)", row.id, row.filename)
        session.delete(row)
        deleted.append(row.id)

    expired_stories = (
        session.query(StoryRow)
        .filter(StoryRow.created_at < cutoff)
        .all()
    )
    for row in expired_stories:
        logger.info("Cleaning up expired story %s (%s)", row.id, row.title)
        session.delete(row)
        deleted.append(row.id)

    if deleted:
        session.commit()
        logger.info("Cleaned up %d expired rows", len(deleted))

    return deleted
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_cleanup.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Register cleanup in app lifespan**

In `ingestion/src/app.py`, add the cleanup task to run periodically (e.g., every 6 hours). In `_default_lifespan`, after the existing `_cleanup_scans` task:

```python
from src.services.cleanup import cleanup_expired_rows

async def _cleanup_expired():
    """Remove expired datasets and stories every 6 hours."""
    while True:
        await asyncio.sleep(6 * 3600)
        try:
            session = app.state.db_session_factory()
            try:
                cleanup_expired_rows(session)
            finally:
                session.close()
        except Exception:
            logger.exception("Cleanup task failed")

cleanup_expired_task = asyncio.create_task(_cleanup_expired())
```

Add `cleanup_expired_task.cancel()` in the yield cleanup.

- [ ] **Step 6: Run all backend tests**

Run: `cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add ingestion/src/services/cleanup.py ingestion/tests/test_cleanup.py ingestion/src/app.py
git commit -m "feat: add periodic cleanup of expired datasets and stories"
```
