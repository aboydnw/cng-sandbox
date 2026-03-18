# CNG Sandbox Phase 2: Frontend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend for the CNG Sandbox — a single-page upload flow that converts geospatial files to cloud-native formats and renders them on a shareable map.

**Architecture:** React 19 SPA with Vite, Chakra UI, and @maptool/core. Three routes: upload (`/`), map (`/map/:id`), and expired (`/expired/:id`). The upload page transitions through stages (upload → progress → redirect) without navigation. Raster datasets render via deck.gl + useTitiler; vector datasets render via MapLibre native MVT. A credits sidebar shows which open-source tools processed the file.

**Tech Stack:** React 19, TypeScript, Vite, Chakra UI 3, @maptool/core (deck.gl 9, MapLibre 4), react-router-dom, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-cng-sandbox-phase2-frontend-design.md`
**Phase 1 plan (completed):** `docs/superpowers/plans/2026-03-13-cng-sandbox-phase1-ingestion-service.md`

**Prerequisites:**
- Phase 0 merged (CLI toolkit)
- Phase 1 merged (ingestion service + eoAPI Docker Compose)
- Docker Compose running (`cd sandbox && docker compose up -d`)

---

## File Structure

```
sandbox/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx                  # Entry: luma.gl workaround + providers
│   │   ├── App.tsx                   # Router: /, /map/:id, /expired/:id
│   │   ├── theme.ts                  # Chakra UI theme with Dev Seed brand tokens
│   │   ├── config.ts                 # API URLs from env vars
│   │   ├── types.ts                  # Shared TS types (Dataset, Job, StageInfo, etc.)
│   │   ├── styles.css                # Global resets
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx        # Single-page flow: upload → progress → redirect
│   │   │   ├── MapPage.tsx           # Map + credits sidebar
│   │   │   └── ExpiredPage.tsx       # 30-day expiry landing
│   │   ├── components/
│   │   │   ├── Header.tsx            # Dev Seed branded header
│   │   │   ├── FileUploader.tsx      # Drag-drop zone + URL input
│   │   │   ├── ProgressTracker.tsx   # Vertical stepper driven by SSE
│   │   │   ├── CreditsPanel.tsx      # Sidebar: tools, validation, CTAs
│   │   │   ├── ShareButton.tsx       # Copy URL to clipboard
│   │   │   ├── RasterMap.tsx         # deck.gl COG layer via @maptool/core
│   │   │   └── VectorMap.tsx         # MapLibre native MVT source
│   │   └── hooks/
│   │       └── useConversionJob.ts   # SSE subscription + job state machine
│   └── tests/
│       ├── useConversionJob.test.ts
│       ├── ProgressTracker.test.tsx
│       ├── CreditsPanel.test.tsx
│       └── FileUploader.test.tsx
├── ingestion/
│   └── src/
│       ├── models.py                 # MODIFY — add bounds field to Dataset
│       ├── services/
│       │   └── pipeline.py           # MODIFY — populate bounds during ingest
│       └── routes/
│           └── upload.py             # MODIFY — add POST /api/convert-url
```

Backend files modified: `models.py`, `pipeline.py`, `upload.py` (3 files, small changes)
Frontend files created: 18 new files

---

## Chunk 1: Backend Prerequisites

### Task 1: Add `bounds` field to Dataset model

**Files:**
- Modify: `sandbox/ingestion/src/models.py`

**Context:** The frontend needs bounding box coordinates to auto-zoom the map. The `Dataset` model currently has no `bounds` field. Add it as an optional `list[float]` (west, south, east, north).

- [ ] **Step 1: Add bounds field to Dataset model**

In `sandbox/ingestion/src/models.py`, add `bounds` to the `Dataset` class:

```python
class Dataset(BaseModel):
    id: str
    filename: str
    dataset_type: DatasetType
    format_pair: FormatPair
    tile_url: str
    bounds: list[float] | None = None  # [west, south, east, north]
    stac_collection_id: str | None = None
    pg_table: str | None = None
    validation_results: list[ValidationCheck] = []
    credits: list[dict] = []
    created_at: datetime
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd sandbox/ingestion && python -m pytest tests/test_models.py -v
```

Expected: All tests pass (bounds is optional, so existing tests are unaffected).

- [ ] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/models.py
git commit -m "feat(sandbox): add bounds field to Dataset model"
```

---

### Task 2: Populate bounds during pipeline execution

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py`

**Context:** After conversion and validation, extract bounding box from the output file. For raster: use `rasterio.open()` to get bounds. For vector: use `geopandas.read_parquet()` to get `total_bounds`. Both libraries are already installed as dependencies.

- [ ] **Step 1: Add bounds extraction helper**

Add this function to `sandbox/ingestion/src/services/pipeline.py`, above `run_pipeline`:

```python
def _extract_bounds(output_path: str, dataset_type: DatasetType) -> list[float]:
    """Extract [west, south, east, north] bounds from a converted file."""
    if dataset_type == DatasetType.RASTER:
        import rasterio
        with rasterio.open(output_path) as src:
            b = src.bounds
            return [b.left, b.bottom, b.right, b.top]
    else:
        import geopandas as gpd
        gdf = gpd.read_parquet(output_path)
        b = gdf.total_bounds  # [minx, miny, maxx, maxy]
        return [float(b[0]), float(b[1]), float(b[2]), float(b[3])]
```

- [ ] **Step 2: Pass bounds when constructing Dataset**

In `run_pipeline`, after the validation stage succeeds and before constructing the `Dataset`, extract bounds. Modify the Dataset construction (around line 105) to include `bounds`:

```python
        # Extract bounds for auto-zoom
        bounds = await asyncio.to_thread(_extract_bounds, output_path, format_pair.dataset_type)
```

Then add `bounds=bounds` to the `Dataset(...)` constructor call.

- [ ] **Step 3: Run the pipeline tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_pipeline.py -v
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py
git commit -m "feat(sandbox): extract bounds from converted files for auto-zoom"
```

---

### Task 3: Add `POST /api/convert-url` route

**Files:**
- Modify: `sandbox/ingestion/src/routes/upload.py`

**Context:** The spec calls for a URL input where users paste S3/GCS/HTTP links. This route fetches the file from the URL and runs the same pipeline as file upload. Use `httpx` (already a dependency) to download the file.

- [ ] **Step 1: Add the convert-url endpoint**

Add this route to `sandbox/ingestion/src/routes/upload.py`, after the existing `upload_file` route:

