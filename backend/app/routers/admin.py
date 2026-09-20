import csv
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cache import ttl_cache
from app.database import get_db
from app.dependencies.admin import require_admin, require_staff
from app.models.audit_log import AuditLog
from app.models.crowd_report import CrowdLevel, CrowdReport
from app.models.event import Event
from app.models.image import Image
from app.models.moment import Moment
from app.models.pandal import Pandal
from app.models.report import Report, ReportStatus
from app.models.review import Review
from app.models.user import Role, User
from app.rate_limit import get_client_ip
from app.schemas.admin import (
    AdminAnalyticsResponse,
    AdminStatsResponse,
    AuditLogOut,
    HourlyCrowdPoint,
    MomentModerationItem,
    PandalAdminOut,
    PandalUpdateAdmin,
    PeakHour,
    ReportOut,
    ReviewModerationItem,
    TopPandalTrend,
)
from app.schemas.auth import UserOut
from app.schemas.pandal import PandalCreate
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/api/admin", tags=["Admin"])

UPLOAD_DIR = Path("uploads/pandal_images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# =============================================================================
# 1. DASHBOARD & ANALYTICS
# =============================================================================

@router.get("/dashboard/stats", response_model=AdminStatsResponse)
def dashboard_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Core KPI metrics for the Admin Dashboard."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_pandals = db.query(func.count(Pandal.id)).scalar() or 0
    active_pandals = db.query(func.count(Pandal.id)).filter(Pandal.is_active == True, Pandal.is_published == True).scalar() or 0
    total_events = db.query(func.count(Event.id)).scalar() or 0
    total_reviews = db.query(func.count(Review.id)).scalar() or 0
    total_crowd_reports = db.query(func.count(CrowdReport.id)).scalar() or 0
    total_moments = db.query(func.count(Moment.id)).scalar() or 0
    pending_reports = db.query(func.count(Report.id)).filter(Report.status == ReportStatus.PENDING).scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        total_pandals=total_pandals,
        active_pandals=active_pandals,
        total_events=total_events,
        total_reviews=total_reviews,
        total_crowd_reports=total_crowd_reports,
        total_moments=total_moments,
        pending_reports_count=pending_reports,
    )


