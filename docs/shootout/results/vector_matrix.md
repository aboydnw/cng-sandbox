| Source File | Tool | Status | Row count | CRS preserved | Columns preserved | Geometry type | Geometry validity | Geometry fidelity | Attribute fidelity | Bounds preserved | GeoParquet metadata |
|---|---|---|---|---|---|---|---|---|---|---|---|
| firms | geopandas | success | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| firms | ogr2ogr | skipped | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| firms | duckdb | success | PASS | PASS | **FAIL** | PASS | PASS | PASS | **FAIL** | PASS | PASS |
| hydrorivers | geopandas | success | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| hydrorivers | ogr2ogr | skipped | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| hydrorivers | duckdb | success | PASS | PASS | **FAIL** | PASS | PASS | PASS | PASS | PASS | PASS |
| ne_countries_shp | geopandas | success | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| ne_countries_shp | ogr2ogr | skipped | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| ne_countries_shp | duckdb | success | PASS | PASS | **FAIL** | PASS | PASS | PASS | PASS | PASS | PASS |
| earthquakes | geopandas | success | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| earthquakes | gpq | error | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR |
| earthquakes | ogr2ogr | skipped | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| earthquakes | duckdb | success | PASS | PASS | **FAIL** | PASS | PASS | PASS | PASS | PASS | PASS |
| ne_countries_geojson | geopandas | success | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| ne_countries_geojson | gpq | error | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR |
| ne_countries_geojson | ogr2ogr | skipped | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| ne_countries_geojson | duckdb | success | PASS | PASS | **FAIL** | PASS | PASS | PASS | PASS | PASS | PASS |
| ne_rivers_geojson | geopandas | success | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| ne_rivers_geojson | gpq | error | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR | ERROR |
| ne_rivers_geojson | ogr2ogr | skipped | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| ne_rivers_geojson | duckdb | success | PASS | PASS | **FAIL** | PASS | PASS | PASS | PASS | PASS | PASS |