```python
import httpx
from pydantic import BaseModel as PydanticBaseModel

class ConvertUrlRequest(PydanticBaseModel):
    url: str

@router.post("/convert-url")
@limiter.limit("5/hour")
async def convert_url(
    request: Request,
    body: ConvertUrlRequest,
    background_tasks: BackgroundTasks,
):
    """Fetch a file from a URL and start the conversion pipeline."""
    settings = get_settings()

    # Infer filename from URL path
    from urllib.parse import urlparse
    parsed = urlparse(body.url)
    filename = os.path.basename(parsed.path) or "download"

    # Download to temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1])
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            async with client.stream("GET", body.url) as resp:
                resp.raise_for_status()
                size = 0
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                    size += len(chunk)
                    if size > settings.max_upload_bytes:
                        os.unlink(tmp.name)
                        raise HTTPException(
                            status_code=413,
                            detail=f"File too large. Maximum size is {settings.max_upload_bytes // (1024*1024)} MB.",
                        )
                    tmp.write(chunk)
        tmp.close()
    except httpx.HTTPStatusError as e:
        os.unlink(tmp.name)
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e.response.status_code}")
    except httpx.RequestError as e:
        os.unlink(tmp.name)
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")
    except HTTPException:
        raise
    except Exception:
        os.unlink(tmp.name)
        raise

    job = Job(filename=filename)
    jobs[job.id] = job

    background_tasks.add_task(_run_and_cleanup, job, tmp.name)
    return {"job_id": job.id, "dataset_id": job.dataset_id}
```

- [ ] **Step 2: Verify the import works**

```bash
cd sandbox/ingestion && python -c "from src.routes.upload import router; print('Import OK')"
```

Expected: `Import OK`

- [ ] **Step 3: Run existing tests to verify nothing is broken**

```bash
cd sandbox/ingestion && python -m pytest tests/ -v
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add sandbox/ingestion/src/routes/upload.py
git commit -m "feat(sandbox): add POST /api/convert-url route for URL-based ingestion"
```

---

## Chunk 2: Frontend Project Scaffold

### Task 4: Create frontend project with Vite + React + TypeScript

**Files:**
- Create: `sandbox/frontend/package.json`
- Create: `sandbox/frontend/vite.config.ts`
- Create: `sandbox/frontend/tsconfig.json`
- Create: `sandbox/frontend/index.html`
- Create: `sandbox/frontend/src/styles.css`
- Create: `sandbox/frontend/src/main.tsx`

**Context:** Follow the exact same patterns as the test apps in `tests/no2-viewer/`. The key differences: port 5185, Vite proxy for `/api`, react-router-dom added as dependency, title set to "CNG Sandbox".

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p sandbox/frontend/src/pages sandbox/frontend/src/components sandbox/frontend/src/hooks sandbox/frontend/tests
```

- [ ] **Step 2: Write package.json**

Create `sandbox/frontend/package.json`:

```json
{
  "name": "cng-sandbox",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@chakra-ui/react": "^3.0.0",
    "@deck.gl/core": "^9.0.0",
    "@deck.gl/geo-layers": "^9.0.0",
    "@deck.gl/layers": "^9.0.0",
    "@deck.gl/react": "^9.0.0",
    "@emotion/react": "^11.0.0",
    "@maptool/core": "file:../../",
    "maplibre-gl": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-map-gl": "^8.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@types/react": "^19.1.13",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react": "^4.2.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^4.5.14",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Write vite.config.ts**

Create `sandbox/frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5185,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "@deck.gl/core",
      "@deck.gl/layers",
      "@deck.gl/geo-layers",
      "@deck.gl/react",
      "@deck.gl/extensions",
      "@deck.gl/mesh-layers",
      "@deck.gl/widgets",
      "@luma.gl/core",
      "@luma.gl/engine",
      "@luma.gl/webgl",
      "@luma.gl/shadertools",
      "@luma.gl/constants",
      "@luma.gl/gltf",
      "@probe.gl/env",
      "@probe.gl/log",
      "@probe.gl/stats",
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 4: Write tsconfig.json**

Create `sandbox/frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Write index.html**

Create `sandbox/frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CNG Sandbox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write styles.css**

Create `sandbox/frontend/src/styles.css`:

```css
html,
body,
#root,
#root > div {
  margin: 0;
  width: 100%;
  height: 100%;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 7: Write types.ts**

Create `sandbox/frontend/src/types.ts`:

```typescript
export type DatasetType = "raster" | "vector";

export type JobStatus =
  | "pending"
  | "scanning"
  | "converting"
  | "validating"
  | "ingesting"
  | "ready"
  | "failed";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Credit {
  tool: string;
  url: string;
  role: string;
}

export interface Dataset {
  id: string;
  filename: string;
  dataset_type: DatasetType;
  format_pair: string;
  tile_url: string;
  bounds: [number, number, number, number] | null;
  stac_collection_id: string | null;
  pg_table: string | null;
  validation_results: ValidationCheck[];
  credits: Credit[];
  created_at: string;
}

export interface StageInfo {
  name: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
}

export interface ConversionJobState {
  jobId: string | null;
  status: JobStatus;
  datasetId: string | null;
  error: string | null;
  stages: StageInfo[];
}
```

- [ ] **Step 8: Write config.ts**

Create `sandbox/frontend/src/config.ts`:

```typescript
export const config = {
  apiBase: import.meta.env.VITE_API_BASE || "",
  rasterTilerUrl:
    import.meta.env.VITE_RASTER_TILER_URL || "http://localhost:8082",
  vectorTilerUrl:
    import.meta.env.VITE_VECTOR_TILER_URL || "http://localhost:8083",
};
```

- [ ] **Step 9: Write theme.ts**

Create `sandbox/frontend/src/theme.ts`:

```typescript
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          orange: { value: "#CF3F02" },
          orangeHover: { value: "#b83800" },
          brown: { value: "#443F3F" },
          bgSubtle: { value: "#f5f3f0" },
          border: { value: "#e8e5e0" },
          textSecondary: { value: "#7a7474" },
          success: { value: "#2a7d3f" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
```

- [ ] **Step 10: Write main.tsx**

Create `sandbox/frontend/src/main.tsx`:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CanvasContext } from "@luma.gl/core";
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter } from "react-router-dom";
import { system } from "./theme";
import App from "./App";
import "./styles.css";

