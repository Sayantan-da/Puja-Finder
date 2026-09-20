from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.admin import require_admin
from app.dependencies.auth import get_current_user_optional
from app.models.crowd_report import CrowdLevel, CrowdReport
from app.models.image import Image
from app.models.pandal import Pandal
from app.models.report import Report, ReportStatus
from app.models.review import Review
from app.models.user import User
from app.schemas.pandal import PandalCreate, PandalFlagRequest, PandalOut
from app.services.crowd_estimation_service import (
    CROWD_ESTIMATION_WINDOW_MINUTES,
    aggregate_attributes,
    calculate_crowd_trend,
    estimate_crowd,
    generate_hourly_pattern,
)
from app.utils.geo import haversine_km

router = APIRouter(prefix="/api/pandals", tags=["Pandals"])

_IST = ZoneInfo("Asia/Kolkata")
_PANDAL_FIELDS = (
    "id", "name", "address", "locality", "latitude", "longitude",
    "theme", "description", "opening_time", "closing_time",
    "dates", "accessibility_tags", "official_links",
    "parking_info", "metro_info", "route_tips",
    "is_verified_by_admin", "is_published", "created_at", "updated_at",
)


def _is_open_now(opening: str | None, closing: str | None) -> bool | None:
    """Is the pandal open at this moment in Asia/Kolkata local time?

    Handles overnight closing times (e.g. 04:00 → 00:00)."""
    if not opening or not closing:
        return None
    try:
        o_h, o_m = map(int, opening.split(":"))
        c_h, c_m = map(int, closing.split(":"))
    except (ValueError, AttributeError):
        return None
    try:
        now = datetime.now(_IST)
    except Exception:  # missing tz database on some systems
        return None

    o = o_h * 60 + o_m
    c = c_h * 60 + c_m
    n = now.hour * 60 + now.minute
    if c <= o:  # overnight window (e.g. 16:00 → 00:00)
        c += 24 * 60
        if n < o:
            n += 24 * 60
    return o <= n < c


def _age_minutes(report: CrowdReport, now_utc: datetime | None = None) -> float:
    if report.created_at is None:
        return float("inf")
    created = report.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    now = now_utc or datetime.now(timezone.utc)
    return (now - created).total_seconds() / 60.0


