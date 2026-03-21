# Story Publishing Pipeline — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Parent spec:** CNG_Sandbox_StoryMap_Builder_Spec.md (Sections 4.3, Phase 1/2 — this spec supersedes those sections)

---

## 1. Overview

A publishing pipeline that takes a story from the CNG Sandbox editor and produces a live, publicly accessible website hosted on GitHub Pages under the user's own GitHub account.

### The split

- **Sandbox** = the only editor. Create stories, upload data, configure chapters, preview.
- **Published site** = static reader only. Scrollama-driven storytelling experience. No editing capability. Reads `story.json` and loads tiles from R2.
- **GitHub** = where the static reader lives. User's repo, user's GitHub Pages.
- **R2** = where the data lives. Replaces MinIO as primary storage in production. Data URLs are absolute in `story.json`.

### User flow

1. User creates/edits a story in the sandbox (no login required)
2. User clicks "Publish" → prompted to log in with GitHub (OAuth)
3. Sandbox creates a repo under the user's account, pushes static reader + `story.json`, enables GitHub Pages
4. User gets a live URL (e.g., `username.github.io/my-story`)
5. Later: user returns to sandbox, logs in with GitHub, sees their stories, edits one, clicks "Update" → sandbox pushes updated files to the same repo → GitHub Pages auto-redeploys

### "Graduating"

The user's repo is a normal GitHub repo they fully own. They can clone it, customize the HTML/CSS/JS, add a custom domain, or do whatever they want. The sandbox doesn't need to be involved after that — though they lose the visual editor if they diverge.

---

## 2. Authentication & Story Ownership

GitHub OAuth is the only auth, and it's lazy — not required until publish time.

### Flow

- Creating and editing stories requires no login. Same as today.
- When the user clicks "Publish" for the first time, they're prompted to log in with GitHub.
- The sandbox stores the GitHub user ID against the story in PostgreSQL. That's the ownership link.
- On future visits, logging in with GitHub shows "Your Stories" — all stories linked to that GitHub user ID.
- Unpublished stories with no GitHub user remain anonymous (accessible only by direct URL, like today).

### Database changes

Add three nullable columns to `StoryRow`:

| Column | Type | Purpose |
|--------|------|---------|
| `github_user_id` | string, nullable | GitHub user ID from OAuth. Ownership link. |
| `github_repo` | string, nullable | Full repo name, e.g., `username/my-deforestation-story` |
| `published_url` | string, nullable | Live URL, e.g., `https://username.github.io/my-deforestation-story` |

The existing `published` boolean stays, but now means "has been deployed to GitHub Pages" rather than just a flag.

### OAuth scopes

| Scope | Reason |
|-------|--------|
| `repo` | Create repos and push content |
| `read:user` | Get the user's GitHub ID and username |

### Session handling

Store the GitHub access token in the browser session. The backend uses it to make GitHub API calls on the user's behalf. No server-side session store needed — the token is short-lived and can be re-obtained via OAuth.

---

## 3. The Static Reader Bundle

### Repo structure

```
my-story/
├── index.html          # Entry point
├── assets/
│   ├── reader.js       # Bundled renderer (MapLibre, Scrollama, deck.gl)
│   └── reader.css      # Styles
└── story.json          # Story config with absolute R2 URLs for data
```

### How the reader is built

The reader is a pre-built artifact, not built per-publish. It's a single Vite build of the story reader components that already exist in the sandbox frontend (`StoryReaderPage`, `MapChapter`, `ProseChapter`, Scrollama logic). Built once, versioned, reused across all published stories.

### What the reader does

- Loads `story.json` on page load
- Renders chapters: scrollytelling blocks with sticky map + fly-to, prose sections, interactive map chapters
- Fetches raster tiles from R2 via absolute URLs (client-side COG rendering via maplibre-cog-protocol, or titiler if configured)
- Fetches vector tiles from PMTiles URLs
- Renders legends, basemaps, layer styling per the story config

### What the reader does NOT do

- No editing
- No API calls to the sandbox backend
- No authentication

### Versioning

The reader bundle has a version number. When we ship improvements (new chapter types, better transitions, etc.), previously published stories keep working on their version. Users can re-publish from the sandbox to get the latest reader.

### Size estimate

MapLibre (~200KB gzipped) + Scrollama (~3KB) + deck.gl (if included, ~150KB) + reader logic. Total ~400-500KB gzipped.

---

## 4. The Publish Flow

### First publish

1. User clicks "Publish" in the editor
2. If not logged in → GitHub OAuth redirect → return to editor
3. Sandbox shows a publish dialog:
   - Repo name (pre-filled from story title, slugified, editable)
   - Visibility: public (default) or private
   - Preview of the live URL: `username.github.io/repo-name`
