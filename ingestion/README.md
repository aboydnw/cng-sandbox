# Ingestion Service

FastAPI service handling file upload, format conversion, object storage, and STAC registration. Converts GeoTIFF → COG, GeoJSON/Shapefile → GeoParquet, NetCDF → COG, and HDF5 → COG.

## Tests

```bash
uv run pytest -v
```

## API docs

OpenAPI docs are auto-generated at `/api/docs` when the stack is running — visit [http://localhost:5185/api/docs](http://localhost:5185/api/docs).

## Key directories

| Directory | Contents |
|-----------|----------|
| `src/routes/` | FastAPI route handlers |
| `src/services/` | Conversion pipeline, storage, STAC registration |
| `src/models/` | SQLAlchemy models |
| `src/middleware/` | Request middleware |

## More details

See [CLAUDE.md](../CLAUDE.md#ingestion-service) for the conversion pipeline, networking (internal vs public URLs), environment variables, and tiler integration notes.