def _crowd_estimates(db: Session, pandal_ids: list[int]) -> dict[int, dict]:
    """Calculate current live crowd estimate per pandal.

    Uses exponential-decay weighting on reports within CROWD_ESTIMATION_WINDOW_MINUTES.
    Requires >= 3 distinct users for HIGH confidence.
    """
    if not pandal_ids:
        return {}

    now_utc = datetime.now(timezone.utc)
    window_start = datetime.fromtimestamp(
        now_utc.timestamp() - CROWD_ESTIMATION_WINDOW_MINUTES * 60,
        tz=timezone.utc,
    ).replace(tzinfo=None)  # SQLite/Postgres naive comparison

    fresh_reports = (
        db.query(CrowdReport)
        .filter(
            CrowdReport.pandal_id.in_(pandal_ids),
            CrowdReport.created_at >= window_start,
        )
        .order_by(CrowdReport.created_at.desc())
        .all()
    )

    grouped: dict[int, list[CrowdReport]] = {}
    for r in fresh_reports:
        grouped.setdefault(r.pandal_id, []).append(r)

    # For pandals with NO reports in the window, pull their single latest report
    missing_ids = [pid for pid in pandal_ids if pid not in grouped]
    fallback: dict[int, CrowdReport] = {}
    if missing_ids:
        latest_sq = (
            db.query(
                CrowdReport.pandal_id,
                sa_func.max(CrowdReport.created_at).label("latest"),
            )
            .filter(CrowdReport.pandal_id.in_(missing_ids))
            .group_by(CrowdReport.pandal_id)
            .subquery()
        )
        for r in (
            db.query(CrowdReport)
            .join(
                latest_sq,
                (CrowdReport.pandal_id == latest_sq.c.pandal_id)
                & (CrowdReport.created_at == latest_sq.c.latest),
            )
            .all()
        ):
            fallback[r.pandal_id] = r

    result: dict[int, dict] = {}
    for pandal_id, reps in grouped.items():
        payload = [
            {
                "user_id": r.user_id,
                "crowd_level": r.crowd_level.value,
                "waiting_time_minutes": r.waiting_time_minutes,
                "age_minutes": _age_minutes(r, now_utc),
                "approach_traffic": r.approach_traffic,
                "barricade_distance": r.barricade_distance,
                "comfort_tags": r.comfort_tags,
            }
            for r in reps
        ]
        level, wait, confidence, is_stale, distinct_users, confidence_label = estimate_crowd(payload)
        as_of = max((r.created_at for r in reps if r.created_at), default=None)
        trend = calculate_crowd_trend(payload)
        attrs = aggregate_attributes(payload)
        hourly = generate_hourly_pattern(pandal_id, current_level=level)

        result[pandal_id] = {
            "crowd_level": CrowdLevel(level),
            "waiting_time_minutes": wait,
            "crowd_updated_at": as_of,
            "confidence": confidence,
            "confidence_label": confidence_label,
            "fresh_count": len(reps),
            "distinct_reporters_count": distinct_users,
            "is_stale": is_stale,
            "crowd_trend": trend,
            "approach_traffic": attrs["approach_traffic"],
            "barricade_distance": attrs["barricade_distance"],
            "comfort_tags": attrs["comfort_tags"],
            "hourly_pattern": hourly,
        }
    for pandal_id, r in fallback.items():
        fallback_tags = []
        if r.comfort_tags:
            fallback_tags = [t.strip() for t in r.comfort_tags.split(",") if t.strip()]
        result[pandal_id] = {
            "crowd_level": r.crowd_level,
            "waiting_time_minutes": r.waiting_time_minutes,
            "crowd_updated_at": r.created_at,
            "confidence": 0,
            "confidence_label": "STALE",
            "fresh_count": 0,
            "distinct_reporters_count": 0,
            "is_stale": True,
            "crowd_trend": "STEADY",
            "approach_traffic": r.approach_traffic,
            "barricade_distance": r.barricade_distance,
            "comfort_tags": fallback_tags,
            "hourly_pattern": generate_hourly_pattern(pandal_id, current_level=r.crowd_level.value if r.crowd_level else None),
        }
    return result


def _with_aggregates(
    db: Session,
    pandals: list[Pandal],
    distances: dict[int, float] | None = None,
) -> list[PandalOut]:
    """Attach rating, review count, crowd estimate, cover photo and open-now flag."""
    ids = [p.id for p in pandals]
    result: dict[int, dict] = {}

    if ids:
        rating_rows = (
            db.query(
                Review.pandal_id,
                sa_func.avg(Review.rating).label("avg_r"),
                sa_func.count(Review.id).label("cnt_r"),
            )
            .filter(Review.pandal_id.in_(ids))
            .group_by(Review.pandal_id)
            .all()
        )
        for pid, avg_r, cnt_r in rating_rows:
            result[pid] = {
                "avg_rating": round(float(avg_r), 1) if avg_r is not None else None,
                "review_count": int(cnt_r),
            }

        crowd_data = _crowd_estimates(db, ids)
        for pid, cdata in crowd_data.items():
            result.setdefault(pid, {}).update(cdata)

        image_rows = (
            db.query(Image)
            .filter(Image.pandal_id.in_(ids))
            .order_by(Image.id)
            .all()
        )
        for img in image_rows:
            result.setdefault(img.pandal_id, {}).setdefault("cover_image", img.image_url)

    out = []
    for p in pandals:
        agg = result.get(p.id, {})
        hourly = agg.get("hourly_pattern") or generate_hourly_pattern(p.id)
        out.append(
            PandalOut(
                **{c: getattr(p, c, None) for c in _PANDAL_FIELDS},
                avg_rating=agg.get("avg_rating"),
                review_count=agg.get("review_count", 0),
                crowd_level=agg.get("crowd_level"),
                waiting_time_minutes=agg.get("waiting_time_minutes"),
                crowd_updated_at=(
                    agg["crowd_updated_at"].replace(tzinfo=timezone.utc)
                    if agg.get("crowd_updated_at") is not None and getattr(agg["crowd_updated_at"], "tzinfo", None) is None
                    else agg.get("crowd_updated_at")
                ),
                confidence=agg.get("confidence"),
                confidence_label=agg.get("confidence_label"),
                fresh_count=agg.get("fresh_count", 0),
                distinct_reporters_count=agg.get("distinct_reporters_count", 0),
                is_stale=agg.get("is_stale", False),
                crowd_trend=agg.get("crowd_trend"),
                approach_traffic=agg.get("approach_traffic"),
                barricade_distance=agg.get("barricade_distance"),
                comfort_tags=agg.get("comfort_tags") or [],
                hourly_pattern=hourly,
                open_now=_is_open_now(p.opening_time, p.closing_time),
                cover_image=agg.get("cover_image"),
                distance_km=distances.get(p.id) if distances else None,
            )
        )
    return out