4. User confirms → backend:
   - Creates the repo via GitHub API (`POST /user/repos`)
   - Pushes the static reader bundle + generated `story.json`
   - Enables GitHub Pages on the `main` branch (`PUT /repos/:owner/:repo/pages`)
   - Stores `github_repo` and `published_url` on the story row
   - Sets `published = true`
5. Dialog shows "Your story is live!" with the URL and a "Graduate" nudge:
   > "This is your repo — you own it. Want to customize the design, add a custom domain, or make it fully independent? [Clone your repo →]"

### Re-publish (update)

1. User edits an already-published story in the sandbox
2. Clicks "Update Published Story"
3. Backend pushes updated `story.json` to the existing repo (single commit via GitHub API)
4. GitHub Pages auto-redeploys (typically ~30 seconds)
5. Confirmation: "Updated! Changes will be live in about a minute."

### Unpublish

- User can "Unpublish" which disables GitHub Pages via the API. The repo stays (it's theirs). The sandbox clears `published_url` and sets `published = false`.
- We do NOT delete their repo — that's destructive and it's their property.

---

## 5. Data Storage & Costs

### Storage migration

| Environment | Storage backend | Expiry |
|-------------|----------------|--------|
| Current (dev/demo) | MinIO (local S3-compatible) | 30-day lifecycle |
| Production | Cloudflare R2 | No expiry by default |

R2 replaces MinIO as the primary storage backend in production. All uploaded datasets go directly to R2. Data URLs are absolute and stable — they work from both the sandbox reader and the published GitHub Pages site. No URL rewriting needed at publish time.

### Cost controls

| Lever | Mechanism |
|-------|-----------|
| Per-user quota | Tied to GitHub user ID. Default 5GB free. Warn at 80%, block uploads at 100%. |
| Inactive cleanup | Stories not viewed or edited in 12 months → email warning → delete data after 30 more days. Story config survives in PostgreSQL; data URLs break. |
| Require login for uploads (future) | Once R2 is primary, require GitHub login to upload. Prevents drive-by storage consumption. |

### Cost projections

R2 pricing: $0.015/GB/month storage, zero egress.

| Scale | Storage | Monthly cost |
|-------|---------|-------------|
| 100 users x 5GB quota | 500 GB | $7.50 |
| 500 users x 5GB quota | 2.5 TB | $37.50 |
| 1,000 users x 5GB quota | 5 TB | $75.00 |

These are worst-case (every user maxes quota). Real usage will be lower. The inactive cleanup policy prevents unbounded growth.

### "Graduate" path for heavy users

If someone needs more than 5GB, the nudge is "bring your own R2/S3 bucket." They update the data URLs in their `story.json` (or we build a UI for it later). The published story works the same — just points at different URLs.

---

## 6. Re-editing & Story Management

### "Your Stories" page

When a user logs in with GitHub, the sandbox shows a list of their stories — both published and unpublished drafts. Query: `SELECT * FROM stories WHERE github_user_id = :user_id`.

### Editing a published story

Same editor as today. The only difference is a banner at the top: "This story is published at `username.github.io/my-story`. Changes won't be live until you click Update."

### The edit → re-publish cycle

1. User logs in with GitHub
2. Opens a published story from "Your Stories"
3. Edits text, reorders chapters, adjusts map views, changes styling
4. Clicks "Update Published Story" (replaces the current "Publish" button for already-published stories)
5. Backend pushes new `story.json` to the existing repo
6. Done

### v1 limitations

- Cannot add new datasets from the editor (go back to the sandbox upload flow, start a new story or re-upload)
- Cannot change the repo name or URL after first publish

### Anonymous stories

Stories created without logging in still work exactly as they do today — saved in PostgreSQL, viewable at `/story/:id`. They just can't be published. The publish button prompts GitHub login, which retroactively claims the story.

### Collaboration (future, not v1)

Since the story lives in a GitHub repo, the user could add collaborators to the repo. That doesn't help with the sandbox editor — but it's a natural extension later. Multiple GitHub users could be linked to one story.

---

## 7. Relationship to Parent Spec

This spec supersedes the following sections of `CNG_Sandbox_StoryMap_Builder_Spec.md`:

- **Section 4.3** (Publishing Pipeline) — replaced entirely by this spec
- **Section 5, "New integration needed"** — Vercel deploy flow and GitHub Pages deploy items are replaced by this spec's GitHub Pages approach
- **Section 6** (Data Persistence and Expiry) — the R2 migration and quota model here supersedes the MinIO expiry discussion
- **Phase 1** (Publishing pipeline) — replaced by this spec
- **Phase 2** (GitHub Pages deploy item) — replaced by this spec

The parent spec's other sections (mapping dictionary, interactions, templates, "Show Your Work") remain unchanged and are orthogonal to this publishing pipeline.
