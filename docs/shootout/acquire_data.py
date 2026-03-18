"""Download and cache test data for the shootout."""

import io
import urllib.request
import zipfile
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

DOWNLOADS = {
    "ne_color": {
        "url": "https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR.zip",
        "type": "zip",
        "glob": "*.tif",
    },
    "neo_sst": {
        "url": "https://neo.gsfc.nasa.gov/archive/geotiff/MWOI_SST_M/MWOI_SST_M_2024-01.TIFF",
        "type": "file",
        "filename": "MWOI_SST_M_2024-01.tif",
    },
    "ne_gray": {
        "url": "https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip",
        "type": "zip",
        "glob": "*.tif",
    },
    "ne_countries_shp": {
        "url": "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip",
        "type": "zip",
        "glob": "*.shp",
    },
    "ne_countries_geojson": {
        "url": "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson",
        "type": "file",
        "filename": "ne_50m_admin_0_countries.geojson",
    },
    "ne_rivers_geojson": {
        "url": "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_rivers_lake_centerlines.geojson",
        "type": "file",
        "filename": "ne_50m_rivers_lake_centerlines.geojson",
    },
}


_HEADERS = {"User-Agent": "geo-shootout/1.0"}


def download_file(url: str, dest: Path):
    """Download a URL to a local file."""
    print(f"  Downloading {url}...")
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        f.write(resp.read())
    print(f"  Saved to {dest} ({dest.stat().st_size / 1024 / 1024:.1f} MB)")


def download_and_extract_zip(url: str, dest_dir: Path, glob_pattern: str) -> Path | None:
    """Download a ZIP, extract, and return path matching glob."""
    print(f"  Downloading {url}...")
    req = urllib.request.Request(url, headers=_HEADERS)
    data = urllib.request.urlopen(req).read()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        zf.extractall(dest_dir)
    matches = list(dest_dir.rglob(glob_pattern))
    return matches[0] if matches else None


def acquire_all() -> dict[str, Path | None]:
    """Download all test files, returning name -> path mapping."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    results = {}

    for name, spec in DOWNLOADS.items():
        dest_dir = DATA_DIR / name
        dest_dir.mkdir(exist_ok=True)

        if spec["type"] == "file":
            dest = dest_dir / spec["filename"]
            if dest.exists():
                print(f"  [{name}] cached: {dest}")
                results[name] = dest
            else:
                try:
                    download_file(spec["url"], dest)
                    results[name] = dest
                except Exception as e:
                    print(f"  [{name}] FAILED: {e}")
                    results[name] = None
        elif spec["type"] == "zip":
            existing = list(dest_dir.rglob(spec["glob"]))
            if existing:
                print(f"  [{name}] cached: {existing[0]}")
                results[name] = existing[0]
            else:
                try:
                    path = download_and_extract_zip(spec["url"], dest_dir, spec["glob"])
                    results[name] = path
                except Exception as e:
                    print(f"  [{name}] FAILED: {e}")
                    results[name] = None

    return results


if __name__ == "__main__":
    acquire_all()
