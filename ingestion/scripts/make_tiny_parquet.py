"""Generate a tiny GeoParquet fixture for tests."""
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point


def main():
    gdf = gpd.GeoDataFrame(
        {
            "name": [f"P{i}" for i in range(10)],
            "value": list(range(10)),
            "geometry": [Point(i * 0.01, i * 0.01) for i in range(10)],
        },
        crs="EPSG:4326",
    )
    out = Path(__file__).parent.parent / "tests" / "fixtures" / "tiny.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_parquet(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
