import io

import pytest
from PIL import Image

from src.services import image_processing


def _png_bytes(width: int, height: int, with_alpha: bool = False) -> bytes:
    mode = "RGBA" if with_alpha else "RGB"
    img = Image.new(mode, (width, height), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_compress_image_resizes_oversize_input():
    result = image_processing.compress_image(_png_bytes(4000, 2000))
    img = Image.open(io.BytesIO(result.original_bytes))
    assert max(img.size) == 2400
    assert result.original_mime == "image/jpeg"
    assert result.width == img.size[0]
    assert result.height == img.size[1]


def test_compress_image_passes_through_small_input():
    src = _png_bytes(800, 600)
    result = image_processing.compress_image(src)
    img = Image.open(io.BytesIO(result.original_bytes))
    assert img.size == (800, 600)


def test_compress_image_keeps_png_for_alpha():
    result = image_processing.compress_image(_png_bytes(800, 600, with_alpha=True))
    assert result.original_mime == "image/png"


def test_compress_image_generates_thumbnail():
    result = image_processing.compress_image(_png_bytes(4000, 2000))
    thumb = Image.open(io.BytesIO(result.thumbnail_bytes))
    assert max(thumb.size) == 400
    assert result.thumbnail_mime == "image/jpeg"


def test_compress_image_rejects_non_image_bytes():
    with pytest.raises(image_processing.InvalidImageError):
        image_processing.compress_image(b"not actually an image")