// Workaround for luma.gl v9.2.6 bug: WebGLCanvasContext registers a
// ResizeObserver before WebGLDevice sets `device.limits`. The observer fires
// immediately, calling getMaxDrawingBufferSize() which reads
// `this.device.limits.maxTextureDimension2D` — but limits is still undefined.
const orig = CanvasContext.prototype.getMaxDrawingBufferSize;
CanvasContext.prototype.getMaxDrawingBufferSize = function () {
  if (!this.device?.limits) return [4096, 4096];
  return orig.call(this);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>
  </StrictMode>,
);
```

- [ ] **Step 11: Write a placeholder App.tsx**

Create `sandbox/frontend/src/App.tsx`:

```typescript
import { Routes, Route } from "react-router-dom";

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>{label}</h1>
      <p>Placeholder — will be implemented in later tasks.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder label="Upload" />} />
      <Route path="/map/:id" element={<Placeholder label="Map" />} />
      <Route path="/expired/:id" element={<Placeholder label="Expired" />} />
    </Routes>
  );
}
```

- [ ] **Step 12: Install dependencies and verify dev server starts**

```bash
cd sandbox/frontend && yarn install
yarn dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:5185/
kill %1
```

Expected: HTTP 200.

- [ ] **Step 13: Commit**

```bash
git add sandbox/frontend/
git commit -m "feat(sandbox): scaffold frontend with Vite, React 19, Chakra UI, and routing"
```

---

## Chunk 3: Core Hook + Upload Components

### Task 5: Create useConversionJob hook

**Files:**
- Create: `sandbox/frontend/src/hooks/useConversionJob.ts`
- Create: `sandbox/frontend/tests/useConversionJob.test.ts`

**Context:** This is the central hook that manages the upload lifecycle. It POSTs the file, opens an SSE connection, and tracks job state through stages. The SSE endpoint (`/api/jobs/:id/stream`) emits events with `data: {"status": "converting", "detail": "..."}` format. See `sandbox/ingestion/src/routes/jobs.py` for the SSE event format.

- [ ] **Step 1: Write the test**

Create `sandbox/frontend/tests/useConversionJob.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConversionJob } from "../src/hooks/useConversionJob";

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

// Mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

describe("useConversionJob", () => {
  it("starts with idle state", () => {
    const { result } = renderHook(() => useConversionJob());
    expect(result.current.state.jobId).toBeNull();
    expect(result.current.state.status).toBe("pending");
    expect(result.current.state.stages).toHaveLength(5);
    expect(result.current.state.stages[0].status).toBe("pending");
  });

  it("uploads file and transitions to scanning", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    const file = new File(["data"], "test.tif", { type: "image/tiff" });
    await act(async () => {
      await result.current.startUpload(file);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.state.jobId).toBe("j1");
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/api/jobs/j1/stream");
  });

  it("updates stages from SSE events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ status: "scanning" }),
        }),
      );
    });
    expect(result.current.state.status).toBe("scanning");
    expect(result.current.state.stages[0].status).toBe("active");

    act(() => {
      es.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ status: "converting" }),
        }),
      );
    });
    expect(result.current.state.status).toBe("converting");
    expect(result.current.state.stages[0].status).toBe("done");
    expect(result.current.state.stages[1].status).toBe("active");
  });

  it("sets datasetId on ready", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    act(() => {
      MockEventSource.instances[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ status: "ready" }),
        }),
      );
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.datasetId).toBe("d1");
  });

  it("sets error on failed status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    act(() => {
      MockEventSource.instances[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ status: "failed", error: "Bad CRS" }),
        }),
      );
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.error).toBe("Bad CRS");
  });

  it("starts URL fetch with JSON body to /api/convert-url", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j2", dataset_id: "d2" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUrlFetch("https://example.com/data.tif");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/convert-url",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/data.tif" }),
      }),
    );
    expect(result.current.state.jobId).toBe("j2");
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sandbox/frontend && npx vitest run tests/useConversionJob.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `sandbox/frontend/src/hooks/useConversionJob.ts`:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import type { ConversionJobState, StageInfo, JobStatus } from "../types";
import { config } from "../config";

const STAGE_NAMES = ["Scanning", "Converting", "Validating", "Ingesting", "Ready"];
const STATUS_ORDER: JobStatus[] = ["scanning", "converting", "validating", "ingesting", "ready"];

function buildInitialStages(): StageInfo[] {
  return STAGE_NAMES.map((name) => ({ name, status: "pending" as const }));
}

function updateStages(status: JobStatus, error?: string): StageInfo[] {
  const idx = STATUS_ORDER.indexOf(status);
  return STAGE_NAMES.map((name, i) => {
    if (status === "failed") {
      if (i < idx) return { name, status: "done" as const };
      if (i === idx || (idx === -1 && i === 0))
        return { name, status: "error" as const, detail: error };
      return { name, status: "pending" as const };
    }
    if (i < idx) return { name, status: "done" as const };
    if (i === idx) return { name, status: "active" as const };
    return { name, status: "pending" as const };
  });
}

