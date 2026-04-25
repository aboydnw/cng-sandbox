# Services reference

Service-specific configuration notes for the tilers. Read before editing `docker-compose.yml` env-vars for any tiler service or before debugging tile-rendering issues that look like S3/GDAL config problems.

## tipg (vector tiler) notes

- `TIPG_CATALOG_TTL=5` — refresh interval (seconds) for discovering new PostgreSQL tables. Default is 300s which causes long delays.
- Source-layer name in MVT tiles is always `"default"`, not the table name.
- Collection IDs use the `public.` schema prefix (e.g., `public.sandbox_abc123`).

## titiler-pgstac (raster tiler) notes

- Uses GDAL internally. GDAL < 3.11 requires `AWS_S3_ENDPOINT` (hostname:port without protocol) for S3 access, in addition to `AWS_ENDPOINT_URL`.
- `AWS_VIRTUAL_HOSTING=FALSE` is required for R2 (path-style access).

## GDAL + R2 env vars

Any service that uses GDAL to read from R2 (the raster tiler, plus the ingestion service when reading COGs back during conversion) needs the same env-var set in `docker-compose.yml`:

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — R2 credentials
- `AWS_ENDPOINT_URL` — full R2 endpoint (`https://<account>.r2.cloudflarestorage.com`)
- `AWS_S3_ENDPOINT` — hostname only (`<account>.r2.cloudflarestorage.com`), required by GDAL < 3.11
- `AWS_HTTPS=YES`
- `AWS_VIRTUAL_HOSTING=FALSE` — forces path-style URLs (required for R2)
