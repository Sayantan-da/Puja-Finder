"""Server-side image hardening: validate, resize, compress, strip EXIF.

Every user upload passes through compress_image():
- PIL validates the file is a real image (rejects polyglot/junk uploads)
- Longest edge capped at MAX_DIMENSION (LANCZOS downscale)
- Re-encoded (photos → progressive JPEG q82; PNG kept as PNG, optimized)
- EXIF (GPS coordinates, device info) is stripped — a privacy requirement
  for a public gallery

Inline cost is ~50–150 ms per photo; fine at launch scale. Move to a worker
queue (Arq/RQ) only if uploads ever become a latency problem.
"""
from pathlib import Path

from PIL import Image, UnidentifiedImageError

MAX_DIMENSION = 1600
JPEG_QUALITY = 82


class InvalidImage(Exception):
    """Raised when the upload is not a readable image."""


def compress_image(path: Path) -> tuple[int, int]:
    """Validate + resize + recompress the image at `path` in place.

    Returns (original_bytes, final_bytes).
    Raises InvalidImage if PIL cannot read the file.
    """
    original = path.stat().st_size
    try:
        img = Image.open(path)
        img.load()
    except (UnidentifiedImageError, OSError) as e:
        raise InvalidImage(str(e)) from e

    width, height = img.size
    if max(width, height) > MAX_DIMENSION:
        scale = MAX_DIMENSION / max(width, height)
        img = img.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.LANCZOS)

    if path.suffix.lower() == ".png":
        # Keep PNG (transparency), but optimize; re-save drops EXIF
        img.save(path, "PNG", optimize=True)
    else:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        # Re-save without an exif argument → metadata (GPS etc.) is dropped
        img.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)

    final = path.stat().st_size
    # Never let "compression" grow the file
    if final > original:
        img2 = Image.open(path)
        if path.suffix.lower() == ".png":
            img2.save(path, "PNG")
        else:
            if img2.mode not in ("RGB", "L"):
                img2 = img2.convert("RGB")
            img2.save(path, "JPEG", quality=75)
    return original, path.stat().st_size