@router.get("/dashboard/analytics", response_model=AdminAnalyticsResponse)
def dashboard_analytics(
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Analytics dataset for hourly crowd charts and top-trend insights."""
    reports = db.query(CrowdReport).all()
    if not reports:
        return AdminAnalyticsResponse(hourly_crowd=[], peak_hours=[], top_pandals=[])

    hourly: dict[int, dict] = {h: {
        "report_count": 0, "low_count": 0, "moderate_count": 0, "high_count": 0,
        "wait_sum": 0, "wait_count": 0,
    } for h in range(24)}

    pandal_stats: dict[int, dict] = {}

    for r in reports:
        created = r.created_at
        if created is None:
            continue
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created)
            except Exception:
                created = datetime.now(timezone.utc)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)

        hour = created.hour
        h = hourly[hour]
        h["report_count"] += 1
        if r.crowd_level == CrowdLevel.LOW:
            h["low_count"] += 1
        elif r.crowd_level == CrowdLevel.MODERATE:
            h["moderate_count"] += 1
        elif r.crowd_level == CrowdLevel.HIGH:
            h["high_count"] += 1

        if r.waiting_time_minutes is not None:
            h["wait_sum"] += r.waiting_time_minutes
            h["wait_count"] += 1

        st = pandal_stats.setdefault(r.pandal_id, {
            "report_count": 0, "wait_sum": 0, "wait_count": 0,
            "latest_level": r.crowd_level.value, "latest_time": created,
        })
        st["report_count"] += 1
        if r.waiting_time_minutes is not None:
            st["wait_sum"] += r.waiting_time_minutes
            st["wait_count"] += 1
        if created > st["latest_time"]:
            st["latest_time"] = created
            st["latest_level"] = r.crowd_level.value

    hourly_crowd = []
    for h in range(24):
        row = hourly[h]
        if row["report_count"] == 0:
            continue
        avg_wait = None
        if row["wait_count"]:
            avg_wait = round(row["wait_sum"] / row["wait_count"], 1)
        hourly_crowd.append(HourlyCrowdPoint(
            hour=h,
            report_count=row["report_count"],
            low_count=row["low_count"],
            moderate_count=row["moderate_count"],
            high_count=row["high_count"],
            avg_waiting_time_minutes=avg_wait,
        ))

    peak_hours = []
    sorted_hours = sorted(hourly_crowd, key=lambda x: x.report_count, reverse=True)[:5]
    for pt in sorted_hours:
        peak_hours.append(PeakHour(hour=pt.hour, report_count=pt.report_count))

    pandal_ids = sorted(pandal_stats.keys(), key=lambda pid: pandal_stats[pid]["report_count"], reverse=True)[:5]
    top_pandals = []
    for pid in pandal_ids:
        pandal = db.get(Pandal, pid)
        if not pandal:
            continue
        stats = pandal_stats[pid]
        avg_wait = None
        if stats["wait_count"]:
            avg_wait = round(stats["wait_sum"] / stats["wait_count"], 1)
        top_pandals.append(TopPandalTrend(
            pandal_id=pid,
            pandal_name=pandal.name,
            report_count=stats["report_count"],
            avg_waiting_time_minutes=avg_wait,
            latest_crowd_level=stats["latest_level"],
        ))

    return AdminAnalyticsResponse(
        hourly_crowd=hourly_crowd,
        peak_hours=peak_hours,
        top_pandals=top_pandals,
    )


# =============================================================================
# 2. PANDAL MANAGEMENT (CRUD, PUBLISH, SOFT-DELETE)
# =============================================================================

@router.get("/pandals", response_model=list[PandalAdminOut])
def list_pandals_admin(
    search: Optional[str] = Query(None),
    status: str = Query("all", description="all | published | draft | archived"),
    locality: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """List all pandals for admin with filter by status (published, draft, archived/soft-deleted)."""
    query = db.query(Pandal)

    if status == "published":
        query = query.filter(Pandal.is_active == True, Pandal.is_published == True)
    elif status == "draft":
        query = query.filter(Pandal.is_active == True, Pandal.is_published == False)
    elif status == "archived":
        query = query.filter(Pandal.is_active == False)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(Pandal.name.ilike(s) | Pandal.locality.ilike(s) | Pandal.theme.ilike(s))
    if locality:
        query = query.filter(Pandal.locality.ilike(f"%{locality.strip()}%"))

    pandals = query.order_by(Pandal.id.desc()).offset(offset).limit(limit).all()

    # Aggregated photo counts and reviews
    ids = [p.id for p in pandals]
    photo_counts = {}
    review_stats = {}
    if ids:
        for pid, cnt in db.query(Image.pandal_id, func.count(Image.id)).filter(Image.pandal_id.in_(ids)).group_by(Image.pandal_id).all():
            photo_counts[pid] = cnt
        for pid, avg_r, cnt_r in db.query(Review.pandal_id, func.avg(Review.rating), func.count(Review.id)).filter(Review.pandal_id.in_(ids)).group_by(Review.pandal_id).all():
            review_stats[pid] = (round(float(avg_r), 1) if avg_r else None, cnt_r)

    out = []
    for p in pandals:
        r_avg, r_cnt = review_stats.get(p.id, (None, 0))
        out.append(
            PandalAdminOut(
                id=p.id,
                name=p.name,
                address=p.address,
                locality=p.locality,
                latitude=p.latitude,
                longitude=p.longitude,
                theme=p.theme,
                description=p.description,
                opening_time=p.opening_time,
                closing_time=p.closing_time,
                dates=p.dates,
                accessibility_tags=p.accessibility_tags,
                official_links=p.official_links,
                parking_info=p.parking_info,
                metro_info=p.metro_info,
                route_tips=p.route_tips,
                is_verified_by_admin=p.is_verified_by_admin,
                is_published=p.is_published,
                is_active=p.is_active,
                deleted_at=p.deleted_at,
                created_at=p.created_at,
                updated_at=p.updated_at,
                avg_rating=r_avg,
                review_count=r_cnt,
                photo_count=photo_counts.get(p.id, 0),
            )
        )
    return out


@router.get("/pandals/{pandal_id}", response_model=PandalAdminOut)
def get_pandal_admin(
    pandal_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Retrieve full pandal details for editing."""
    p = db.get(Pandal, pandal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pandal not found")
    photo_cnt = db.query(func.count(Image.id)).filter(Image.pandal_id == p.id).scalar() or 0
    r_stats = db.query(func.avg(Review.rating), func.count(Review.id)).filter(Review.pandal_id == p.id).first()
    avg_r = round(float(r_stats[0]), 1) if r_stats and r_stats[0] else None
    cnt_r = r_stats[1] if r_stats else 0

    return PandalAdminOut(
        id=p.id,
        name=p.name,
        address=p.address,
        locality=p.locality,
        latitude=p.latitude,
        longitude=p.longitude,
        theme=p.theme,
        description=p.description,
        opening_time=p.opening_time,
        closing_time=p.closing_time,
        dates=p.dates,
        accessibility_tags=p.accessibility_tags,
        official_links=p.official_links,
        parking_info=p.parking_info,
        metro_info=p.metro_info,
        route_tips=p.route_tips,
        is_verified_by_admin=p.is_verified_by_admin,
        is_published=p.is_published,
        is_active=p.is_active,
        deleted_at=p.deleted_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
        avg_rating=avg_r,
        review_count=cnt_r,
        photo_count=photo_cnt,
    )


@router.post("/pandals", response_model=PandalAdminOut, status_code=status.HTTP_201_CREATED)
async def create_pandal_admin(
    request: Request,
    data: PandalCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new pandal and record audit log."""
    p = Pandal(
        **data.model_dump(),
        is_verified_by_admin=True,
        is_published=True,
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    record_audit_log(
        db=db,
        user=admin,
        action="PANDAL_CREATE",
        entity_type="pandal",
        entity_id=p.id,
        details={"name": p.name, "locality": p.locality},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")

    return PandalAdminOut(
        id=p.id, name=p.name, address=p.address, locality=p.locality,
        latitude=p.latitude, longitude=p.longitude, theme=p.theme, description=p.description,
        opening_time=p.opening_time, closing_time=p.closing_time, dates=p.dates,
        accessibility_tags=p.accessibility_tags, official_links=p.official_links,
        parking_info=p.parking_info, metro_info=p.metro_info, route_tips=p.route_tips,
        is_verified_by_admin=p.is_verified_by_admin, is_published=p.is_published,
        is_active=p.is_active, created_at=p.created_at, updated_at=p.updated_at,
    )


@router.patch("/pandals/{pandal_id}", response_model=PandalAdminOut)
async def update_pandal_admin(
    request: Request,
    pandal_id: int,
    data: PandalUpdateAdmin,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update all pandal fields with audit logging and cache invalidation."""
    p = db.get(Pandal, pandal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pandal not found")

    changes = {}
    for field, val in data.model_dump(exclude_unset=True).items():
        old_val = getattr(p, field, None)
        if old_val != val:
            changes[field] = {"old": str(old_val), "new": str(val)}
            setattr(p, field, val)

    p.updated_at = func.now()
    db.commit()
    db.refresh(p)

    if changes:
        record_audit_log(
            db=db,
            user=admin,
            action="PANDAL_EDIT",
            entity_type="pandal",
            entity_id=p.id,
            details=changes,
            ip_address=get_client_ip(request),
        )
        await ttl_cache.invalidate_prefix("/api/pandals")

    return get_pandal_admin(pandal_id=p.id, db=db, admin=admin)


@router.patch("/pandals/{pandal_id}/publish")
async def toggle_publish_pandal(
    request: Request,
    pandal_id: int,
    publish: bool = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Toggle publish / unpublish (Draft mode) for a pandal."""
    p = db.get(Pandal, pandal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pandal not found")

    p.is_published = publish
    p.updated_at = func.now()
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="PANDAL_PUBLISH" if publish else "PANDAL_UNPUBLISH",
        entity_type="pandal",
        entity_id=p.id,
        details={"name": p.name, "is_published": publish},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")
    return {"message": f"Pandal '{p.name}' is now {'Published' if publish else 'Unpublished (Draft)'}."}


@router.delete("/pandals/{pandal_id}")
async def soft_delete_pandal(
    request: Request,
    pandal_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Soft delete pandal (sets is_active=False, preserving history for future Pujas)."""
    p = db.get(Pandal, pandal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pandal not found")

    p.is_active = False
    p.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    p.updated_at = func.now()
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="PANDAL_SOFT_DELETE",
        entity_type="pandal",
        entity_id=p.id,
        details={"name": p.name},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")
    return {"message": f"Pandal '{p.name}' has been archived (soft-deleted)."}


@router.post("/pandals/{pandal_id}/restore")
async def restore_pandal(
    request: Request,
    pandal_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Restore an archived pandal."""
    p = db.get(Pandal, pandal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pandal not found")

    p.is_active = True
    p.deleted_at = None
    p.updated_at = func.now()
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="PANDAL_RESTORE",
        entity_type="pandal",
        entity_id=p.id,
        details={"name": p.name},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")
    return {"message": f"Pandal '{p.name}' has been restored."}


# =============================================================================
# 3. PANDAL PHOTO MANAGEMENT
# =============================================================================

@router.post("/pandals/{pandal_id}/photos")
async def upload_pandal_photo_admin(
    request: Request,
    pandal_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Upload an official photo to a pandal gallery."""
    p = db.get(Pandal, pandal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pandal not found")

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WebP images are allowed.")

    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    image_url = f"/uploads/pandal_images/{filename}"
    img = Image(pandal_id=pandal_id, user_id=admin.id, image_url=image_url, caption=caption)
    db.add(img)
    db.commit()
    db.refresh(img)

    record_audit_log(
        db=db,
        user=admin,
        action="PHOTO_UPLOAD",
        entity_type="image",
        entity_id=img.id,
        details={"pandal_id": pandal_id, "image_url": image_url},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")
    return {"id": img.id, "image_url": img.image_url, "caption": img.caption}


@router.delete("/photos/{photo_id}")
async def delete_pandal_photo_admin(
    request: Request,
    photo_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a pandal photo."""
    img = db.get(Image, photo_id)
    if not img:
        raise HTTPException(status_code=404, detail="Photo not found")

    pandal_id = img.pandal_id
    db.delete(img)
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="PHOTO_DELETE",
        entity_type="image",
        entity_id=photo_id,
        details={"pandal_id": pandal_id},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")
    return {"message": "Photo deleted."}


# =============================================================================
# 4. CONTENT MODERATION & SAFETY (REVIEWS, MOMENTS, FLAGS, USER BLOCKING)
# =============================================================================

@router.get("/moderation/reviews", response_model=list[ReviewModerationItem])
def list_moderation_reviews(
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """List reviews with associated flag counts for moderation."""
    reviews = db.query(Review).order_by(Review.id.desc()).limit(100).all()
    out = []
    for r in reviews:
        pandal = db.get(Pandal, r.pandal_id)
        u = db.get(User, r.user_id)
        flag_cnt = db.query(func.count(Report.id)).filter(Report.review_id == r.id).scalar() or 0
        out.append(
            ReviewModerationItem(
                id=r.id,
                pandal_id=r.pandal_id,
                pandal_name=pandal.name if pandal else f"#{r.pandal_id}",
                user_id=r.user_id,
                user_name=u.name if u else "Anonymous",
                user_email=u.email if u else None,
                rating=r.rating,
                comment=r.comment,
                is_approved=r.is_approved,
                created_at=r.created_at,
                flag_count=flag_cnt,
            )
        )
    return out


@router.patch("/moderation/reviews/{review_id}")
def moderate_review(
    request: Request,
    review_id: int,
    approved: bool = Query(..., description="True to approve, False to hide/reject"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Approve or hide a user review."""
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")

    r.is_approved = approved
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="REVIEW_APPROVE" if approved else "REVIEW_HIDE",
        entity_type="review",
        entity_id=r.id,
        details={"rating": r.rating, "is_approved": approved},
        ip_address=get_client_ip(request),
    )
    return {"message": f"Review #{review_id} has been {'approved' if approved else 'hidden'}."}


@router.get("/moderation/moments", response_model=list[MomentModerationItem])
def list_moderation_moments(
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """List user photo moments for content approval."""
    moments = db.query(Moment).order_by(Moment.id.desc()).limit(100).all()
    out = []
    for m in moments:
        u = db.get(User, m.user_id)
        out.append(
            MomentModerationItem(
                id=m.id,
                user_id=m.user_id,
                user_name=u.name if u else "User",
                user_email=u.email if u else None,
                image_url=m.image_url,
                caption=m.caption,
                is_approved=m.is_approved,
                created_at=m.created_at,
            )
        )
    return out


@router.patch("/moderation/moments/{moment_id}")
def moderate_moment(
    request: Request,
    moment_id: int,
    approved: bool = Query(..., description="True to approve, False to hide/reject"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Approve or hide a user photo moment."""
    m = db.get(Moment, moment_id)
    if not m:
        raise HTTPException(status_code=404, detail="Moment not found")

    m.is_approved = approved
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="MOMENT_APPROVE" if approved else "MOMENT_HIDE",
        entity_type="moment",
        entity_id=m.id,
        details={"is_approved": approved},
        ip_address=get_client_ip(request),
    )
    return {"message": f"Moment #{moment_id} has been {'approved' if approved else 'hidden'}."}


@router.patch("/users/{user_id}/block")
def block_or_unblock_user(
    request: Request,
    user_id: int,
    blocked: bool = Query(..., description="True to block user, False to unblock"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Block or unblock an abusive user."""
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.role == Role.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot block another administrator.")

    target_user.is_active = not blocked
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="USER_BLOCK" if blocked else "USER_UNBLOCK",
        entity_type="user",
        entity_id=target_user.id,
        details={"user_email": target_user.email, "blocked": blocked},
        ip_address=get_client_ip(request),
    )
    return {"message": f"User {target_user.email or target_user.name} is now {'Blocked' if blocked else 'Active'}."}


@router.patch("/users/{user_id}/role")
def change_user_role(
    request: Request,
    user_id: int,
    new_role: Role = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Change user role (USER, MODERATOR, ADMIN)."""
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = target_user.role
    target_user.role = new_role
    db.commit()

    record_audit_log(
        db=db,
        user=admin,
        action="USER_ROLE_CHANGE",
        entity_type="user",
        entity_id=target_user.id,
        details={"old_role": old_role.value, "new_role": new_role.value},
        ip_address=get_client_ip(request),
    )
    return {"message": f"User role updated to {new_role.value}."}


# =============================================================================
# 5. AUDIT LOGS & REPORTS QUEUE
# =============================================================================

@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Retrieve full audit log history."""
    return db.query(AuditLog).order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()


@router.get("/reports", response_model=list[ReportOut])
def list_reports(
    status_filter: ReportStatus | None = Query(None, alias="status"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Moderation queue for user reports and flagged inaccuracies."""
    query = db.query(Report)
    if status_filter:
        query = query.filter(Report.status == status_filter)
    return query.order_by(Report.id.desc()).offset(offset).limit(limit).all()


@router.patch("/reports/{report_id}", response_model=ReportOut)
def update_report_status(
    request: Request,
    report_id: int,
    new_status: ReportStatus = Query(..., alias="status"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    """Update status of a moderation report (PENDING, RESOLVED, REJECTED)."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = new_status
    db.commit()
    db.refresh(report)

    record_audit_log(
        db=db,
        user=admin,
        action="REPORT_STATUS_UPDATE",
        entity_type="report",
        entity_id=report_id,
        details={"status": new_status.value, "reason": report.reason},
        ip_address=get_client_ip(request),
    )
    return report


@router.get("/users", response_model=list[UserOut])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(require_staff),
):
    return db.query(User).order_by(User.id).offset(skip).limit(limit).all()


# =============================================================================
# 6. CSV IMPORT
# =============================================================================

@router.post("/pandals/import-csv")
async def import_pandals_csv(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Upload official CSV of pandals with coordinates, hours, dates, transit info."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV file (.csv)")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    added = 0
    updated = 0
    errors = []

    for row_idx, row in enumerate(reader, start=2):
        name = (row.get("name") or row.get("Name") or "").strip()
        if not name:
            continue

        locality = (row.get("locality") or row.get("Locality") or "").strip() or None
        address = (row.get("address") or row.get("Address") or "").strip() or f"{name}, Kolkata"
        theme = (row.get("theme") or row.get("Theme") or "").strip() or None
        description = (row.get("description") or row.get("Description") or "").strip() or None
        opening_time = (row.get("opening_time") or row.get("Opening_Time") or "04:00").strip()
        closing_time = (row.get("closing_time") or row.get("Closing_Time") or "23:30").strip()
        dates = (row.get("dates") or row.get("Dates") or "").strip() or None
        accessibility_tags = (row.get("accessibility_tags") or row.get("Accessibility_Tags") or "").strip() or None
        official_links = (row.get("official_links") or row.get("Official_Links") or "").strip() or None
        parking_info = (row.get("parking_info") or row.get("Parking_Info") or "").strip() or None
        metro_info = (row.get("metro_info") or row.get("Metro_Info") or "").strip() or None
        route_tips = (row.get("route_tips") or row.get("Route_Tips") or "").strip() or None

        lat_val = row.get("latitude") or row.get("Latitude")
        lng_val = row.get("longitude") or row.get("Longitude")
        latitude = None
        longitude = None

        if lat_val:
            try:
                latitude = float(str(lat_val).strip())
            except ValueError:
                errors.append(f"Row {row_idx} ({name}): invalid latitude '{lat_val}'")
        if lng_val:
            try:
                longitude = float(str(lng_val).strip())
            except ValueError:
                errors.append(f"Row {row_idx} ({name}): invalid longitude '{lng_val}'")

        p = db.query(Pandal).filter(Pandal.name == name).first()
        if p:
            if locality: p.locality = locality
            if address: p.address = address
            if latitude is not None: p.latitude = latitude
            if longitude is not None: p.longitude = longitude
            if theme: p.theme = theme
            if description: p.description = description
            if opening_time: p.opening_time = opening_time
            if closing_time: p.closing_time = closing_time
            if dates: p.dates = dates
            if accessibility_tags: p.accessibility_tags = accessibility_tags
            if official_links: p.official_links = official_links
            if parking_info: p.parking_info = parking_info
            if metro_info: p.metro_info = metro_info
            if route_tips: p.route_tips = route_tips
            p.is_verified_by_admin = True
            p.is_published = True
            p.is_active = True
            p.updated_at = func.now()
            updated += 1
        else:
            db.add(
                Pandal(
                    name=name,
                    locality=locality,
                    address=address,
                    latitude=latitude,
                    longitude=longitude,
                    theme=theme,
                    description=description,
                    opening_time=opening_time,
                    closing_time=closing_time,
                    dates=dates,
                    accessibility_tags=accessibility_tags,
                    official_links=official_links,
                    parking_info=parking_info,
                    metro_info=metro_info,
                    route_tips=route_tips,
                    is_verified_by_admin=True,
                    is_published=True,
                    is_active=True,
                )
            )
            added += 1

    db.commit()
    record_audit_log(
        db=db,
        user=admin,
        action="PANDAL_CSV_IMPORT",
        entity_type="pandal",
        details={"added": added, "updated": updated, "filename": file.filename},
        ip_address=get_client_ip(request),
    )
    await ttl_cache.invalidate_prefix("/api/pandals")
    total = db.query(Pandal).count()
    return {
        "message": f"CSV import successful: {added} added, {updated} updated (marked as Verified by Admin).",
        "added": added,
        "updated": updated,
        "total_pandals": total,
        "warnings": errors,
    }


@router.get("/pandals/sample-csv")
def download_sample_csv(admin: User = Depends(require_staff)):
    """Return a preformatted CSV template for importing pandals."""
    sample_csv = (
        "name,locality,address,latitude,longitude,dates,opening_time,closing_time,accessibility_tags,official_links,parking_info,metro_info,route_tips,theme,description\n"
        "Santosh Mitra Square,Bowbazar,Santosh Mitra Square, Lebutala, Bowbazar, Kolkata,22.5694,88.3683,Oct 18 - Oct 24 2026,04:00,02:00,wheelchair,https://facebook.com/santoshmitrasquare,Designated parking at Bowbazar High School,Central / MG Road Metro Gate 2 (6 mins),Approach via Amherst Street,Las Vegas Sphere Theme,Spectacular illuminated sphere with laser light show.\n"
        "College Square,College Street,College Square, 53 College St, Kolkata,22.5744,88.3639,Oct 18 - Oct 24 2026,05:00,01:30,pram_friendly,https://facebook.com/collegesquarepuja,Medical College lane parking,MG Road Metro Gate 1,Follow one-way pedestrian walkway around lake,Traditional Light Reflection on Lake,Magnificent water reflection lighting on historic lake.\n"
    )
    return Response(
        content=sample_csv,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pandals_import_template.csv"},
    )
