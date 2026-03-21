# Datasets Management Page — Design Spec

**Status:** Draft
**Date:** 2026-03-21
**Context:** Preparing the sandbox for an internal demo. Coworkers need to browse and clean up uploaded datasets. Currently there is no inventory view and no way to delete data.

---

## Problem

1. **No visibility into uploaded data.** Datasets are only accessible via direct map URLs or the story editor dropdown. There is no way to see what's been uploaded, when, or how large it is.
2. **No way to delete data.** Test uploads accumulate with no cleanup mechanism. When the sandbox is shared with coworkers, they'll see a pile of mystery files.
3. **Dataset metadata is ephemeral.** The `datasets_store` is an in-memory Python dict. Container restarts wipe the catalog, even though the actual data (COGs in MinIO, STAC entries, Postgres tables) persists. This must be fixed for any management page to be reliable.

## Solution

### 1. Persist dataset metadata to PostgreSQL

Add a `datasets` table via SQLAlchemy. The `DatasetRow` model must share the same `Base` class as `StoryRow` — extract `Base` to a shared `models/base.py` module so `create_all` discovers both tables. The pipeline writes a row when a dataset reaches READY status. This replaces the in-memory `datasets_store` dict.

**Database session in pipeline:** The pipeline runs as a background task and doesn't have access to the request object. Pass the `db_session_factory` (from `app.state`) into `run_pipeline` so it can create its own session for writing the dataset row.

**Schema:**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID, same as today |
| filename | TEXT | Original upload filename |
| dataset_type | TEXT | "raster" or "vector" |
| format_pair | TEXT | e.g. "geotiff-to-cog" |
| tile_url | TEXT | Frontend tile endpoint |
| bounds | JSONB | [west, south, east, north] |
| metadata_json | JSONB | Band info, feature count, geometry types, file sizes, validation results, credits, temporal info, raster stats — everything currently on the Dataset Pydantic model that isn't a top-level column |
| created_at | TIMESTAMP | Upload time |

This is intentionally flat. The `metadata_json` column avoids dozens of nullable columns for raster-vs-vector-specific fields.

**Migration path:** The in-memory `datasets_store` dict is removed entirely. Read operations hit the DB. The `Dataset` Pydantic model stays the same — it's just hydrated from Postgres instead of a dict.

**Pre-existing data:** Any datasets uploaded before this change will not have rows in the new table. Their artifacts (COGs, STAC entries, Postgres tables) still exist but won't appear in the UI. This is acceptable for the demo — a fresh start is cleaner than a reconciliation step.

**Sort order:** `GET /api/datasets` returns results sorted by `created_at DESC` (newest first).

### 2. DELETE /api/datasets/{id}

New endpoint with cascading cleanup:

1. Query stories table to find any stories referencing this dataset (in `dataset_id` or within `chapters_json`)
2. Remove STAC items first, then the STAC collection from pgSTAC (raster datasets) — items must be deleted before the collection to avoid foreign key violations
3. Remove COG/PMTiles from MinIO using the S3 key derived from the dataset's `cog_url`/`parquet_url` fields (add a `delete_object` method to `StorageService` if one doesn't exist)
4. Drop vector table from Postgres (vector datasets via tipg)
5. Remove GeoParquet from MinIO (vector datasets)
6. Delete the dataset row from the `datasets` table

**Response:**

```json
{
  "deleted": true,
  "affected_stories": ["story-uuid-1", "story-uuid-2"]
}
```

**Error case:** If the dataset ID doesn't exist, return 404.

### 3. Frontend — /datasets route

A table page accessible from the main navigation.

**Columns:**

| Column | Content |
|--------|---------|
| Filename | Link to /map/{id} |
| Type | "Raster" or "Vector" badge |
| Uploaded | Relative time from created_at (e.g. "3 days ago") |
| Size | Original file size, human-readable |
| Actions | Delete button (trash icon) |

**Story count:** Include a `story_count` field in each dataset object in the `GET /api/datasets` list response. This avoids an extra API call before showing the delete confirmation.

**Delete flow:**
1. User clicks delete icon
2. Confirmation dialog appears: "Delete {filename}?" with a note like "Used in 2 stories — those chapters will no longer display" if `story_count > 0`
3. On confirm, `DELETE /api/datasets/{id}`
4. Row removed from table

**Size fallback:** If `original_file_size` is null, display "—" instead of a size.

**Empty state:** "No datasets uploaded yet. Upload your first file to get started." with a link to the upload page.

### 4. Navigation

Add "Datasets" link directly in the Header component (not via the `children` prop) so it appears on all pages without each page having to pass it. Register the new `/datasets` route in `App.tsx` pointing to a new `DatasetsPage` component.

---

## What this does NOT include

- **Rename** — low value, adds complexity
- **User ownership** — no auth system yet, all datasets are shared
- **Bulk delete** — premature
- **Storage quotas** — not needed for internal demo
- **Search/filter** — the dataset list will be small enough for the demo

## Dependencies

- Existing SQLAlchemy setup (used by stories)
- Existing MinIO storage service
- Existing pgSTAC integration

## Risks

- **Story-dataset reference check:** Stories store chapters as JSON, so finding dataset references requires scanning `chapters_json`. This is fine at small scale but would need indexing if dataset/story counts grow significantly.
- **Partial delete failure:** If the STAC deletion succeeds but MinIO deletion fails, we'd have an inconsistent state. The endpoint should proceed best-effort and log failures rather than rolling back — orphaned files in MinIO are harmless, missing metadata is not.
- **STAC collection deletion:** pgSTAC requires deleting all items before the collection due to foreign key constraints. The delete service must handle this sequence correctly, especially for temporal datasets with many items.
