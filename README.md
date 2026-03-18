# CNG Sandbox

A self-hosted geospatial data conversion sandbox. Upload spatial data files and get back browseable tile maps — no cloud accounts or API keys required.

## Supported formats

| Input | Output |
|-------|--------|
| GeoTIFF | Cloud-Optimized GeoTIFF (raster tiles) |
| NetCDF | Cloud-Optimized GeoTIFF (raster tiles) |
| GeoJSON | Vector tiles |
| Shapefile | Vector tiles |

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) installed.

```bash
docker compose up -d --build
```

Open [http://localhost:5185](http://localhost:5185) in your browser.

## How it works

1. Upload a file (or paste a URL)
2. The ingestion service detects the format and converts it
3. Raster data becomes Cloud-Optimized GeoTIFFs served by [titiler](https://developmentseed.org/titiler/)
4. Vector data becomes tiles served by [tipg](https://developmentseed.org/tipg/)
5. Browse the result on an interactive map

## Stopping

```bash
docker compose down       # stop containers (data is preserved)
docker compose down -v    # stop and wipe all data
```

## Architecture

```
Browser ── Frontend (:5185) ──┬── Ingestion API (:8000)
                              ├── Raster tiler  (:8082)
                              └── Vector tiler  (:8083)

Ingestion API ──┬── MinIO (S3-compatible storage)
                ├── PostgreSQL + PostGIS + pgSTAC
                └── STAC API
```

All traffic goes through the frontend's dev server — the browser only talks to port 5185.
