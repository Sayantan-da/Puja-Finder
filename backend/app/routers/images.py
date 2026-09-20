import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.image import Image
from app.models.pandal import Pandal
from app.models.user import Role, User
from app.schemas.image import ImageOut
from app.utils.imaging import InvalidImage, compress_image

router = APIRouter(tags=["Images"])

UPLOAD_DIR = Path("uploads") / "pandal_images"
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("/api/pandals/{pandal_id}/images", response_model=list[ImageOut])
def list_images(pandal_id: int, db: Session = Depends(get_db)):
    """All photos for a pandal, newest first."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")
    return (
        db.query(Image)
        .filter(Image.pandal_id == pandal_id)
        .order_by(Image.id.desc())
        .all()
    )


@router.post(
    "/api/pandals/{pandal_id}/images",
    response_model=ImageOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    request: Request,
    pandal_id: int,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a photo for a pandal (login required, JPEG/PNG/WebP, max 5 MB)."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")

    ext = ALLOWED_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG or WebP images are allowed")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB)")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(data)
    # Validate + resize + compress + strip EXIF (privacy for public galleries)
    try:
        compress_image(dest)
    except InvalidImage:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File is not a valid image")

    image = Image(
        pandal_id=pandal_id,
        user_id=user.id,
        image_url=f"/uploads/pandal_images/{filename}",
        caption=caption.strip() or None,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.delete("/api/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a photo — uploader or admin only."""
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    if image.user_id != user.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed")

    # Remove the file unless it is a bundled seed image
    local = Path(image.image_url.lstrip("/"))
    if local.exists() and "seed" not in local.parts:
        local.unlink(missing_ok=True)

    db.delete(image)
    db.commit()
