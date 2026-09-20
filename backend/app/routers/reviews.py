from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.pandal import Pandal
from app.models.report import Report, ReportStatus
from app.models.review import Review
from app.models.user import Role, User
from app.schemas.report import ReportCreate
from app.schemas.review import ReviewCreate, ReviewOut

router = APIRouter(tags=["Reviews"])


@router.get("/api/pandals/{pandal_id}/reviews", response_model=list[ReviewOut])
def list_reviews(
    pandal_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Paginated reviews (newest first). `limit` max 100 — never load everything."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")
    return (
        db.query(Review)
        .filter(Review.pandal_id == pandal_id)
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post(
    "/api/pandals/{pandal_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    request: Request,
    pandal_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add or update your review for a pandal (login required)."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")

    review = (
        db.query(Review)
        .filter(Review.user_id == user.id, Review.pandal_id == pandal_id)
        .first()
    )
    if review:  # one review per user per pandal — update it
        review.rating = data.rating
        review.comment = data.comment
    else:
        review = Review(user_id=user.id, pandal_id=pandal_id, **data.model_dump())
        db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.delete("/api/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a review — owner or admin only."""
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user.id and user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not allowed")
    db.delete(review)
    db.commit()


@router.post(
    "/api/reviews/{review_id}/report",
    status_code=status.HTTP_201_CREATED,
)
def report_review(
    request: Request,
    review_id: int,
    data: ReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Report a review for moderation (login required).

    The report lands in the admin moderation queue with status PENDING."""
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    already = (
        db.query(Report)
        .filter(
            Report.review_id == review_id,
            Report.user_id == user.id,
            Report.status == ReportStatus.PENDING,
        )
        .first()
    )
    if already:
        raise HTTPException(status_code=409, detail="You already reported this review")

    report = Report(
        user_id=user.id,
        pandal_id=review.pandal_id,
        review_id=review.id,
        reason=data.reason.strip(),
        description=data.description,
        status=ReportStatus.PENDING,
    )
    db.add(report)
    db.commit()
    return {"message": "Report submitted for moderation", "report_id": report.id}
