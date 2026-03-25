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

1. If the current route has `/w/:workspaceId`, use that ID. Save it to localStorage as the last-visited workspace.
2. If the user visits `/`, check localStorage for an existing workspace ID. If found, redirect to `/w/<id>`. If not, generate a new 6-8 character alphanumeric ID and redirect.
3. The workspace ID is provided to the app via React context.
4. All API calls include an `X-Workspace-Id` header, set up centrally in the fetch/API layer.

### Backend

Add a `workspace_id` text column to both the `datasets` and `stories` tables.

**Writes:**
- `POST /api/upload`, `POST /api/convert-url` — read `X-Workspace-Id` header and store it on the dataset row.
- `POST /api/stories` — read `X-Workspace-Id` header and store it on the story row.

**List endpoints (filtered):**
- `GET /api/datasets` — filter by `X-Workspace-Id` header. Return empty list if no header provided.
- `GET /api/stories` — filter by `X-Workspace-Id` header. Return empty list if no header provided.

**Individual resource endpoints (unfiltered):**
- `GET /api/datasets/:id`, `GET /api/stories/:id`, `PATCH /api/stories/:id`, `DELETE` endpoints — no workspace filter. If you have the resource ID, you can access it. This keeps story embeds, direct links, and cross-workspace resource access working.

### Existing Data

No migration. Existing rows have no `workspace_id` and won't appear in any filtered list. They expire naturally via the 30-day TTL.

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

## Non-Goals

- User accounts or authentication
- Workspace management UI (rename, delete, list workspaces)
- Server-side workspace creation endpoint (workspaces are implicit grouping keys)
- Migration of existing data into workspaces
