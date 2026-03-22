# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the homepage to present two equal entry points — "Convert a file" and "Build a story" — with inline upload progress, improved error handling, and smooth card expand/collapse animations.

**Architecture:** The homepage (`UploadPage.tsx`) becomes a two-card landing page. Clicking "Convert a file" expands the left card to reveal the existing `FileUploader` inline; progress and errors render inside the same card. Clicking "Build a story" navigates to `/story/new`. A new `PathCard` component handles expand/collapse animation. The `ProgressTracker` gets retry/report buttons for error states. A small backend change allows the bug report endpoint to accept `job_id` as context.

**Tech Stack:** React 19, Chakra UI v3, CSS transitions, Vitest, FastAPI, Pydantic, pytest

**Spec:** `docs/superpowers/specs/2026-03-22-homepage-redesign-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/components/HomepageHero.tsx` | Headline + subtitle, pure presentational |
| Create | `frontend/src/components/PathCard.tsx` | Expandable card with CSS transition animation |
| Create | `frontend/src/components/__tests__/PathCard.test.tsx` | Tests for PathCard states and callbacks |
| Modify | `frontend/src/lib/bugReport.ts:3-9` | Add `job_id` to `BugReportPayload` |
| Modify | `frontend/src/components/BugReportModal.tsx:7-13,26-33` | Add `jobId` prop, include in payload |
| Modify | `frontend/src/components/FileUploader.tsx:96-103` | Add `embedded` prop to hide built-in headline |
| Modify | `frontend/src/components/ProgressTracker.tsx:65-119` | Add `onRetry`/`onReport` props, render action buttons on error |
| Create | `frontend/src/components/__tests__/ProgressTracker.test.tsx` | Tests for error state rendering and button callbacks |
| Rewrite | `frontend/src/pages/UploadPage.tsx` | Two-card layout with state machine |
| Create | `frontend/src/pages/__tests__/UploadPage.test.tsx` | Tests for page state transitions |
| Modify | `ingestion/src/routes/bug_report.py:18-29` | Add `job_id` field, update `require_context` validator |
| Modify | `ingestion/src/routes/bug_report.py:33-39` | Update `_build_issue_title` to handle job context |
| Modify | `ingestion/src/routes/bug_report.py:42-67` | Update `_build_issue_body` to include job_id |
| Modify | `ingestion/tests/test_bug_report.py` | Add test for `job_id`-only context |

---

### Task 1: Add `job_id` to Bug Report Backend

**Files:**
- Modify: `ingestion/src/routes/bug_report.py:18-29`
- Modify: `ingestion/src/routes/bug_report.py:33-67`
- Modify: `ingestion/tests/test_bug_report.py`

- [ ] **Step 1: Write the failing test**

Add to `ingestion/tests/test_bug_report.py`:

```python
def test_submit_bug_report_with_job_context(github_client):
    payload = {
        "description": "Upload failed during conversion",
        "page_url": "/",
        "job_id": "job-789",
        "console_logs": [],
    }
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"html_url": "https://github.com/org/repo/issues/3"}
    mock_response.raise_for_status = MagicMock()

    with patch("src.routes.bug_report.httpx.post", return_value=mock_response):
        resp = github_client.post("/api/bug-report", json=payload)

    assert resp.status_code == 200
    assert resp.json()["issue_url"] == "https://github.com/org/repo/issues/3"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ingestion && uv run pytest tests/test_bug_report.py::test_submit_bug_report_with_job_context -v`
Expected: FAIL — validation error (job_id not accepted, no dataset_id/story_id)

- [ ] **Step 3: Add `job_id` field and update validator**

In `ingestion/src/routes/bug_report.py`, modify `BugReportRequest`:

```python
class BugReportRequest(BaseModel):
    description: str = ""
    page_url: str
    dataset_id: str | None = None
    story_id: str | None = None
    job_id: str | None = None
    dataset_ids: list[str] | None = None
    console_logs: list[LogEntry] = []

    @model_validator(mode="after")
    def require_context(self):
        if not self.dataset_id and not self.story_id and not self.job_id:
            raise ValueError("At least one of dataset_id, story_id, or job_id is required")
        return self
```

Update `_build_issue_title` to handle job context:

