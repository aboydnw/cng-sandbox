# Context layers (admin-boundary overlay PMTiles)

The overlay-layers feature ships a small set of reusable **context layers** —
vector admin boundaries an author can drop on top of any chapter's primary
layer. They are seeded as `is_example=True` connections
(`connection_type="pmtiles"`, `tile_type="vector"`) in
[`ingestion/src/services/example_connections.py`](../ingestion/src/services/example_connections.py)
and clone into each workspace through the existing example path — no new
endpoint or flag.

> **⚠️ Placeholder URLs.** The seed entries currently point at placeholder R2
> URLs (`https://pub-REPLACE-ME.r2.dev/context/*.pmtiles`). Build the PMTiles as
> below, upload them to R2, and replace the URLs before this ships to prod —
> otherwise every workspace seeds broken overlay connections.

## Source data

Use **geoBoundaries** (https://www.geoboundaries.org/) — CC BY 4.0, open and
attribution-friendly (record the exact attribution string alongside the upload).
GADM is an alternative but its license forbids redistribution, so prefer
geoBoundaries.

- **admin0** — countries: geoBoundaries `CGAZ` `geoBoundariesCGAZ_ADM0.geojson`
- **admin1** — states/provinces: geoBoundaries `CGAZ` `geoBoundariesCGAZ_ADM1.geojson`

## Build vector PMTiles with tippecanoe

```bash
tippecanoe -zg -o admin0.pmtiles \
  --coalesce-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --layer=admin0 \
  geoBoundariesCGAZ_ADM0.geojson

tippecanoe -zg -o admin1.pmtiles \
  --coalesce-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --layer=admin1 \
  geoBoundariesCGAZ_ADM1.geojson
```

`-zg` auto-picks a max zoom; `--coalesce-densest-as-needed` and
`--extend-zooms-if-still-dropping` keep dense boundaries from being dropped at
low zoom.

## Upload to R2

Upload to the public R2 bucket under a stable `context/` prefix:

```bash
aws s3 cp admin0.pmtiles s3://<bucket>/context/admin0.pmtiles \
  --endpoint-url "$R2_ENDPOINT"
aws s3 cp admin1.pmtiles s3://<bucket>/context/admin1.pmtiles \
  --endpoint-url "$R2_ENDPOINT"
```

The resulting public URL is `${R2_PUBLIC_URL}/context/admin0.pmtiles`. Copy the
final public URLs into the `ExampleConnectionSeed` entries.

## Adding a new context layer

1. Build the `.pmtiles` with tippecanoe (vector tiles).
2. Upload to `context/<name>.pmtiles` in R2.
3. Append an `ExampleConnectionSeed` to `EXAMPLE_CONNECTIONS` with
   `connection_type="pmtiles"`, `tile_type="vector"`, the public URL, and world
   `bounds`. It clones into every workspace automatically on next boot.
