# Bug Report Button — Design Spec

**Status:** Draft
**Date:** 2026-03-22
**Context:** Users viewing datasets or stories in the sandbox need a way to report rendering issues. The report should capture enough context (IDs, console logs) to reproduce the problem without transmitting any PII.

---

## Problem

When a dataset or story doesn't render correctly, there's no in-app way to report it. Users would need to manually note IDs, open GitHub, and write up the issue themselves. Most won't bother — bugs go unreported and undiagnosed.

## Solution

### 1. Console log capture module

A lightweight module that patches `console.error` and `console.warn` at app startup. Stores entries in a ring buffer (max 50 entries). Each entry includes the timestamp, level, and stringified arguments.

Exposed API: `getRecentLogs(): LogEntry[]`

Mounted once in `main.tsx` via a top-level hook or module side effect. Does not capture `console.log` (too noisy) or `console.info`.

**File:** `src/lib/consoleCapture.ts`

### 2. Bug report modal component

A Chakra UI modal triggered by a header link.

**Trigger:** A text link reading "This data isn't rendering properly?" styled subtly (small font, secondary color).

**Placement per page:**

- **MapPage:** Rendered as a Header child, same pattern used for existing action buttons. Only rendered in the loaded state (not during loading or error states, since no dataset ID is available yet).
- **StoryEditorPage:** Rendered as a Header child, same as MapPage.
- **StoryReaderPage:** This page does not use the Header component — it has its own custom `<Flex>` bar at the top. The link is rendered inline in that bar, between the story title and the "Made with CNG Sandbox" text. This keeps it consistent with the other pages and avoids a floating element over story content.

**Modal contents:**

| Element | Details |
|---------|---------|
| Title | "Report a rendering issue" |
| Privacy note | Short text: "We won't share any of your personal information. Only the details shown below are sent." |
| Description field | Optional textarea. Placeholder: "Describe what you're seeing (optional)" |
| Context summary | Read-only section showing what will be sent: dataset ID(s), story ID (if applicable), current page path, count of captured console errors |
| Console log preview | Collapsible section showing the actual log entries, so the user can inspect them |
| Submit button | Sends the report; shows success/error feedback inline |

**File:** `src/components/BugReportModal.tsx`

**State:** Local component state only (modal open/closed, description text, submission status). No global state needed.

### 3. Context gathering

Each page that renders the bug report link provides context via props:

- **MapPage:** `{ datasetId: string }`
- **StoryReaderPage:** `{ storyId: string, datasetIds: string[] }`
- **StoryEditorPage:** `{ storyId: string, datasetIds: string[] }`

The modal component assembles the full payload:

```typescript
interface BugReportPayload {
  description: string;       // User-provided, may be empty
  page_url: string;          // window.location.pathname
  dataset_id?: string;       // From MapPage
  story_id?: string;         // From story pages
  dataset_ids?: string[];    // All datasets in a story
  console_logs: LogEntry[];  // From consoleCapture
}
```

### 4. Backend endpoint

**`POST /api/bug-report`** on the ingestion API.

**Request body:** The `BugReportPayload` above.

**Server-side config (env vars):** Added to the existing Pydantic `Settings` class in `src/config.py`, following the established pattern. Both are optional with `None` defaults so the app starts without them.

- `GITHUB_TOKEN` — a GitHub personal access token with `repo` scope (or fine-grained with Issues write permission)
- `GITHUB_REPO` — in `owner/repo` format (e.g. `aboydnw/cng-sandbox`)

**Proxy note:** The Vite dev server already proxies `/api` to the ingestion service, so `POST /api/bug-report` works without any proxy config changes.

**Behavior:**
1. Validate payload (reject if both dataset_id and story_id are missing — at least one must be present)
2. Format a GitHub issue body in markdown
3. Create the issue via GitHub's REST API (`POST /repos/{owner}/{repo}/issues`)
4. Return `{ issue_url: string }` on success, or a generic error message on failure

**GitHub issue format:**

- **Title:** `[Bug Report] {page_type} — {id}` where page_type is "Dataset" or "Story" and id is the primary ID. If the user provided a description, use that instead (truncated to 80 characters with ellipsis if longer).
- **Labels:** `bug`, `user-reported` — these must be pre-created in the GitHub repo. If label application fails, create the issue without labels rather than failing entirely.
- **Body:**

```markdown
## Description

{user description or "No description provided"}

## Context

- **Page:** {page_url}
- **Dataset ID:** {dataset_id}
- **Story ID:** {story_id}
- **Dataset IDs:** {dataset_ids joined}
- **Reported at:** {server timestamp}

<details>
<summary>Console logs ({count} entries)</summary>

\```
{formatted log entries with timestamps and levels}
\```

</details>
```

**File:** `src/routes/bug_report.py`

**Registration:** Added to `app.py` alongside existing routers.

### 5. Error handling

- If the GitHub API call fails (bad token, rate limit, network error), the endpoint returns a 502 with a user-friendly message. The frontend shows "Unable to submit report. Please try again later." — no GitHub internals are exposed.
- If `GITHUB_TOKEN` or `GITHUB_REPO` are not configured, the endpoint returns 503. The frontend could optionally hide the bug report link entirely by checking a health/config endpoint, but for v1 it's fine to just show the error on submit.

### 6. What this does NOT include

- **Screenshot capture** — adds complexity, large payloads, and potential PII in screenshots. The IDs provide a reproduction path instead.
- **Automatic error reporting** — only user-initiated. No telemetry or crash reporting.
- **Upload page support** — the button only appears on map/story pages where dataset/story context exists.
- **Rate limiting** — acceptable for an internal tool. Can be added later if needed.

## Testing

**Frontend:**
- Unit test for `consoleCapture`: verify ring buffer behavior, max entries, correct levels captured
- Unit test for `BugReportModal`: verify payload assembly, required context validation

**Backend:**
- Unit test for the bug report endpoint: mock the GitHub API call, verify issue body formatting
- Test validation: reject payloads missing both dataset_id and story_id
- Test error handling: verify 502 response when GitHub API fails
