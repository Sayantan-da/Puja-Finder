import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, get_current_user_optional
from app.models.moment import Moment, MomentVote
from app.models.user import Role, User
from app.schemas.moment import MomentOut, MomentRate
from app.utils.imaging import InvalidImage, compress_image

router = APIRouter(tags=["Moments"])

UPLOAD_DIR = Path("uploads") / "moments"
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _aggregates(db: Session, ids: list[int]) -> dict[int, dict]:
    if not ids:
        return {}
    rows = (
        db.query(
            MomentVote.moment_id,
            func.avg(MomentVote.rating).label("avg"),
            func.count(MomentVote.id).label("cnt"),
        )
        .filter(MomentVote.moment_id.in_(ids))
        .group_by(MomentVote.moment_id)
        .all()
    )
    return {
        r.moment_id: {"avg": round(float(r.avg), 2), "cnt": int(r.cnt)} for r in rows
    }


@router.get("/api/moments", response_model=list[MomentOut])
def list_moments(
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Community gallery — paginated, newest shared moments with ratings (public)."""
    rows = (
        db.query(Moment, User.name)
        .join(User, Moment.user_id == User.id)
        .order_by(Moment.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    agg = _aggregates(db, [m.id for m, _ in rows])
    my = {}
    if user is not None:
        votes = db.query(MomentVote).filter(MomentVote.user_id == user.id).all()
        my = {v.moment_id: v.rating for v in votes}

    return [
        MomentOut(
            id=m.id,
            user_id=m.user_id,
            user_name=name,
            image_url=m.image_url,
            caption=m.caption,
            created_at=m.created_at,
            avg_rating=agg.get(m.id, {}).get("avg"),
            vote_count=agg.get(m.id, {}).get("cnt", 0),
            my_rating=my.get(m.id),
        )
        for m, name in rows
    ]


@router.post("/api/moments", response_model=MomentOut, status_code=status.HTTP_201_CREATED)
async def create_moment(
    request: Request,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Share a special moment — upload a photo (login required)."""
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
    try:
        compress_image(dest)
    except InvalidImage:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File is not a valid image")

    moment = Moment(
        user_id=user.id,
        image_url=f"/uploads/moments/{filename}",
        caption=caption.strip() or None,
    )
    db.add(moment)
    db.commit()
    db.refresh(moment)
    return MomentOut(
        id=moment.id,
        user_id=moment.user_id,
        user_name=user.name,
        image_url=moment.image_url,
        caption=moment.caption,
        created_at=moment.created_at,
        vote_count=0,
        my_rating=None,
    )


@router.post("/api/moments/{moment_id}/rate")
def rate_moment(
    request: Request,
    moment_id: int,
    data: MomentRate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rate a moment from 1–5 stars (login required, one vote per user)."""
    moment = db.get(Moment, moment_id)
    if not moment:
        raise HTTPException(status_code=404, detail="Moment not found")

    vote = (
        db.query(MomentVote)
        .filter(MomentVote.moment_id == moment_id, MomentVote.user_id == user.id)
        .first()
    )
    if vote:
        vote.rating = data.rating
    else:
        vote = MomentVote(moment_id=moment_id, user_id=user.id, rating=data.rating)
        db.add(vote)
    db.commit()

    avg = db.query(func.avg(MomentVote.rating)).filter(MomentVote.moment_id == moment_id).scalar()
    cnt = db.query(func.count(MomentVote.id)).filter(MomentVote.moment_id == moment_id).scalar()
    return {
        "moment_id": moment_id,
        "avg_rating": round(float(avg), 2) if avg else None,
        "vote_count": int(cnt or 0),
        "my_rating": data.rating,
    }


@router.delete("/api/moments/{moment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_moment(
    moment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a moment — owner or admin only."""
    moment = db.get(Moment, moment_id)
    if not moment:
        raise HTTPException(status_code=404, detail="Moment not found")
    if moment.user_id != user.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed")

    db.query(MomentVote).filter(MomentVote.moment_id == moment_id).delete()
    local = Path(moment.image_url.lstrip("/"))
    if local.exists() and "seed" not in local.parts:
        local.unlink(missing_ok=True)
    db.delete(moment)
    db.commit()
