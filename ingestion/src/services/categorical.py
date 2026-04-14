"""Auto-detect categorical rasters via GDAL color tables, RATs, or heuristics."""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

MAX_UNIQUE_VALUES = 30
HEURISTIC_INT_DTYPES = frozenset(
    {"uint8", "int8", "uint16", "int16", "uint32", "int32"}
)

QUALITATIVE_PALETTE = [
    "#4E79A7",
    "#F28E2B",
    "#E15759",
    "#76B7B2",
    "#59A14F",
    "#EDC948",
    "#B07AA1",
    "#FF9DA7",
    "#9C755F",
    "#BAB0AC",
    "#86BCB6",
    "#8CD17D",
    "#B6992D",
    "#499894",
    "#D37295",
    "#D4A6C8",
    "#FABFD2",
    "#B3E2CD",
    "#F1CE63",
    "#A0CBE8",
]


@dataclass
class Category:
    value: int
    color: str
    label: str


@dataclass
class CategoricalResult:
    is_categorical: bool
    categories: list[Category] = field(default_factory=list)


def _rgba_to_hex(r: int, g: int, b: int, _a: int = 255) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def _assign_palette_color(index: int) -> str:
    return QUALITATIVE_PALETTE[index % len(QUALITATIVE_PALETTE)]


def _read_sample(src, band: int = 1):
    """Read a band at its coarsest overview, or a decimated full read if no overviews."""
    overviews = src.overviews(band)
    if overviews:
        level = overviews[-1]
        height = max(1, src.height // level)
        width = max(1, src.width // level)
        return src.read(band, out_shape=(height, width))
    target = 512
    if src.height <= target and src.width <= target:
        return src.read(band)
    return src.read(
        band,
        out_shape=(min(target, src.height), min(target, src.width)),
    )


def detect_categories(raster_path: str) -> CategoricalResult:
    """Detect whether a raster is categorical and extract category metadata.

    Three-tier detection (first match wins):
    1. GDAL color table
    2. GDAL Raster Attribute Table (RAT)
    3. Heuristic: integer dtype with ≤30 unique values
    """
    import rasterio

    with rasterio.open(raster_path) as src:
        if src.count != 1:
            return CategoricalResult(is_categorical=False)

        nodata = src.nodata
        dtype = str(src.dtypes[0])

        # Tier 1: GDAL color table
        try:
            colormap = src.colormap(1)
            non_default = {k: v for k, v in colormap.items() if v != (0, 0, 0, 255)}
            if non_default:
                import numpy as np

                data = _read_sample(src, band=1)
                present_values = set(int(v) for v in np.unique(data))
                if nodata is not None:
                    present_values.discard(int(nodata))
                categories = []
                for value, rgba in sorted(non_default.items()):
                    if value not in present_values:
                        continue
                    if len(rgba) >= 4 and rgba[3] == 0:
                        continue
                    categories.append(
                        Category(
                            value=int(value),
                            color=_rgba_to_hex(*rgba),
                            label=f"Class {value}",
                        )
                    )
                if categories:
                    logger.info(
                        "Detected categorical raster via color table: %d classes",
                        len(categories),
                    )
                    return CategoricalResult(is_categorical=True, categories=categories)
        except Exception as exc:
            logger.debug("Color table read failed: %s", exc)

        # Tier 2: GDAL Raster Attribute Table
        try:
            from osgeo import gdal

            ds = gdal.Open(raster_path)
            if ds:
                band = ds.GetRasterBand(1)
                rat = band.GetDefaultRAT()
                if rat and rat.GetRowCount() > 0:
                    label_col = -1
                    for col_idx in range(rat.GetColumnCount()):
                        col_name = rat.GetNameOfCol(col_idx).lower()
                        if col_name in (
                            "class",
                            "name",
                            "label",
                            "description",
                            "category",
                        ):
                            label_col = col_idx
                            break
                    categories = []
                    for row in range(rat.GetRowCount()):
                        value = int(rat.GetValueAsInt(row, 0))
                        if nodata is not None and value == int(nodata):
                            continue
                        label = (
                            rat.GetValueAsString(row, label_col)
                            if label_col >= 0
                            else f"Class {value}"
                        )
                        categories.append(
                            Category(
                                value=value,
                                color=_assign_palette_color(row),
                                label=label,
                            )
                        )
                    if categories:
                        logger.info(
                            "Detected categorical raster via RAT: %d classes",
                            len(categories),
                        )
                        return CategoricalResult(
                            is_categorical=True, categories=categories
                        )
                ds = None
        except ImportError:
            pass
        except Exception as exc:
            logger.debug("RAT read failed: %s", exc)

        # Tier 3: Heuristic — integer dtype with few unique values
        if dtype not in HEURISTIC_INT_DTYPES:
            return CategoricalResult(is_categorical=False)

        import numpy as np

        data = _read_sample(src, band=1)
        unique_values = np.unique(data)

        if nodata is not None:
            unique_values = unique_values[unique_values != int(nodata)]

        if len(unique_values) > MAX_UNIQUE_VALUES:
            return CategoricalResult(is_categorical=False)

        categories = []
        for i, value in enumerate(sorted(unique_values)):
            categories.append(
                Category(
                    value=int(value),
                    color=_assign_palette_color(i),
                    label=f"Class {value}",
                )
            )

        logger.info(
            "Detected categorical raster via heuristic: %d unique values",
            len(categories),
        )
        return CategoricalResult(is_categorical=True, categories=categories)