```python
def _build_issue_title(req: BugReportRequest) -> str:
    if req.description.strip():
        title = req.description.strip()
        return title[:80] + "..." if len(title) > 80 else title
    if req.story_id:
        return f"[Bug Report] Story — {req.story_id}"
    if req.dataset_id:
        return f"[Bug Report] Dataset — {req.dataset_id}"
    return f"[Bug Report] Upload — {req.job_id}"
```

Update `_build_issue_body` to include job_id context — add after the `dataset_ids` line:

```python
    if req.job_id:
        lines.append(f"- **Job ID:** {req.job_id}")
```

- [ ] **Step 4: Run all bug report tests**

Run: `cd ingestion && uv run pytest tests/test_bug_report.py -v`
Expected: All 6 tests PASS (5 existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/routes/bug_report.py ingestion/tests/test_bug_report.py
git commit -m "feat: accept job_id as bug report context for upload errors"
```

---

### Task 2: Wire `jobId` Through Frontend Bug Report Chain

The backend now accepts `job_id`, but the frontend `BugReportPayload` and `BugReportModal` don't know about it. Add `job_id` support so the homepage error state can submit reports with the failing job's ID.

**Files:**
- Modify: `frontend/src/lib/bugReport.ts:3-9`
- Modify: `frontend/src/components/BugReportModal.tsx:7-13,26-33`

- [ ] **Step 1: Add `job_id` to `BugReportPayload`**

In `frontend/src/lib/bugReport.ts`, add `job_id` to the payload interface:

```typescript
export interface BugReportPayload {
  description: string;
  page_url: string;
  dataset_id?: string;
  story_id?: string;
  job_id?: string;
  dataset_ids?: string[];
  console_logs: LogEntry[];
}
```

- [ ] **Step 2: Add `jobId` prop to `BugReportModal`**

In `frontend/src/components/BugReportModal.tsx`, update the props interface:

```tsx
interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  datasetId?: string;
  storyId?: string;
  jobId?: string;
  datasetIds?: string[];
}
```

Update the destructuring:

```tsx
export function BugReportModal({ open, onClose, datasetId, storyId, jobId, datasetIds }: BugReportModalProps) {
```

Update the payload construction in `handleSubmit` to include `job_id`:

```tsx
    const payload: BugReportPayload = {
      description,
      page_url: window.location.pathname,
      dataset_id: datasetId,
      story_id: storyId,
      job_id: jobId,
      dataset_ids: datasetIds,
      console_logs: logs,
    };
```

Update the "What will be sent" preview to show job ID:

```tsx
              {jobId && <Text>Job: {jobId}</Text>}
```

Add this line after the `{storyId && ...}` line.

- [ ] **Step 3: Run existing tests to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: All existing tests PASS (new prop is optional, no behavioral change)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/bugReport.ts frontend/src/components/BugReportModal.tsx
git commit -m "feat: add job_id support to frontend bug report payload and modal"
```

---

### Task 3: Create HomepageHero Component

**Files:**
- Create: `frontend/src/components/HomepageHero.tsx`

- [ ] **Step 1: Create HomepageHero component**

Create `frontend/src/components/HomepageHero.tsx`:

```tsx
import { Box, Text } from "@chakra-ui/react";

export function HomepageHero() {
  return (
    <Box textAlign="center" pt={14} pb={4} px={8}>
      <Text color="brand.brown" fontSize="26px" fontWeight={700} lineHeight={1.3}>
        Test-drive the open source
        <br />
        geospatial stack
      </Text>
      <Text color="brand.textSecondary" fontSize="15px" mt={3}>
        Choose your starting point
      </Text>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/HomepageHero.tsx
git commit -m "feat: add HomepageHero component for redesigned landing page"
```

---

### Task 4: Create `PathCard` Component

**Files:**
- Create: `frontend/src/components/PathCard.tsx`
- Create: `frontend/src/components/__tests__/PathCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/PathCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PathCard } from "../PathCard";

describe("PathCard", () => {
  const defaultProps = {
    icon: "📁",
    title: "Convert a file",
    description: "Upload a geospatial file",
    ctaLabel: "Browse files",
    onClick: vi.fn(),
    expanded: false,
    faded: false,
  };

  it("renders title, description, and CTA in collapsed state", () => {
    render(<PathCard {...defaultProps} />);
    expect(screen.getByText("Convert a file")).toBeTruthy();
    expect(screen.getByText("Upload a geospatial file")).toBeTruthy();
    expect(screen.getByText("Browse files")).toBeTruthy();
  });

  it("calls onClick when CTA button is clicked", () => {
    const onClick = vi.fn();
    render(<PathCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByText("Browse files"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders children and back arrow when expanded", () => {
    const onCollapse = vi.fn();
    render(
      <PathCard {...defaultProps} expanded={true} onCollapse={onCollapse}>
        <div>Drop zone content</div>
      </PathCard>,
    );
    expect(screen.getByText("Drop zone content")).toBeTruthy();
    expect(screen.queryByText("Browse files")).toBeNull();
    expect(screen.queryByText("Upload a geospatial file")).toBeNull();
  });

  it("calls onCollapse when back arrow is clicked", () => {
    const onCollapse = vi.fn();
    render(
      <PathCard {...defaultProps} expanded={true} onCollapse={onCollapse}>
        <div>Content</div>
      </PathCard>,
    );
    fireEvent.click(screen.getByLabelText("Go back"));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it("hides description and CTA when faded", () => {
    render(<PathCard {...defaultProps} faded={true} />);
    expect(screen.getByText("Convert a file")).toBeTruthy();
    expect(screen.queryByText("Upload a geospatial file")).toBeNull();
    expect(screen.queryByText("Browse files")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/__tests__/PathCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PathCard**

Create `frontend/src/components/PathCard.tsx`:

```tsx
import type { ReactNode } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";

interface PathCardProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
  expanded: boolean;
  faded: boolean;
  onCollapse?: () => void;
  children?: ReactNode;
}