export function useConversionJob() {
  const [state, setState] = useState<ConversionJobState>({
    jobId: null,
    status: "pending",
    datasetId: null,
    error: null,
    stages: buildInitialStages(),
  });

  const esRef = useRef<EventSource | null>(null);
  const datasetIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const connectSSE = useCallback((jobId: string) => {
    const es = new EventSource(`${config.apiBase}/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const status: JobStatus = data.status;

      setState((prev) => ({
        ...prev,
        status,
        error: data.error || null,
        datasetId: status === "ready" ? datasetIdRef.current : prev.datasetId,
        stages: updateStages(status, data.error),
      }));

      if (status === "ready" || status === "failed") {
        es.close();
      }
    };

    es.onerror = () => {
      // EventSource handles reconnection automatically
    };
  }, []);

  const startUpload = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(`${config.apiBase}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({ detail: "Upload failed" }));
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: detail.detail || "Upload failed",
          stages: updateStages("failed", detail.detail),
        }));
        return;
      }

      const { job_id, dataset_id } = await resp.json();
      datasetIdRef.current = dataset_id;
      setState((prev) => ({
        ...prev,
        jobId: job_id,
        datasetId: null,
        status: "pending",
        error: null,
        stages: buildInitialStages(),
      }));
      connectSSE(job_id);
    },
    [connectSSE],
  );

  const startUrlFetch = useCallback(
    async (url: string) => {
      const resp = await fetch(`${config.apiBase}/api/convert-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({ detail: "Fetch failed" }));
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: detail.detail || "Fetch failed",
          stages: updateStages("failed", detail.detail),
        }));
        return;
      }

      const { job_id, dataset_id } = await resp.json();
      datasetIdRef.current = dataset_id;
      setState((prev) => ({
        ...prev,
        jobId: job_id,
        datasetId: null,
        status: "pending",
        error: null,
        stages: buildInitialStages(),
      }));
      connectSSE(job_id);
    },
    [connectSSE],
  );

  return { state, startUpload, startUrlFetch };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd sandbox/frontend && npx vitest run tests/useConversionJob.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/hooks/useConversionJob.ts sandbox/frontend/tests/useConversionJob.test.ts
git commit -m "feat(sandbox): add useConversionJob hook with SSE state management"
```

---

### Task 6: Create Header component

**Files:**
- Create: `sandbox/frontend/src/components/Header.tsx`

**Context:** Dev Seed branded header used by all pages. White background, orange `ds` logo mark, "CNG Sandbox" title. Accepts `children` for right-side action buttons.

- [ ] **Step 1: Write the component**

Create `sandbox/frontend/src/components/Header.tsx`:

```typescript
import { Box, Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface HeaderProps {
  children?: ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={6}
      py={3}
      bg="white"
      borderBottom="1px solid"
      borderColor="brand.border"
    >
      <Flex align="center" gap={3}>
        <Flex
          align="center"
          justify="center"
          w="32px"
          h="32px"
          bg="brand.orange"
          borderRadius="4px"
        >
          <Text color="white" fontWeight={700} fontSize="16px">
            ds
          </Text>
        </Flex>
        <Box>
          <Text as="span" color="brand.brown" fontWeight={700} fontSize="15px">
            CNG Sandbox
          </Text>
          <Text
            as="span"
            color="brand.textSecondary"
            fontSize="13px"
            ml={2}
            display={{ base: "none", md: "inline" }}
          >
            by Development Seed
          </Text>
        </Box>
      </Flex>
      {children && <Flex gap={2}>{children}</Flex>}
    </Flex>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/Header.tsx
git commit -m "feat(sandbox): add Dev Seed branded Header component"
```

---

### Task 7: Create FileUploader component

**Files:**
- Create: `sandbox/frontend/src/components/FileUploader.tsx`
- Create: `sandbox/frontend/tests/FileUploader.test.tsx`

**Context:** Drag-and-drop zone with file picker and URL input. Uses native HTML drag events. Validates extensions client-side.

- [ ] **Step 1: Write the test**

Create `sandbox/frontend/tests/FileUploader.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import { FileUploader } from "../src/components/FileUploader";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("FileUploader", () => {
  it("renders drop zone and URL input", () => {
    renderWithProviders(
      <FileUploader onFileSelected={vi.fn()} onUrlSubmitted={vi.fn()} />,
    );
    expect(screen.getByText(/drop your file here/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/paste/i)).toBeTruthy();
  });

  it("rejects unsupported file extensions", () => {
    const onFile = vi.fn();
    renderWithProviders(
      <FileUploader onFileSelected={onFile} onUrlSubmitted={vi.fn()} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "doc.xlsx", { type: "application/vnd.ms-excel" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByText(/unsupported/i)).toBeTruthy();
  });

  it("accepts valid file extensions", () => {
    const onFile = vi.fn();
    renderWithProviders(
      <FileUploader onFileSelected={onFile} onUrlSubmitted={vi.fn()} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "raster.tif", { type: "image/tiff" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sandbox/frontend && npx vitest run tests/FileUploader.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `sandbox/frontend/src/components/FileUploader.tsx`:

```typescript
import { useState, useRef, useCallback } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";

const ALLOWED_EXTENSIONS = [".tif", ".tiff", ".zip", ".geojson", ".json", ".nc"];

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  onUrlSubmitted: (url: string) => void;
  disabled?: boolean;
}

function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}

export function FileUploader({
  onFileSelected,
  onUrlSubmitted,
  disabled,
}: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const ext = getExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`Unsupported format: ${ext}`);
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleUrlSubmit = useCallback(() => {
    if (url.trim()) {
      setError(null);
      onUrlSubmitted(url.trim());
    }
  }, [url, onUrlSubmitted]);

  return (
    <Flex direction="column" align="center" py={16} px={8}>
      <Text color="brand.brown" fontSize="22px" fontWeight={700} mb={1}>
        See your data on the web
      </Text>
      <Text color="brand.textSecondary" fontSize="14px" mb={9}>
        Upload a geospatial file and get a shareable map in minutes
      </Text>

      <Box
        border="2px dashed"
        borderColor={dragOver ? "brand.orange" : "#ccc"}
        borderRadius="12px"
        p={14}
        textAlign="center"
        w="100%"
        maxW="480px"
        bg={dragOver ? "orange.50" : "brand.bgSubtle"}
        cursor="pointer"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        opacity={disabled ? 0.5 : 1}
        pointerEvents={disabled ? "none" : "auto"}
      >
        <Text fontSize="40px" mb={4} opacity={0.5}>
          🗺
        </Text>
        <Text color="brand.brown" fontSize="16px" fontWeight={600} mb={2}>
          Drop your file here
        </Text>
        <Text color="brand.textSecondary" fontSize="13px" mb={5}>
          GeoTIFF · Shapefile (.zip) · GeoJSON · NetCDF
        </Text>
        <Button
          bg="brand.orange"
          color="white"
          size="sm"
          fontWeight={600}
          borderRadius="4px"
          _hover={{ bg: "brand.orangeHover" }}
        >
          Browse files
        </Button>
        <Text color="#aaa" fontSize="12px" mt={4}>
          Up to 1 GB
        </Text>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </Box>

      {error && (
        <Text color="red.500" fontSize="13px" mt={3}>
          {error}
        </Text>
      )}

      <Flex align="center" gap={4} w="100%" maxW="480px" mt={6}>
        <Box flex={1} h="1px" bg="brand.border" />
        <Text color="#aaa" fontSize="12px" textTransform="uppercase" letterSpacing="1px">
          or
        </Text>
        <Box flex={1} h="1px" bg="brand.border" />
      </Flex>

      <Flex gap={2} mt={5} w="100%" maxW="480px">
        <Input
          flex={1}
          placeholder="Paste an S3, GCS, or HTTP URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          size="md"
          borderColor="#ddd"
          disabled={disabled}
        />
        <Button
          bg="brand.brown"
          color="white"
          size="md"
          fontWeight={600}
          borderRadius="4px"
          onClick={handleUrlSubmit}
          disabled={disabled || !url.trim()}
        >
          Fetch
        </Button>
      </Flex>
    </Flex>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd sandbox/frontend && npx vitest run tests/FileUploader.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/components/FileUploader.tsx sandbox/frontend/tests/FileUploader.test.tsx
git commit -m "feat(sandbox): add FileUploader with drag-drop and URL input"
```

---

### Task 8: Create ProgressTracker component

**Files:**
- Create: `sandbox/frontend/src/components/ProgressTracker.tsx`
- Create: `sandbox/frontend/tests/ProgressTracker.test.tsx`

**Context:** Vertical stepper that shows 5 stages. Each stage has a visual state: pending (gray circle), active (orange spinner), done (green checkmark), error (red X).

- [ ] **Step 1: Write the test**

Create `sandbox/frontend/tests/ProgressTracker.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import { ProgressTracker } from "../src/components/ProgressTracker";
import type { StageInfo } from "../src/types";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("ProgressTracker", () => {
  it("renders all 5 stage names", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "active" },
      { name: "Converting", status: "pending" },
      { name: "Validating", status: "pending" },
      { name: "Ingesting", status: "pending" },
      { name: "Ready", status: "pending" },
    ];
    renderWithProviders(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="12 MB" />,
    );
    expect(screen.getByText("Scanning")).toBeTruthy();
    expect(screen.getByText("Converting")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("shows filename and size", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "done" },
      { name: "Converting", status: "active" },
      { name: "Validating", status: "pending" },
      { name: "Ingesting", status: "pending" },
      { name: "Ready", status: "pending" },
    ];
    renderWithProviders(
      <ProgressTracker stages={stages} filename="rainfall_2024.tif" fileSize="12.4 MB" />,
    );
    expect(screen.getByText(/rainfall_2024\.tif/)).toBeTruthy();
  });

  it("shows error detail on failed stage", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "done" },
      { name: "Converting", status: "error", detail: "Bad CRS" },
      { name: "Validating", status: "pending" },
      { name: "Ingesting", status: "pending" },
      { name: "Ready", status: "pending" },
    ];
    renderWithProviders(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="1 MB" />,
    );
    expect(screen.getByText("Bad CRS")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sandbox/frontend && npx vitest run tests/ProgressTracker.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `sandbox/frontend/src/components/ProgressTracker.tsx`:

```typescript
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import type { StageInfo } from "../types";

interface ProgressTrackerProps {
  stages: StageInfo[];
  filename: string;
  fileSize: string;
}

function StageIcon({ status }: { status: StageInfo["status"] }) {
  const size = "28px";

  if (status === "done") {
    return (
      <Flex
        align="center"
        justify="center"
        w={size}
        h={size}
        bg="brand.success"
        borderRadius="full"
        flexShrink={0}
      >
        <Text color="white" fontSize="14px">✓</Text>
      </Flex>
    );
  }

  if (status === "active") {
    return (
      <Flex align="center" justify="center" w={size} h={size} flexShrink={0}>
        <Spinner size="sm" color="brand.orange" />
      </Flex>
    );
  }

  if (status === "error") {
    return (
      <Flex
        align="center"
        justify="center"
        w={size}
        h={size}
        bg="red.500"
        borderRadius="full"
        flexShrink={0}
      >
        <Text color="white" fontSize="14px">✕</Text>
      </Flex>
    );
  }

  return (
    <Box
      w={size}
      h={size}
      border="2px solid"
      borderColor="#ddd"
      borderRadius="full"
      flexShrink={0}
    />
  );
}

export function ProgressTracker({ stages, filename, fileSize }: ProgressTrackerProps) {
  return (
    <Flex direction="column" align="center" py={14} px={8}>
      <Text color="brand.brown" fontSize="18px" fontWeight={700} mb={1}>
        Processing {filename}
      </Text>
      <Text color="brand.textSecondary" fontSize="13px" mb={10}>
        {fileSize}
      </Text>

      <Box w="100%" maxW="400px">
        {stages.map((stage, i) => (
          <Flex key={stage.name} align="flex-start" gap={3} mb={i < stages.length - 1 ? 6 : 0} position="relative">
            <StageIcon status={stage.status} />
            <Box pt="3px">
              <Text
                color={
                  stage.status === "active"
                    ? "brand.orange"
                    : stage.status === "error"
                      ? "red.500"
                      : stage.status === "done"
                        ? "brand.brown"
                        : "#bbb"
                }
                fontSize="14px"
                fontWeight={stage.status === "active" || stage.status === "error" ? 700 : 600}
              >
                {stage.name}
              </Text>
              {stage.detail && (
                <Text
                  color={stage.status === "error" ? "red.500" : "brand.textSecondary"}
                  fontSize="12px"
                >
                  {stage.detail}
                </Text>
              )}
            </Box>
            {i < stages.length - 1 && (
              <Box
                position="absolute"
                left="13px"
                top="32px"
                w="2px"
                h="20px"
                bg={stage.status === "done" ? "brand.success" : "#ddd"}
              />
            )}
          </Flex>
        ))}
      </Box>
    </Flex>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd sandbox/frontend && npx vitest run tests/ProgressTracker.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/components/ProgressTracker.tsx sandbox/frontend/tests/ProgressTracker.test.tsx
git commit -m "feat(sandbox): add ProgressTracker stepper component"
```

---

## Chunk 4: Map Components

### Task 9: Create ShareButton component

**Files:**
- Create: `sandbox/frontend/src/components/ShareButton.tsx`

- [ ] **Step 1: Write the component**

Create `sandbox/frontend/src/components/ShareButton.tsx`:

```typescript
import { useState, useCallback } from "react";
import { Button } from "@chakra-ui/react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Button
      bg="brand.orange"
      color="white"
      size="sm"
      fontWeight={600}
      borderRadius="4px"
      _hover={{ bg: "brand.orangeHover" }}
      onClick={handleCopy}
    >
      {copied ? "Copied!" : "🔗 Share"}
    </Button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/ShareButton.tsx
git commit -m "feat(sandbox): add ShareButton component"
```

---

### Task 10: Create CreditsPanel component

**Files:**
- Create: `sandbox/frontend/src/components/CreditsPanel.tsx`
- Create: `sandbox/frontend/tests/CreditsPanel.test.tsx`

**Context:** Sidebar content for MapPage. Renders tool credits, validation results, "What's next" links, and expiry countdown.

- [ ] **Step 1: Write the test**

Create `sandbox/frontend/tests/CreditsPanel.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import { CreditsPanel } from "../src/components/CreditsPanel";
import type { Dataset } from "../src/types";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

const rasterDataset: Dataset = {
  id: "d1",
  filename: "rainfall.tif",
  dataset_type: "raster",
  format_pair: "geotiff-to-cog",
  tile_url: "http://localhost:8082/tiles",
  bounds: [-180, -90, 180, 90],
  stac_collection_id: "sandbox-d1",
  pg_table: null,
  validation_results: [
    { name: "COG structure", passed: true, detail: "Valid COG" },
    { name: "CRS present", passed: true, detail: "EPSG:4326" },
  ],
  credits: [
    { tool: "rio-cogeo", url: "https://github.com/cogeotiff/rio-cogeo", role: "Converted by" },
    { tool: "TiTiler", url: "https://developmentseed.org/titiler", role: "Tiles served by" },
  ],
  created_at: new Date().toISOString(),
};

describe("CreditsPanel", () => {
  it("renders tool credits", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/rio-cogeo/)).toBeTruthy();
    expect(screen.getByText(/TiTiler/)).toBeTruthy();
  });

  it("shows validation summary", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/2\/2 checks passed/)).toBeTruthy();
  });

  it("renders what's next links", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/turn this into a story/i)).toBeTruthy();
    expect(screen.getByText(/talk to development seed/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sandbox/frontend && npx vitest run tests/CreditsPanel.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `sandbox/frontend/src/components/CreditsPanel.tsx`:

```typescript
import { Box, Flex, Link, Text } from "@chakra-ui/react";
import type { Dataset } from "../types";

interface CreditsPanelProps {
  dataset: Dataset;
}

function daysUntilExpiry(createdAt: string): number {
  const created = new Date(createdAt);
  const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function CreditsPanel({ dataset }: CreditsPanelProps) {
  const passedCount = dataset.validation_results.filter((v) => v.passed).length;
  const totalCount = dataset.validation_results.length;
  const allPassed = passedCount === totalCount;
  const days = daysUntilExpiry(dataset.created_at);

  return (
    <Box
      w="100%"
      h="100%"
      bg="white"
      borderLeft="1px solid"
      borderColor="brand.border"
      p={6}
      overflowY="auto"
    >
      <Text
        fontSize="11px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.textSecondary"
        fontWeight={600}
        mb={4}
      >
        How this was made
      </Text>

      {dataset.credits.map((credit) => (
        <Box key={credit.tool} mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
          <Text color="brand.brown" fontSize="13px" fontWeight={600}>
            {credit.role} {credit.tool}
          </Text>
          <Link
            href={credit.url}
            target="_blank"
            rel="noopener noreferrer"
            color="brand.orange"
            fontSize="12px"
            fontWeight={500}
          >
            {new URL(credit.url).host.replace("www.", "")} →
          </Link>
        </Box>
      ))}

      <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
        <Text
          fontSize="11px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="brand.textSecondary"
          fontWeight={600}
          mb={2}
        >
          Validation
        </Text>
        <Text
          color={allPassed ? "brand.success" : "red.500"}
          fontSize="13px"
          fontWeight={600}
        >
          {allPassed ? "✓" : "⚠"} {passedCount}/{totalCount} checks passed
        </Text>
      </Box>

      <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
        <Text
          fontSize="11px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="brand.textSecondary"
          fontWeight={600}
          mb={2}
        >
          What's next
        </Text>
        <Link
          display="block"
          color="brand.orange"
          fontSize="13px"
          fontWeight={600}
          mb={2}
          href="https://developmentseed.org/contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Turn this into a story →
        </Link>
        <Link
          display="block"
          color="brand.orange"
          fontSize="13px"
          fontWeight={500}
          href="https://developmentseed.org/contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Talk to Development Seed →
        </Link>
      </Box>

      <Text color="brand.textSecondary" fontSize="12px">
        ⏳ Expires in {days} day{days !== 1 ? "s" : ""}
      </Text>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd sandbox/frontend && npx vitest run tests/CreditsPanel.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/components/CreditsPanel.tsx sandbox/frontend/tests/CreditsPanel.test.tsx
git commit -m "feat(sandbox): add CreditsPanel sidebar component"
```

---

### Task 11: Create RasterMap component

**Files:**
- Create: `sandbox/frontend/src/components/RasterMap.tsx`

**Context:** Uses @maptool/core's `useTitiler` and `createCOGLayer` to render raster tiles from titiler-pgstac. Includes opacity slider and colormap selector. Auto-zooms to dataset bounds. Reference `tests/no2-viewer/src/App.tsx` and `src/hooks/useTitiler.ts` for the pattern.

- [ ] **Step 1: Write the component**

Create `sandbox/frontend/src/components/RasterMap.tsx`:

```typescript
import { useState, useMemo } from "react";
import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import { useTitiler, createCOGLayer, useColorScale, MapLegend, COLORMAPS } from "@maptool/core";
import type { Dataset } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

interface RasterMapProps {
  dataset: Dataset;
}

export function RasterMap({ dataset }: RasterMapProps) {
  const [opacity, setOpacity] = useState(0.8);
  const [basemap, setBasemap] = useState("streets");

  const tileUrl = dataset.tile_url;
  const { tileJson, statistics } = useTitiler({ tileUrl });
  const { colorScale, setColormap, colormap } = useColorScale({
    min: statistics?.[0]?.min,
    max: statistics?.[0]?.max,
  });

  const layer = useMemo(() => {
    if (!tileJson) return null;
    return createCOGLayer({
      tileJson,
      opacity,
      colorScale,
    });
  }, [tileJson, opacity, colorScale]);

  const initialViewState = useMemo(() => {
    if (!dataset.bounds) {
      return { longitude: 0, latitude: 0, zoom: 2 };
    }
    const [west, south, east, north] = dataset.bounds;
    return {
      longitude: (west + east) / 2,
      latitude: (south + north) / 2,
      zoom: 3,
    };
  }, [dataset.bounds]);

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        initialViewState={initialViewState}
        controller
        layers={layer ? [layer] : []}
        views={new MapView({ repeat: true })}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>

      {/* Basemap selector */}
      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <NativeSelect
          size="xs"
          value={basemap}
          onChange={(e) => setBasemap(e.target.value)}
        >
          <option value="streets">Streets</option>
          <option value="satellite">Satellite</option>
          <option value="dark">Dark</option>
        </NativeSelect>
      </Box>

      {/* Legend */}
      {tileJson && (
        <Box position="absolute" bottom={3} left={3}>
          <MapLegend
            title={dataset.filename}
            colorScale={colorScale}
          />
        </Box>
      )}

      {/* Controls: colormap + opacity */}
      <Flex
        position="absolute"
        bottom={3}
        right={3}
        bg="white"
        borderRadius="6px"
        shadow="sm"
        p={2}
        direction="column"
        gap={2}
      >
        <Box>
          <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
            Colormap
          </Text>
          <NativeSelect
            size="xs"
            value={colormap}
            onChange={(e) => setColormap(e.target.value)}
          >
            {COLORMAPS.map((cm) => (
              <option key={cm} value={cm}>{cm}</option>
            ))}
          </NativeSelect>
        </Box>
        <Box>
          <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
            Opacity
          </Text>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: 80, accentColor: "#CF3F02" }}
          />
        </Box>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/RasterMap.tsx
git commit -m "feat(sandbox): add RasterMap component with useTitiler and deck.gl"
```

---

### Task 12: Create VectorMap component

**Files:**
- Create: `sandbox/frontend/src/components/VectorMap.tsx`

**Context:** Uses MapLibre's native vector tile source pointed at tipg. Auto-detects geometry type and applies smart default styling. Includes basemap toggle.

- [ ] **Step 1: Write the component**

Create `sandbox/frontend/src/components/VectorMap.tsx`:

```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import { Box, NativeSelect } from "@chakra-ui/react";
import maplibregl from "maplibre-gl";
import { config } from "../config";
import type { Dataset } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const FILL_COLOR = "#CF3F02";
const LINE_COLOR = "#CF3F02";
const CIRCLE_COLOR = "#CF3F02";

interface VectorMapProps {
  dataset: Dataset;
}

export function VectorMap({ dataset }: VectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState("streets");

  const tableName = dataset.pg_table || `sandbox_${dataset.id}`;

  const addVectorLayers = useCallback((map: maplibregl.Map) => {
    const sourceUrl = `${config.vectorTilerUrl}/collections/${tableName}/tiles/{z}/{x}/{y}`;

    map.addSource("vector-data", {
      type: "vector",
      tiles: [sourceUrl],
    });

    // Add all three layer types — MapLibre ignores layers that don't match the geometry
    map.addLayer({
      id: "vector-fill",
      type: "fill",
      source: "vector-data",
      "source-layer": tableName,
      paint: { "fill-color": FILL_COLOR, "fill-opacity": 0.3 },
    });

    map.addLayer({
      id: "vector-line",
      type: "line",
      source: "vector-data",
      "source-layer": tableName,
      paint: { "line-color": LINE_COLOR, "line-width": 1.5 },
    });

    map.addLayer({
      id: "vector-circle",
      type: "circle",
      source: "vector-data",
      "source-layer": tableName,
      paint: {
        "circle-color": CIRCLE_COLOR,
        "circle-radius": 4,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1,
      },
    });

    // Click handler for feature inspection
    map.on("click", ["vector-fill", "vector-line", "vector-circle"], (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const html = Object.entries(props)
        .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
        .join("<br>");
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });

    // Cursor on hover
    map.on("mouseenter", "vector-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "vector-fill", () => {
      map.getCanvas().style.cursor = "";
    });
  }, [tableName]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[basemap],
      center: dataset.bounds
        ? [(dataset.bounds[0] + dataset.bounds[2]) / 2, (dataset.bounds[1] + dataset.bounds[3]) / 2]
        : [0, 0],
      zoom: dataset.bounds ? 3 : 2,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      addVectorLayers(map);

      if (dataset.bounds) {
        map.fitBounds(
          [
            [dataset.bounds[0], dataset.bounds[1]],
            [dataset.bounds[2], dataset.bounds[3]],
          ],
          { padding: 40 },
        );
      }
    });

    mapRef.current = map;
    return () => map.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  // Handle basemap changes without recreating the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(BASEMAPS[basemap]);
    map.once("style.load", () => {
      addVectorLayers(map);
    });
  }, [basemap, addVectorLayers]);

  return (
    <Box position="relative" w="100%" h="100%">
      <Box ref={containerRef} w="100%" h="100%" />
      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <NativeSelect
          size="xs"
          value={basemap}
          onChange={(e) => setBasemap(e.target.value)}
        >
          <option value="streets">Streets</option>
          <option value="satellite">Satellite</option>
          <option value="dark">Dark</option>
        </NativeSelect>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/VectorMap.tsx
git commit -m "feat(sandbox): add VectorMap component with MapLibre MVT source"
```

---

## Chunk 5: Pages + Wiring

### Task 13: Build UploadPage

**Files:**
- Create: `sandbox/frontend/src/pages/UploadPage.tsx`

**Context:** Single-page flow with two stages. Stage 1 shows FileUploader, stage 2 shows ProgressTracker. Auto-navigates to `/map/:id` when the job reaches `ready`.

- [ ] **Step 1: Write the page**

Create `sandbox/frontend/src/pages/UploadPage.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { FileUploader } from "../components/FileUploader";
import { ProgressTracker } from "../components/ProgressTracker";
import { useConversionJob } from "../hooks/useConversionJob";

function formatSize(file: File): string {
  const mb = file.size / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { state, startUpload, startUrlFetch } = useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({ name: "", size: "" });

  const isProcessing = state.jobId !== null && state.status !== "failed";

  const handleFile = (file: File) => {
    fileRef.current = { name: file.name, size: formatSize(file) };
    startUpload(file);
  };

  const handleUrl = (url: string) => {
    const filename = url.split("/").pop() || "download";
    fileRef.current = { name: filename, size: "fetching..." };
    startUrlFetch(url);
  };

  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      navigate(`/map/${state.datasetId}`);
    }
  }, [state.status, state.datasetId, navigate]);

  return (
    <Box minH="100vh" bg="white">
      <Header />
      {isProcessing ? (
        <ProgressTracker
          stages={state.stages}
          filename={fileRef.current.name}
          fileSize={fileRef.current.size}
        />
      ) : (
        <FileUploader
          onFileSelected={handleFile}
          onUrlSubmitted={handleUrl}
          disabled={false}
        />
      )}
      {state.status === "failed" && state.error && (
        <Box textAlign="center" py={4}>
          <Text color="red.500" fontSize="14px">{state.error}</Text>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/pages/UploadPage.tsx
git commit -m "feat(sandbox): add UploadPage with upload-to-progress flow"
```

---

### Task 14: Build MapPage

**Files:**
- Create: `sandbox/frontend/src/pages/MapPage.tsx`

**Context:** Fetches dataset metadata, renders either RasterMap or VectorMap based on `dataset_type`, shows CreditsPanel sidebar, header with share + upload buttons.

- [ ] **Step 1: Write the page**

Create `sandbox/frontend/src/pages/MapPage.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Box, Button, Flex, Spinner, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { ShareButton } from "../components/ShareButton";
import { CreditsPanel } from "../components/CreditsPanel";
import { RasterMap } from "../components/RasterMap";
import { VectorMap } from "../components/VectorMap";
import { config } from "../config";
import type { Dataset } from "../types";

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDataset() {
      try {
        const resp = await fetch(`${config.apiBase}/api/datasets/${id}`);
        if (resp.status === 404) {
          navigate(`/expired/${id}`, { replace: true });
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Dataset = await resp.json();

        // Check expiry
        const created = new Date(data.created_at);
        const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          navigate(`/expired/${id}`, { replace: true });
          return;
        }

        setDataset(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [id, navigate]);

  if (loading) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <Spinner size="lg" color="brand.orange" />
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex direction="column" align="center" justify="center" h="calc(100vh - 56px)" gap={4}>
          <Text color="red.500">{error}</Text>
          <Button
            bg="brand.orange"
            color="white"
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
          >
            Retry
          </Button>
        </Flex>
      </Box>
    );
  }

  if (!dataset) return null;

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <Header>
        <ShareButton />
        <Button
          as={Link}
          to="/"
          bg="brand.bgSubtle"
          color="brand.brown"
          size="sm"
          fontWeight={500}
          borderRadius="4px"
        >
          New upload
        </Button>
      </Header>

      <Flex flex={1} overflow="hidden">
        {/* Map area — 70% */}
        <Box flex={7} position="relative">
          {dataset.dataset_type === "raster" ? (
            <RasterMap dataset={dataset} />
          ) : (
            <VectorMap dataset={dataset} />
          )}
        </Box>

        {/* Credits sidebar — 30% */}
        <Box
          flex={3}
          display={{ base: "none", md: "block" }}
          overflow="auto"
        >
          <CreditsPanel dataset={dataset} />
        </Box>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/pages/MapPage.tsx
git commit -m "feat(sandbox): add MapPage with raster/vector switching and credits sidebar"
```

---

### Task 15: Build ExpiredPage

**Files:**
- Create: `sandbox/frontend/src/pages/ExpiredPage.tsx`

- [ ] **Step 1: Write the page**

Create `sandbox/frontend/src/pages/ExpiredPage.tsx`:

```typescript
import { Link } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";

export default function ExpiredPage() {
  return (
    <Box minH="100vh" bg="white">
      <Header />
      <Flex
        direction="column"
        align="center"
        justify="center"
        h="calc(100vh - 56px)"
        px={8}
      >
        <Flex
          align="center"
          justify="center"
          w="56px"
          h="56px"
          bg="brand.bgSubtle"
          borderRadius="full"
          mb={5}
          fontSize="24px"
        >
          ⏳
        </Flex>
        <Text color="brand.brown" fontSize="20px" fontWeight={700} mb={2}>
          This map has expired
        </Text>
        <Text
          color="brand.textSecondary"
          fontSize="14px"
          mb={7}
          maxW="340px"
          textAlign="center"
          lineHeight={1.5}
        >
          Sandbox maps are available for 30 days. Re-upload your data or talk to
          us about a permanent solution.
        </Text>
        <Flex gap={3}>
          <Button
            as={Link}
            to="/"
            bg="brand.orange"
            color="white"
            fontWeight={600}
            borderRadius="4px"
            _hover={{ bg: "brand.orangeHover" }}
          >
            Upload again
          </Button>
          <Button
            as="a"
            href="https://developmentseed.org/contact"
            target="_blank"
            rel="noopener noreferrer"
            bg="brand.bgSubtle"
            color="brand.brown"
            fontWeight={500}
            borderRadius="4px"
          >
            Talk to Dev Seed
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/pages/ExpiredPage.tsx
git commit -m "feat(sandbox): add ExpiredPage with re-upload and contact CTAs"
```

---

### Task 16: Wire up App.tsx with real pages

**Files:**
- Modify: `sandbox/frontend/src/App.tsx`

- [ ] **Step 1: Replace placeholder App.tsx**

Replace the contents of `sandbox/frontend/src/App.tsx`:

```typescript
import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/map/:id" element={<MapPage />} />
      <Route path="/expired/:id" element={<ExpiredPage />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Verify the app builds**

```bash
cd sandbox/frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
cd sandbox/frontend && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add sandbox/frontend/src/App.tsx
git commit -m "feat(sandbox): wire up App router with all pages"
```

---

## Chunk 6: Documentation + Verification

### Task 17: Update CLAUDE.md port table

**Files:**
- Modify: `/home/anthony/projects/map-app-builder/CLAUDE.md`

- [ ] **Step 1: Add sandbox frontend to port table**

In the port table in `CLAUDE.md`, add the sandbox frontend entry after the `coastal-explorer` row:

```
| 5185 | sandbox-frontend |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add sandbox frontend to port table"
```

---

### Task 18: Manual verification

**Context:** This is the final verification step. Requires Docker Compose running for eoAPI + MinIO, the ingestion service running, and the frontend dev server running.

- [ ] **Step 1: Start all services**

```bash
# Terminal 1: eoAPI + MinIO
cd sandbox && docker compose up -d

# Terminal 2: Ingestion service
cd sandbox/ingestion && uvicorn src.app:app --reload --port 8000

# Terminal 3: Frontend
cd sandbox/frontend && yarn dev
```

- [ ] **Step 2: Verify frontend loads**

Open `http://localhost:5185/` — should see the upload page with "See your data on the web" and the drag-drop zone.

- [ ] **Step 3: Verify expired page**

Open `http://localhost:5185/expired/nonexistent` — should see "This map has expired" with two CTA buttons.

- [ ] **Step 4: Verify proxy works**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5185/api/datasets/nonexistent
```

Expected: 404 (proxied through to ingestion service).

- [ ] **Step 5: End-to-end upload flow**

Upload a test GeoTIFF via the UI at `http://localhost:5185/`. Watch the SSE progress tracker advance through stages. Confirm auto-redirect to `/map/:id` with the raster layer rendered and credits sidebar visible. Use the Share button and verify the URL copies to clipboard.

If a test vector file is available (`.zip` shapefile or `.geojson`), repeat with that to verify the VectorMap path.

- [ ] **Step 6: Run full test suite**

```bash
cd sandbox/frontend && npx vitest run
```

Expected: All tests pass.
