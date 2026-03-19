# Codebase Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve reliability, reduce duplication, harden infrastructure, expand test coverage, and improve presentation across the entire CNG Sandbox codebase.

**Architecture:** 19 items organized into 5 independent task groups (A-E) that can be executed in parallel. Each group touches different files with no cross-group dependencies.

**Tech Stack:** Python 3.13 (FastAPI, logging, ipaddress), React 19 (TanStack Query, error boundaries), Docker Compose, GitHub Actions, ruff, ESLint

---

## Task Group A: Infrastructure Hardening

**Scope:** Docker Compose, Dockerfiles, .env, .gitignore — no application code changes.

### Task A1: Pin Docker image versions and add restart policies

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Pin minio images and add restart policies**

Replace `minio/minio:latest` with a pinned version, `minio/mc:latest` with pinned version, and add `restart: unless-stopped` to all long-running services (not minio-init).

```yaml
# Line 81: minio/minio:latest → minio/minio:RELEASE.2025-02-28T09-55-16Z
# Line 98: minio/mc:latest → minio/mc:RELEASE.2025-02-21T16-00-23Z
# Add to database, stac-api, raster-tiler, vector-tiler, minio, ingestion, frontend:
#   restart: unless-stopped
```

- [ ] **Step 2: Add resource limits to services**

Add `deploy.resources.limits` to each service. Suggested limits:
- database: 1G memory
- stac-api: 512M
- raster-tiler: 2G (GDAL can be memory-hungry)
- vector-tiler: 512M
- minio: 1G
- ingestion: 2G (conversion processing)
- frontend: 256M

- [ ] **Step 3: Verify stack starts**

```bash
docker compose -f docker-compose.yml config  # validate syntax
```

- [ ] **Step 4: Commit**

### Task A2: Add .dockerignore and fix .gitignore

**Files:**
- Create: `frontend/.dockerignore`
- Modify: `.gitignore`

- [ ] **Step 1: Create frontend/.dockerignore**

```
node_modules
dist
*.log
.env*
```

- [ ] **Step 2: Expand .gitignore**

Add these patterns to the existing `.gitignore`:
```
.DS_Store
*.log
*.swp
*.swo
*~
.idea/
.vscode/
.env.local
.env.*.local
```

- [ ] **Step 3: Commit**

### Task A3: Move .env to .env.example

**Files:**
- Rename: `.env` → `.env.example`
- Modify: `.gitignore` (add `.env`)
- Modify: `README.md` (update quick start)

- [ ] **Step 1: Copy .env to .env.example, add .env to .gitignore**

The `.env.example` keeps the same content (development defaults). Add `.env` to `.gitignore`. Keep `.env` itself as an untracked working copy.

Note: Since `.env` is already tracked, we need to `git rm --cached .env` to stop tracking it while keeping the local file.

- [ ] **Step 2: Update README.md quick start**

Add a step before `docker compose up`:
```bash
cp .env.example .env   # create local config (defaults work out of the box)
```

- [ ] **Step 3: Commit**

### Task A4: Add Docker build and linting to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add ruff linting to backend job**

After the existing `pip install` steps, add:
```yaml
- name: Lint with ruff
  run: pip install ruff && ruff check src/ tests/
```

- [ ] **Step 2: Add ESLint to frontend job**

After `npm ci`, add ESLint setup:
```yaml
- name: Lint
  run: npx eslint src/ --max-warnings 0
```

Note: This requires an ESLint config to exist in the frontend. Create a minimal `frontend/eslint.config.js` with typescript-eslint and react plugins.

- [ ] **Step 3: Add Docker build verification job**

