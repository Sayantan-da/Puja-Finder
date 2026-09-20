from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.admin import require_admin
from app.models.site_content import ContentBlock
from app.models.user import User
from app.schemas.content import ContentBlockCreate, ContentBlockOut, ContentBlockUpdate

router = APIRouter(tags=["Content"])


@router.get("/api/content", response_model=list[ContentBlockOut])
def list_content(db: Session = Depends(get_db)):
    """All editable content blocks, in page order (public)."""
    return db.query(ContentBlock).order_by(ContentBlock.id).all()


@router.get("/api/content/{key}", response_model=ContentBlockOut)
def get_content(key: str, db: Session = Depends(get_db)):
    block = db.query(ContentBlock).filter(ContentBlock.key == key).first()
    if not block:
        raise HTTPException(status_code=404, detail="Content block not found")
    return block


@router.post("/api/content", response_model=ContentBlockOut, status_code=status.HTTP_201_CREATED)
def create_content(
    data: ContentBlockCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new content block (ADMIN only)."""
    exists = db.query(ContentBlock).filter(ContentBlock.key == data.key).first()
    if exists:
        raise HTTPException(status_code=409, detail="A block with this key already exists")
    block = ContentBlock(key=data.key, title=data.title, body=data.body, updated_by_id=admin.id)
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.put("/api/content/{key}", response_model=ContentBlockOut)
def update_content(
    key: str,
    data: ContentBlockUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Edit a content block (ADMIN only)."""
    block = db.query(ContentBlock).filter(ContentBlock.key == key).first()
    if not block:
        raise HTTPException(status_code=404, detail="Content block not found")
    block.title = data.title
    block.body = data.body
    block.updated_by_id = admin.id
    db.commit()
    db.refresh(block)
    return block


@router.delete("/api/content/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(
    key: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a content block (ADMIN only)."""
    block = db.query(ContentBlock).filter(ContentBlock.key == key).first()
    if not block:
        raise HTTPException(status_code=404, detail="Content block not found")
    db.delete(block)
    db.commit()
