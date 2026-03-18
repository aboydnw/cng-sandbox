"""CNG Toolkit — geospatial file conversion and validation."""

SKILLS = {
    ".tif": "geotiff_to_cog",
    ".tiff": "geotiff_to_cog",
    ".shp": "shapefile_to_geoparquet",
    ".geojson": "geojson_to_geoparquet",
    ".json": "geojson_to_geoparquet",
    ".nc": "netcdf_to_cog",
    ".nc4": "netcdf_to_cog",
}
