"""Image compression service using Pillow."""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_LONG_EDGE = 2400
THUMBNAIL_LONG_EDGE = 400
JPEG_QUALITY = 85
THUMBNAIL_QUALITY = 80


class InvalidImageError(ValueError):
    """Raised when Pillow cannot decode the input bytes as an image."""


@dataclass
class CompressedImage:
    original_bytes: bytes
    original_mime: str
    thumbnail_bytes: bytes
    thumbnail_mime: str
    width: int
    height: int


def _open_and_orient(raw: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise InvalidImageError("could not decode image") from exc
    return ImageOps.exif_transpose(img)


def _resize(img: Image.Image, max_edge: int) -> Image.Image:
    longest = max(img.size)
    if longest <= max_edge:
        return img
    scale = max_edge / longest
    new_size = (round(img.size[0] * scale), round(img.size[1] * scale))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    )


def _encode(img: Image.Image, fmt: str, quality: int) -> bytes:
    buf = io.BytesIO()
    save_kwargs = {"optimize": True}
    if fmt == "JPEG":
        save_kwargs["quality"] = quality
        save_kwargs["progressive"] = True
        if img.mode != "RGB":
            img = img.convert("RGB")
    img.save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def compress_image(raw: bytes) -> CompressedImage:
    img = _open_and_orient(raw)
    keep_png = _has_alpha(img)
    fmt = "PNG" if keep_png else "JPEG"
    mime = "image/png" if keep_png else "image/jpeg"

    resized = _resize(img, MAX_LONG_EDGE)
    original_bytes = _encode(resized, fmt, JPEG_QUALITY)

    thumb_img = _resize(img, THUMBNAIL_LONG_EDGE)
    thumbnail_bytes = _encode(thumb_img, "JPEG", THUMBNAIL_QUALITY)

    return CompressedImage(
        original_bytes=original_bytes,
        original_mime=mime,
        thumbnail_bytes=thumbnail_bytes,
        thumbnail_mime="image/jpeg",
        width=resized.size[0],
        height=resized.size[1],
    )