Add a new job that builds the Docker images (but doesn't run them):
```yaml
docker-build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: docker compose build
```

- [ ] **Step 4: Commit**

### Task A5: Remove dev-channel DuckDB WASM

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Change duckdb-wasm to stable release**

Change line 22 from:
```json
"@duckdb/duckdb-wasm": "^1.33.1-dev20.0",
```
to the latest stable version. Check npm for the current stable.

- [ ] **Step 2: Run npm install and verify**

```bash
cd frontend && npm install && npx vitest run
```

- [ ] **Step 3: Commit**

---

## Task Group B: Backend Reliability

**Scope:** Python ingestion service — state management, logging, security, code dedup.

### Task B1: Add structured logging throughout ingestion service

**Files:**
- Modify: `ingestion/src/app.py`
- Modify: `ingestion/src/routes/upload.py`
- Modify: `ingestion/src/routes/jobs.py`
- Modify: `ingestion/src/routes/datasets.py`
- Modify: `ingestion/src/services/pipeline.py`
- Modify: `ingestion/src/services/temporal_pipeline.py`
- Modify: `ingestion/src/services/stac_ingest.py`
- Modify: `ingestion/src/services/vector_ingest.py`
- Modify: `ingestion/src/services/storage.py`

- [ ] **Step 1: Replace all print()/traceback.print_exc() with logging**

In every Python file in `ingestion/src/`, add at the top:
```python
import logging
logger = logging.getLogger(__name__)
```

Replace:
- `print(...)` → `logger.info(...)` or `logger.debug(...)`
- `traceback.print_exc()` → `logger.exception("...")`

In `app.py`, configure logging in `create_app()`:
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

- [ ] **Step 2: Run tests**

```bash
cd ingestion && uv run pytest tests/ -v
```

- [ ] **Step 3: Commit**

### Task B2: Fix SSRF vulnerability in URL validation

**Files:**
- Modify: `ingestion/src/routes/upload.py`

- [ ] **Step 1: Add private IP validation to ConvertUrlRequest**

```python
import ipaddress
import socket

@field_validator("url")
@classmethod
def validate_url_scheme(cls, v: str) -> str:
    parsed = urlparse(v)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are supported")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must include a hostname")
    # Block private/reserved IPs
    try:
        addr = ipaddress.ip_address(hostname)
        if addr.is_private or addr.is_loopback or addr.is_reserved:
            raise ValueError("URLs pointing to private networks are not allowed")
    except ValueError as exc:
        if "not allowed" in str(exc):
            raise
        # hostname is a DNS name, not an IP — resolve it
        try:
            resolved = socket.getaddrinfo(hostname, None)
            for _, _, _, _, sockaddr in resolved:
                addr = ipaddress.ip_address(sockaddr[0])
                if addr.is_private or addr.is_loopback or addr.is_reserved:
                    raise ValueError("URLs resolving to private networks are not allowed")
        except socket.gaierror:
            pass  # DNS resolution failure will be caught by httpx
    return v
```

- [ ] **Step 2: Add test for SSRF protection**

In `ingestion/tests/test_upload.py` (or create if needed):
```python
def test_convert_url_blocks_private_ips():
    from src.routes.upload import ConvertUrlRequest
    import pytest
    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://127.0.0.1:9000/bucket/file.tif")
    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://10.0.0.1/file.tif")
    with pytest.raises(ValueError, match="private"):
        ConvertUrlRequest(url="http://192.168.1.1/file.tif")
    # Valid URL should pass
    req = ConvertUrlRequest(url="https://example.com/file.tif")
    assert req.url == "https://example.com/file.tif"
```

- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

### Task B3: Extract duplicated file handling logic

**Files:**
- Modify: `ingestion/src/routes/upload.py`

- [ ] **Step 1: Extract chunked write helper**

Create a helper function in upload.py that both `upload_file` and `convert_url` use:

```python
def _save_to_tempfile(suffix: str):
    """Context manager that yields (tmp_path, write_chunk) and cleans up on error."""
    import contextlib

    @contextlib.asynccontextmanager
    async def _ctx():
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        size = 0
        settings = get_settings()
        try:
            async def write_chunk(chunk: bytes):
                nonlocal size
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {settings.max_upload_bytes // (1024*1024)} MB.",
                    )
                tmp.write(chunk)
            yield tmp.name, write_chunk
            tmp.close()
        except Exception:
            tmp.close()
            if os.path.exists(tmp.name):
                os.unlink(tmp.name)
            raise
    return _ctx()
```

Then simplify both endpoints to use it:
```python
async with _save_to_tempfile(suffix=ext) as (tmp_path, write_chunk):
    while chunk := await file.read(1024 * 1024):
        await write_chunk(chunk)
```

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

### Task B4: Add tests for pipeline error cases

**Files:**
- Create: `ingestion/tests/test_pipeline_errors.py`

- [ ] **Step 1: Write tests for error scenarios**

Test cases:
1. Pipeline with invalid file format (bad magic bytes) → should fail with clear error
2. Pipeline with empty file → should fail gracefully
3. Pipeline when S3 is unreachable → should fail and clean up temp files
4. STAC ingest when STAC API returns 500 → should set job to FAILED

Use monkeypatch to mock external services (S3, STAC API, tilers).

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

## Task Group C: Frontend Reliability

**Scope:** React components — error boundaries, retry logic, formatting utils dedup.

### Task C1: Add error boundary to MapPage

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/pages/MapPage.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

```tsx
import { Component, type ReactNode } from "react";
import { Box, Heading, Text, Button } from "@chakra-ui/react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={8} textAlign="center">
          <Heading size="lg" mb={4}>Something went wrong</Heading>
          <Text mb={4} color="gray.600">
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Button onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap MapPage content with ErrorBoundary**

In `MapPage.tsx`, wrap the map rendering section:
```tsx
import { ErrorBoundary } from "../components/ErrorBoundary";
// ... in the return:
<ErrorBoundary>
  {/* existing map content */}
</ErrorBoundary>
```

- [ ] **Step 3: Commit**

### Task C2: Add retry logic to API calls and SSE

**Files:**
- Modify: `frontend/src/hooks/useConversionJob.ts`

- [ ] **Step 1: Add SSE reconnection logic**

In `connectSSE()`, when the EventSource errors, implement retry with backoff:
```typescript
es.onerror = () => {
  es.close();
  if (retryCount < 3) {
    retryCount++;
    setTimeout(() => connectSSE(), 1000 * retryCount);
  } else {
    setError("Connection lost. Please refresh the page.");
  }
};
```

- [ ] **Step 2: Add fetch retry wrapper**

Create a simple retry wrapper used by `startUpload`, `startUrlConversion`, `startTemporalUpload`:
```typescript
async function fetchWithRetry(
  input: RequestInfo, init?: RequestInit, maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(input, init);
      if (resp.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return resp;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}
```

Replace all `fetch()` calls in the hook with `fetchWithRetry()`.

- [ ] **Step 3: Fix EventSource cleanup race condition**

Add AbortController pattern:
```typescript
const abortRef = useRef<AbortController | null>(null);

// In connectSSE:
abortRef.current?.abort();
abortRef.current = new AbortController();

// In cleanup:
useEffect(() => {
  return () => { abortRef.current?.abort(); esRef.current?.close(); };
}, []);
```

- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**

### Task C3: Extract duplicated formatting utilities

**Files:**
- Create: `frontend/src/utils/format.ts`
- Modify: `frontend/src/components/ReportCard.tsx`
- Modify: `frontend/src/pages/UploadPage.tsx`
- Modify: `frontend/src/components/CreditsPanel.tsx`
- Modify: `frontend/src/components/ExploreTab.tsx`
- Modify: `frontend/src/components/FilterControls.tsx`

- [ ] **Step 1: Create shared format utilities**

```typescript
// frontend/src/utils/format.ts
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function daysUntilExpiry(createdAt: string): number {
  const created = new Date(createdAt);
  const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}
```

- [ ] **Step 2: Replace all local implementations with imports**

In each file, remove the local `formatBytes`/`formatSize`/`formatCount`/`daysUntilExpiry` and import from `../utils/format`.

- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

### Task C4: Test useConversionJob hook

**Files:**
- Create: `frontend/src/hooks/useConversionJob.test.ts`

- [ ] **Step 1: Write tests for core flows**

Test cases using vitest + testing-library:
1. `startUpload` sends FormData, connects SSE, tracks status changes
2. `startUrlConversion` sends JSON body, connects SSE
3. SSE status events update job state correctly
4. SSE scan_result event triggers onScanResult callback
5. Error response from upload sets error state
6. EventSource cleanup on unmount

Mock `fetch` and `EventSource` globally. Use `vi.fn()` for callbacks.

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

## Task Group D: Frontend Architecture (MapShell)

**Scope:** Extract shared map container pattern from 4 map components. This is the riskiest group — changes rendering components.

### Task D1: Create MapShell component

**Files:**
- Create: `frontend/src/components/MapShell.tsx`
- Modify: `frontend/src/components/VectorMap.tsx`
- Modify: `frontend/src/components/DuckDBMap.tsx`

- [ ] **Step 1: Extract shared basemap selector**

The BASEMAPS constant and basemap `<NativeSelect>` appear identically in RasterMap, VectorMap, DirectRasterMap, and DuckDBMap. Extract:

```tsx
// frontend/src/components/MapShell.tsx
import { Box, NativeSelect } from "@chakra-ui/react";
import "maplibre-gl/dist/maplibre-gl.css";

export const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

interface BasemapPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function BasemapPicker({ value, onChange }: BasemapPickerProps) {
  return (
    <NativeSelect.Root
      size="sm"
      width="120px"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <NativeSelect.Field>
        {Object.keys(BASEMAPS).map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </NativeSelect.Field>
    </NativeSelect.Root>
  );
}
```

- [ ] **Step 2: Update VectorMap and DuckDBMap to use shared BASEMAPS and BasemapPicker**

Remove local BASEMAPS constant and basemap selector JSX. Import from MapShell.

Do NOT touch RasterMap or DirectRasterMap yet — they have more complex control panels that make extraction riskier. Start with the simpler components.

- [ ] **Step 3: Run frontend tests and verify visually**
- [ ] **Step 4: Commit**

---

## Task Group E: Documentation & Presentation

**Scope:** README expansion. No code changes.

### Task E1: Expand README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add development setup, troubleshooting, and detailed architecture**

Add sections:

**Development setup** (running frontend/backend locally without Docker):
```markdown
## Development

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for frontend development)
- Python 3.13+ and uv (for backend development)

### Running locally without Docker (frontend + backend)
1. Start infrastructure: `docker compose up -d database minio minio-init stac-api raster-tiler vector-tiler`
2. Backend: `cd ingestion && uv run uvicorn src.app:app --reload --port 8000`
3. Frontend: `cd frontend && npm install && npm run dev`

### Running tests
- Backend: `cd ingestion && uv run pytest -v`
- Frontend: `cd frontend && npx vitest run`
```

**Troubleshooting section:**
```markdown
## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Containers won't start | Run `docker compose down -v` then `docker compose up -d --build` |
| Upload hangs at "Ingesting" | Check raster-tiler logs: `docker compose logs raster-tiler` |
| Vector tiles 404 | tipg needs ~5s to detect new tables (TIPG_CATALOG_TTL=5) |
| Map shows wrong location | Clear browser cache — old tile URLs may be cached |
```

**Environment variables section:**
```markdown
## Configuration

Copy `.env.example` to `.env` to configure. Defaults work for local development.

| Variable | Default | Purpose |
|----------|---------|---------|
| POSTGRES_PASSWORD | sandbox_dev_password | Database password |
| MINIO_ROOT_USER | minioadmin | S3 storage credentials |
| S3_BUCKET | sandbox-data | Bucket for converted files |
```

- [ ] **Step 2: Commit**

---

## Execution Order

These 5 groups are independent and can run in parallel:

| Group | Agent | Risk | Files touched |
|-------|-------|------|---------------|
| A: Infrastructure | Agent 1 | Low | docker-compose.yml, .gitignore, .env, ci.yml, package.json |
| B: Backend | Agent 2 | Medium | ingestion/src/**/*.py |
| C: Frontend Reliability | Agent 3 | Medium | frontend/src/hooks/*, frontend/src/utils/*, frontend/src/pages/*, frontend/src/components/ErrorBoundary.tsx |
| D: Frontend Architecture | Agent 4 | Medium | frontend/src/components/MapShell.tsx, VectorMap.tsx, DuckDBMap.tsx |
| E: Documentation | Agent 5 | Low | README.md |

**Important constraints:**
- Group C and D both touch frontend components but different files. C touches hooks/utils/pages + ErrorBoundary. D touches MapShell + VectorMap + DuckDBMap. No overlap.
- Group A touches package.json (DuckDB version). Group C does not touch package.json. No conflict.
- All groups should run tests before committing to verify no breakage.