@router.get("", response_model=list[PandalOut])
def list_pandals(
    search: str | None = Query(None, description="Search name/locality/theme"),
    locality: str | None = Query(None),
    limit: int = Query(300, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List pandals with optional search and locality filters."""
    query = db.query(Pandal)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            Pandal.name.ilike(s) | Pandal.locality.ilike(s) | Pandal.theme.ilike(s)
        )
    if locality:
        query = query.filter(Pandal.locality.ilike(f"%{locality.strip()}%"))
    pandals = query.order_by(Pandal.id).offset(offset).limit(limit).all()
    return _with_aggregates(db, pandals)


@router.get("/localities", response_model=list[str])
def list_localities(db: Session = Depends(get_db)):
    """Distinct non-empty localities."""
    rows = (
        db.query(Pandal.locality)
        .filter(Pandal.locality.isnot(None), Pandal.locality != "")
        .distinct()
        .order_by(Pandal.locality)
        .all()
    )
    return [r[0] for r in rows if r[0]]


@router.get("/nearby", response_model=list[PandalOut])
def nearby_pandals(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=50.0),
    db: Session = Depends(get_db),
):
    """Pandals sorted by distance from the user's location."""
    pandals = db.query(Pandal).all()
    scored = [
        (p, haversine_km(lat, lng, p.latitude, p.longitude))
        for p in pandals
        if p.latitude is not None and p.longitude is not None
    ]
    matched = [(p, d) for p, d in scored if d <= radius_km]
    matched.sort(key=lambda t: t[1])  # nearest first
    distances = {p.id: round(d, 3) for p, d in matched}
    return _with_aggregates(db, [p for p, _ in matched], distances=distances)


@router.get("/{pandal_id}", response_model=PandalOut)
def get_pandal(pandal_id: int, db: Session = Depends(get_db)):
    pandal = db.get(Pandal, pandal_id)
    if not pandal:
        raise HTTPException(status_code=404, detail="Pandal not found")
    return _with_aggregates(db, [pandal])[0]


@router.post("/{pandal_id}/flag", status_code=status.HTTP_201_CREATED)
def flag_pandal_inaccuracy(
    pandal_id: int,
    data: PandalFlagRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Allow users to flag incorrect pandal data (wrong hours, location, theme, closed gates)."""
    pandal = db.get(Pandal, pandal_id)
    if not pandal:
        raise HTTPException(status_code=404, detail="Pandal not found")

    desc = data.description
    if data.suggested_correction:
        desc = f"{desc}\nCorrection suggestion: {data.suggested_correction}".strip()

    report = Report(
        user_id=user.id if user else None,
        pandal_id=pandal_id,
        reason=f"INACCURACY: {data.reason}",
        description=desc,
        status=ReportStatus.PENDING,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(report)
    db.commit()
    return {"message": "Thank you for helping keep Kolkata's pandal guide accurate. Our team will review this report."}


@router.post("", response_model=PandalOut, status_code=status.HTTP_201_CREATED)
def create_pandal(
    data: PandalCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a pandal (ADMIN only)."""
    pandal = Pandal(**data.model_dump(), is_verified_by_admin=True)
    db.add(pandal)
    db.commit()
    db.refresh(pandal)
    return _with_aggregates(db, [pandal])[0]


@router.delete("/{pandal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pandal(
    pandal_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a pandal (ADMIN only)."""
    pandal = db.get(Pandal, pandal_id)
    if not pandal:
        raise HTTPException(status_code=404, detail="Pandal not found")
    db.delete(pandal)
    db.commit()