const TRANSITION = "all 300ms ease-out";

export function PathCard({
  icon,
  title,
  description,
  ctaLabel,
  onClick,
  expanded,
  faded,
  onCollapse,
  children,
}: PathCardProps) {
  return (
    <Box
      style={{
        flex: expanded ? 2.3 : faded ? 0.7 : 1,
        opacity: faded ? 0.5 : 1,
        transition: TRANSITION,
      }}
      border="2px solid"
      borderColor={expanded ? "brand.orange" : "brand.border"}
      borderRadius="16px"
      overflow="hidden"
      bg="white"
    >
      {expanded ? (
        <Box p={6}>
          <Flex align="center" gap={2} mb={4}>
            <Box
              as="button"
              aria-label="Go back"
              onClick={onCollapse}
              cursor="pointer"
              fontSize="18px"
              color="brand.textSecondary"
              _hover={{ color: "brand.brown" }}
              p={1}
            >
              ←
            </Box>
            <Text fontSize="16px" fontWeight={700} color="brand.brown">
              {title}
            </Text>
          </Flex>
          {children}
        </Box>
      ) : faded ? (
        <Flex direction="column" align="center" justify="center" py={8} px={4}>
          <Text fontSize="28px" mb={2}>{icon}</Text>
          <Text fontSize="13px" fontWeight={600} color="brand.brown" textAlign="center">
            {title}
          </Text>
        </Flex>
      ) : (
        <Flex
          direction="column"
          align="center"
          py={10}
          px={6}
          textAlign="center"
        >
          <Text fontSize="36px" mb={3}>{icon}</Text>
          <Text fontSize="17px" fontWeight={700} color="brand.brown" mb={2}>
            {title}
          </Text>
          <Text fontSize="13px" color="brand.textSecondary" mb={6} maxW="240px" lineHeight={1.5}>
            {description}
          </Text>
          <Button
            bg="brand.orange"
            color="white"
            size="sm"
            fontWeight={600}
            borderRadius="6px"
            _hover={{ bg: "brand.orangeHover" }}
            onClick={onClick}
          >
            {ctaLabel}
          </Button>
        </Flex>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/__tests__/PathCard.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PathCard.tsx frontend/src/components/__tests__/PathCard.test.tsx
git commit -m "feat: add PathCard component with expand/collapse animation"
```

---

### Task 5: Add `embedded` Prop to `FileUploader`

The `FileUploader` currently renders its own headline ("See your data on the web") and subtitle. When embedded inside the expanded PathCard, these should be hidden — the PathCard provides its own header.

**Files:**
- Modify: `frontend/src/components/FileUploader.tsx:7-12,96-103`

- [ ] **Step 1: Add `embedded` prop and conditionally hide headline**

In `frontend/src/components/FileUploader.tsx`:

Add `embedded` to the props interface:

```tsx
interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  onFilesSelected: (files: File[]) => void;
  onUrlSubmitted: (url: string) => void;
  disabled?: boolean;
  embedded?: boolean;
}
```

Update the destructuring (line 35):

```tsx
export function FileUploader({
  onFileSelected,
  onFilesSelected,
  onUrlSubmitted,
  disabled,
  embedded,
}: FileUploaderProps) {
```

In the return JSX, wrap the headline and subtitle (lines 98-103) in a conditional:

```tsx
  return (
    <Flex direction="column" align="center" py={embedded ? 0 : 16} px={embedded ? 0 : 8}>
      {!embedded && (
        <>
          <Text color="brand.brown" fontSize="22px" fontWeight={700} mb={1}>
            See your data on the web
          </Text>
          <Text color="brand.textSecondary" fontSize="14px" mb={9}>
            Upload a geospatial file and get a shareable map in minutes
          </Text>
        </>
      )}
```

Also update the drop zone `maxW` to fill the card when embedded — change line 112 `maxW="480px"` to `maxW={embedded ? "100%" : "480px"}`. Same for the URL input Flex (line 184): `maxW={embedded ? "100%" : "480px"}`.

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd frontend && npx vitest run`
Expected: All existing tests PASS (no behavioral change when `embedded` is not set)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FileUploader.tsx
git commit -m "feat: add embedded prop to FileUploader to hide headline when inside PathCard"
```

---

### Task 6: Add Retry/Report Buttons to `ProgressTracker`

**Files:**
- Modify: `frontend/src/components/ProgressTracker.tsx:4-8,65-119`
- Create: `frontend/src/components/__tests__/ProgressTracker.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/ProgressTracker.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressTracker } from "../ProgressTracker";
import type { StageInfo } from "../../types";

describe("ProgressTracker", () => {
  const baseProps = {
    stages: [
      { name: "Scanning", status: "done" as const },
      { name: "Converting", status: "error" as const, detail: "Unsupported CRS" },
      { name: "Validating", status: "pending" as const },
    ],
    filename: "test.tif",
    fileSize: "24.5 MB",
  };

  it("renders retry button when a stage has error status and onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<ProgressTracker {...baseProps} onRetry={onRetry} />);
    const btn = screen.getByText("Try again");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders report button when onReport is provided", () => {
    const onReport = vi.fn();
    render(<ProgressTracker {...baseProps} onRetry={() => {}} onReport={onReport} />);
    const btn = screen.getByText("Report this issue");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onReport).toHaveBeenCalledOnce();
  });

  it("does not render action buttons when no stage has error", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "done" },
      { name: "Converting", status: "active" },
    ];
    render(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="10 MB" onRetry={() => {}} />,
    );
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("does not render action buttons when onRetry is not provided", () => {
    render(<ProgressTracker {...baseProps} />);
    expect(screen.queryByText("Try again")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/__tests__/ProgressTracker.test.tsx`
Expected: FAIL — onRetry prop not accepted / buttons not rendered

- [ ] **Step 3: Add retry/report buttons to ProgressTracker**

Modify `frontend/src/components/ProgressTracker.tsx`:

Update the props interface:

```tsx
interface ProgressTrackerProps {
  stages: StageInfo[];
  filename: string;
  fileSize: string;
  onRetry?: () => void;
  onReport?: () => void;
  embedded?: boolean;
}
```

Update the function signature:

```tsx
export function ProgressTracker({ stages, filename, fileSize, onRetry, onReport, embedded }: ProgressTrackerProps) {
```

After the stages map (after the closing `</Box>` of the stages list, before the closing `</Flex>` of the component), add:

```tsx
      {onRetry && stages.some((s) => s.status === "error") && (
        <Flex gap={3} mt={6}>
          <Button
            size="sm"
            bg="brand.orange"
            color="white"
            fontWeight={600}
            borderRadius="4px"
            _hover={{ bg: "brand.orangeHover" }}
            onClick={onRetry}
          >
            Try again
          </Button>
          {onReport && (
            <Button
              size="sm"
              variant="outline"
              borderColor="brand.border"
              color="brand.textSecondary"
              fontWeight={600}
              borderRadius="4px"
              _hover={{ color: "brand.brown" }}
              onClick={onReport}
            >
              Report this issue
            </Button>
          )}
        </Flex>
      )}
```

Add `Button` to the Chakra imports at line 1:

```tsx
import { Box, Button, Flex, Text, Spinner } from "@chakra-ui/react";
```

Also update the outer `<Flex>` to respect the `embedded` prop — change `py={14} px={8}` to `py={embedded ? 4 : 14} px={embedded ? 0 : 8}` and remove `align="center"` when embedded (so it left-aligns inside the card):

```tsx
  return (
    <Flex direction="column" align={embedded ? "flex-start" : "center"} py={embedded ? 4 : 14} px={embedded ? 0 : 8}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/__tests__/ProgressTracker.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ProgressTracker.tsx frontend/src/components/__tests__/ProgressTracker.test.tsx
git commit -m "feat: add retry and report buttons to ProgressTracker error state"
```

---

### Task 7: Rewrite `UploadPage` with Two-Card Layout

This is the main task. The page gets a new layout with the state machine from the spec.

**Files:**
- Rewrite: `frontend/src/pages/UploadPage.tsx`

- [ ] **Step 1: Rewrite UploadPage**

Replace `frontend/src/pages/UploadPage.tsx` with:

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Flex } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { HomepageHero } from "../components/HomepageHero";
import { PathCard } from "../components/PathCard";
import { FileUploader } from "../components/FileUploader";
import { ProgressTracker } from "../components/ProgressTracker";
import { VariablePicker } from "../components/VariablePicker";
import { BugReportModal } from "../components/BugReportModal";
import { useConversionJob } from "../hooks/useConversionJob";
import { formatBytes } from "../utils/format";

type PageMode = "initial" | "upload-idle" | "uploading" | "error" | "variable-picker";

export default function UploadPage() {
  const navigate = useNavigate();
  const { state, startUpload, startUrlFetch, startTemporalUpload, confirmVariable } =
    useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({ name: "", size: "" });
  const [mode, setMode] = useState<PageMode>("initial");
  const [reportOpen, setReportOpen] = useState(false);

  const isProcessing = state.isUploading || (state.jobId !== null && state.status !== "failed");

  // Derive mode from conversion job state
  useEffect(() => {
    if (state.scanResult) {
      setMode("variable-picker");
    } else if (state.status === "failed") {
      setMode("error");
    } else if (isProcessing) {
      setMode("uploading");
    }
  }, [state.scanResult, state.status, isProcessing]);

  // Navigate on success
  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      navigate(`/map/${state.datasetId}`);
    }
  }, [state.status, state.datasetId, navigate]);

  const handleFile = useCallback(
    (file: File) => {
      fileRef.current = { name: file.name, size: formatBytes(file.size) };
      setMode("uploading");
      startUpload(file);
    },
    [startUpload],
  );

  const handleUrl = useCallback(
    (url: string) => {
      const filename = url.split("/").pop() || "download";
      fileRef.current = { name: filename, size: "fetching..." };
      setMode("uploading");
      startUrlFetch(url);
    },
    [startUrlFetch],
  );

  const handleTemporalUpload = useCallback(
    (files: File[]) => {
      fileRef.current = { name: `${files.length} files`, size: "calculating..." };
      setMode("uploading");
      startTemporalUpload(files);
    },
    [startTemporalUpload],
  );

  const handleRetry = useCallback(() => {
    setMode("upload-idle");
  }, []);

  const handleReport = useCallback(() => {
    setReportOpen(true);
  }, []);

  const uploadCardExpanded = mode !== "initial";

  return (
    <Box minH="100vh" bg="white">
      <Header />
      <HomepageHero />

      <Flex
        gap={5}
        px={8}
        pb={14}
        pt={4}
        maxW="900px"
        mx="auto"
      >
        {/* Left card: Convert a file */}
        <PathCard
          icon="📁"
          title="Convert a file"
          description="Upload a geospatial file and we'll convert it to a shareable web map"
          ctaLabel="Browse files"
          onClick={() => setMode("upload-idle")}
          expanded={uploadCardExpanded}
          faded={false}
          onCollapse={mode === "upload-idle" ? () => setMode("initial") : undefined}
        >
          {mode === "upload-idle" && (
            <FileUploader
              onFileSelected={handleFile}
              onFilesSelected={handleTemporalUpload}
              onUrlSubmitted={handleUrl}
              disabled={false}
              embedded
            />
          )}
          {(mode === "uploading" || mode === "error") && (
            <ProgressTracker
              stages={state.stages}
              filename={fileRef.current.name}
              fileSize={fileRef.current.size}
              onRetry={mode === "error" ? handleRetry : undefined}
              onReport={mode === "error" ? handleReport : undefined}
              embedded
            />
          )}
          {mode === "variable-picker" && state.scanResult && (
            <VariablePicker
              variables={state.scanResult.variables}
              onSelect={(variable, group) =>
                confirmVariable(state.scanResult!.scan_id, variable, group)
              }
            />
          )}
        </PathCard>

        {/* Right card: Build a story */}
        <PathCard
          icon="📖"
          title="Build a story"
          description="Create a scrollytelling narrative with your data or from our public library"
          ctaLabel="Start building"
          onClick={() => navigate("/story/new")}
          expanded={false}
          faded={uploadCardExpanded}
        />
      </Flex>

      <BugReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        jobId={state.jobId ?? undefined}
      />
    </Box>
  );
}
```

**Key notes for the implementer:**

- The `BugReportModal` receives `jobId={state.jobId}` so that error reports from the homepage include the failing job's ID. Task 2 added the `jobId` prop to the modal and `job_id` to the payload.
- The `mode` state is set optimistically on user action (click "Browse files" → `upload-idle`), then updated reactively from `useConversionJob` state changes (upload starts → `uploading`, fails → `error`, scan → `variable-picker`).
- The `onCollapse` prop is only passed when `mode === "upload-idle"` — once uploading starts, the back arrow disappears (per spec).

- [ ] **Step 2: Verify the app builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/UploadPage.tsx
git commit -m "feat: rewrite homepage with two-card layout and inline upload flow"
```

---

### Task 8: Visual Smoke Test

- [ ] **Step 1: Start the stack**

Run: `docker compose -f docker-compose.yml up -d --build frontend`

- [ ] **Step 2: Screenshot initial state**

Use Playwright MCP to navigate to `http://localhost:5185` and take a screenshot. Verify:
- Header with logo and "Datasets" link
- Hero text: "Test-drive the open source geospatial stack" / "Choose your starting point"
- Two equal cards side by side
- Left card: 📁 "Convert a file" with "Browse files" button
- Right card: 📖 "Build a story" with "Start building" button

- [ ] **Step 3: Screenshot expanded state**

Click "Browse files" and screenshot. Verify:
- Left card expanded with drop zone visible
- Right card faded/shrunk
- Back arrow (←) visible next to "Convert a file"

- [ ] **Step 4: Screenshot collapse**

Click the back arrow (←) and screenshot. Verify:
- Both cards return to equal collapsed state

- [ ] **Step 5: Test story navigation**

Click "Start building" and verify navigation to `/story/new`.

- [ ] **Step 6: Iterate on polish if needed**

If animations feel off (timing, easing) or layout needs adjustment, make tweaks and re-screenshot. Common adjustments:
- Card border radius or padding
- Transition duration (300ms may feel too fast/slow)
- Font sizes relative to card size
- Faded card opacity (0.5 may be too dim)

- [ ] **Step 7: Commit any polish changes**

```bash
git add -u
git commit -m "fix: polish homepage card layout and animation timing"
```

---

### Task 9: Run Full Test Suite

- [ ] **Step 1: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run backend tests**

Run: `cd ingestion && uv run pytest -v`
Expected: All tests PASS

- [ ] **Step 3: Final commit if any fixups needed**

Stage only specific files — do not use `git add -A`.
