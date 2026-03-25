# Workspaces Design

**Date:** 2026-03-25
**Status:** Approved

## Problem

The sandbox is fully anonymous and stateless. All datasets and stories are visible to everyone. As more people use the app, users may feel uncomfortable uploading data that strangers can see, edit, or delete.

## Goal

Give each user an isolated workspace so their data is private by default, without requiring accounts or authentication. Reinforce through messaging that we take data privacy seriously — users should feel confident that nobody will see their data unless they choose to share it.

## Design

### URL Structure

All application routes move under a `/w/:workspaceId` prefix:

| Current | New |
|---------|-----|
| `/` | `/` (redirect only) |
| `/datasets` | `/w/:workspaceId/datasets` |
| `/map/:id` | `/w/:workspaceId/map/:id` |
| `/story/new` | `/w/:workspaceId/story/new` |
| `/story/:id` | `/w/:workspaceId/story/:id` |
| `/story/:id/edit` | `/w/:workspaceId/story/:id/edit` |
| `/story/:id/embed` | `/story/:id/embed` (stays public, no prefix) |
| `/expired/:id` | `/w/:workspaceId/expired/:id` |

### Workspace Lifecycle (Frontend)

A `useWorkspace` hook manages the workspace ID:

1. If the current route has `/w/:workspaceId`, use that ID as the **active** workspace. Do **not** overwrite the home workspace in localStorage — visiting a shared link should not change which workspace the user returns to from `/`.
2. If the user visits `/`, check localStorage for their home workspace ID (`myWorkspaceId`). If found, redirect to `/w/<id>`. If not, generate a new 8-character alphanumeric ID, save it as `myWorkspaceId` in localStorage, and redirect.
3. The active workspace ID is provided to the app via React context.
4. All API calls include an `X-Workspace-Id` header, set up centrally in the fetch/API layer.

### Backend

Add a nullable `workspace_id` text column to both the `datasets` and `stories` tables. Nullable so existing rows (which have no workspace) don't require a migration backfill.

**Writes:**
- `POST /api/upload`, `POST /api/convert-url` — read `X-Workspace-Id` header and store it on the dataset row.
- `POST /api/stories` — read `X-Workspace-Id` header and store it on the story row.

**List endpoints (filtered):**
- `GET /api/datasets` — filter by `X-Workspace-Id` header. Return empty list if no header provided.
- `GET /api/stories` — filter by `X-Workspace-Id` header. Return empty list if no header provided.

**Individual resource endpoints (reads — unfiltered):**
- `GET /api/datasets/:id`, `GET /api/stories/:id` — no workspace filter. If you have the resource ID, you can read it. This keeps story embeds, direct links, and cross-workspace viewing working.

**Mutating endpoints (workspace-protected):**
- `PATCH /api/stories/:id`, `DELETE /api/datasets/:id`, `DELETE /api/stories/:id` — require `X-Workspace-Id` header to match the resource's `workspace_id`. Return 403 if they don't match, 400 if the header is missing. This prevents cross-workspace edits and deletions.
- Legacy rows with `workspace_id = NULL` cannot be modified or deleted via the API (no header value can match NULL). They will be cleaned up by the data cleanup task.

**Job and utility endpoints (no workspace required):**
- `GET /api/jobs/{id}/stream` — keyed by job ID, not workspace.
- `GET /api/health` — no workspace header needed.

**Workspace ID validation:**
The backend validates that `X-Workspace-Id` matches `^[a-zA-Z0-9]{8}$`. Requests with invalid or missing workspace IDs on write/list endpoints return 400.

**STAC API and tiler services:**
pgSTAC, titiler, and tipg are third-party services that don't understand workspaces. This is fine — the frontend only uses them for tile rendering, not listing. All listing/filtering happens through the ingestion API.

### Existing Data

No migration. Existing rows have no `workspace_id` and won't appear in any filtered list.

### Data Cleanup

Raster datasets (COGs) are stored in Cloudflare R2, which has its own lifecycle policy that auto-deletes files. A periodic database cleanup task should reconcile:

- **Raster datasets:** Check if the R2 object still exists. If not, delete the dataset row and its pgSTAC entry.
- **Vector datasets and stories:** These are stored only in the database (no R2 object). Apply a matching TTL policy (e.g., 30 days from `created_at`) and delete expired rows.

This replaces the current client-side-only TTL check with actual server-side cleanup, and ensures orphaned workspace-less rows don't accumulate indefinitely.

### UI Elements

**Workspace indicator (header):**
A subtle label in the header showing the workspace ID (e.g., "Workspace k7x2m9"). Clicking it copies the full workspace URL to clipboard.

**Share workspace button (datasets page):**
A button that copies the workspace URL with a tooltip: "Anyone with this link can view and add to this workspace."

**Updated share links (all pages):**
Existing share buttons on MapPage, StoryEditorPage, and anywhere else that copies a URL must include the `/w/:workspaceId` prefix so recipients land in the correct workspace context.

**First-visit welcome toast:**
Shown once per browser (tracked in localStorage). Messaging:

> "Welcome! We've created a private workspace for you. Only people you share the link with can see your data. Bookmark this page to come back later."

The tone should be warm and reassuring — emphasizing privacy by default without being technical. The goal is to make users feel confident that their data won't be shared with strangers, and that data privacy is something we care about.

**Embed flow note:** Story embeds (`/story/:id/embed`) fetch the story and its referenced datasets via unfiltered GET endpoints, then load tiles from the tilers. This entire chain is workspace-agnostic by design, so embeds work regardless of workspace context.

## Non-Goals

- User accounts or authentication
- Workspace management UI (rename, delete, list workspaces)
- Server-side workspace creation endpoint (workspaces are implicit grouping keys)
- Migration of existing data into workspaces
