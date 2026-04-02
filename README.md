# CNG Sandbox

A self-hosted geospatial data conversion sandbox. Upload spatial data files and get back browseable tile maps.

## Supported formats

| Input | Output |
|-------|--------|
| GeoTIFF | Cloud-Optimized GeoTIFF (raster tiles) |
| NetCDF | Cloud-Optimized GeoTIFF (raster tiles) |
| HDF5 | Cloud-Optimized GeoTIFF (raster tiles) |
| GeoJSON | Vector tiles |
| Shapefile | Vector tiles |

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) installed and a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket with API credentials.

```bash
cp .env.example .env          # create local config — fill in R2 credentials
docker compose up -d --build   # start all services
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
Browser ── Frontend (:5185) ──┬── Ingestion API (:8086)
                              ├── Raster tiler  (:8082)
                              └── Vector tiler  (:8083)

Ingestion API ──┬── Cloudflare R2 (S3-compatible storage)
                ├── PostgreSQL + PostGIS + pgSTAC
                └── STAC API
```

All traffic goes through the frontend's dev server — the browser only talks to port 5185.

## Development

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+ (for frontend development)
- Python 3.13+ and [uv](https://docs.astral.sh/uv/) (for backend development)

### Running services individually

Start just the infrastructure (database, object store, tilers):

```bash
docker compose up -d database stac-api raster-tiler vector-tiler
```

Then run the backend and frontend locally for faster iteration:

```bash
# Backend (in one terminal)
cd ingestion
pip install -e "../geo-conversions[all]"
pip install -e ".[dev]"
uvicorn src.app:app --reload --port 8086

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Running tests

```bash
cd ingestion && uv run pytest -v    # backend
cd frontend && npx vitest run       # frontend
```

## Configuration

Copy `.env.example` to `.env` before starting. R2 credentials must be configured before the stack will work.

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_USER` | sandbox | Database username |
| `POSTGRES_PASSWORD` | sandbox_dev_password | Database password |
| `POSTGRES_DB` | postgis | Database name |
| `POSTGRES_PORT` | 5439 | Host port for PostgreSQL |
| `R2_ACCOUNT_ID` | — | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | — | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | — | R2 API token secret key |
| `R2_ENDPOINT` | — | R2 S3 API endpoint URL |
| `R2_PUBLIC_URL` | — | R2 public read URL (r2.dev) |
| `S3_BUCKET` | sandbox-data | Bucket for converted files |

## Services

| Port | Service | Purpose |
|------|---------|---------|
| 5185 | Frontend | Vite dev server — the main entry point |
| 8086 | Ingestion API | File upload and conversion |
| 8081 | STAC API | Spatiotemporal catalog |
| 8082 | Raster tiler | COG tile serving (titiler) |
| 8083 | Vector tiler | Vector tile serving (tipg) |
| 5439 | PostgreSQL | pgSTAC database |

All browser traffic goes through port 5185 — the frontend proxies API and tile requests to backend services.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Containers won't start | `docker compose down -v && docker compose up -d --build` |
| Upload stuck at "Ingesting" | Check tiler logs: `docker compose logs raster-tiler` |
| Vector tiles return 404 | tipg refreshes its catalog every 5 seconds — wait briefly after upload |
| Map shows wrong location | Clear browser cache; old tile URLs may be cached |
| "File too large" error | Maximum upload size is 15 GB per file |
