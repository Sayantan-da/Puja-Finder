import math
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.cache import ttl_cache
from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.crowd_report import CrowdReport
from app.models.pandal import Pandal
from app.models.user import User
from app.realtime import manager
from app.redis_client import get_redis_client
from app.routers.pandals import _age_minutes, _crowd_estimates
from app.schemas.crowd import CrowdReportCreate, CrowdReportOut
from app.services.crowd_estimation_service import CROWD_ESTIMATION_WINDOW_MINUTES

router = APIRouter(tags=["Crowd"])

# In-memory fallback tracking for cooldowns: (user_id, pandal_id) -> timestamp
_inmemory_cooldowns: dict[tuple[int, int], float] = {}


async def _check_and_set_cooldown(user_id: int, pandal_id: int) -> Optional[int]:
    """Check if user is within the crowd report cooldown window.

    Returns remaining seconds if blocked, or None if permitted.
    """
    cooldown_seconds = settings.crowd_report_cooldown_minutes * 60
    if cooldown_seconds <= 0:
        return None

    cooldown_key = f"pujafinder:cooldown:crowd:{user_id}:{pandal_id}"
    redis = await get_redis_client()

    if redis is not None:
        try:
            ttl = await redis.ttl(cooldown_key)
            if ttl > 0:
                return ttl
            # Set cooldown with expiration
            await redis.set(cooldown_key, "1", ex=cooldown_seconds)
            return None
        except Exception:
            pass  # Fall back to in-memory check

    # In-memory cooldown check
    now = time.time()
    last_report_ts = _inmemory_cooldowns.get((user_id, pandal_id))
    if last_report_ts is not None:
        elapsed = now - last_report_ts
        if elapsed < cooldown_seconds:
            return int(cooldown_seconds - elapsed)

    _inmemory_cooldowns[(user_id, pandal_id)] = now
    return None


@router.post(
    "/api/pandals/{pandal_id}/crowd-reports",
    response_model=CrowdReportOut,
    status_code=status.HTTP_201_CREATED,
)
async def report_crowd(
    request: Request,
    pandal_id: int,
    data: CrowdReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Report how crowded a pandal is right now (login required).

    Enforces a 10-15 minute cooldown per user per pandal to prevent spam.
    Broadcasts the new live estimate over Redis Pub/Sub to all instances in real time.
    """
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")

    # Enforce anti-spam cooldown per user per pandal
    remaining_secs = await _check_and_set_cooldown(user.id, pandal_id)
    if remaining_secs is not None:
        remaining_mins = max(1, math.ceil(remaining_secs / 60))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You have already reported crowd status for this pandal recently. Please wait {remaining_mins} more minute(s).",
            headers={"Retry-After": str(remaining_secs)},
        )

    payload_dict = data.model_dump()
    if isinstance(payload_dict.get("comfort_tags"), list):
        payload_dict["comfort_tags"] = ",".join(payload_dict["comfort_tags"]) if payload_dict["comfort_tags"] else None
    report = CrowdReport(user_id=user.id, pandal_id=pandal_id, **payload_dict)
    db.add(report)
    db.commit()
    db.refresh(report)

    # Recompute the live estimate and broadcast it in real time
    pandal = db.get(Pandal, pandal_id)
    estimate = _crowd_estimates(db, [pandal_id]).get(pandal_id, {})
    updated_at = estimate.get("crowd_updated_at")
    if updated_at is not None and updated_at.tzinfo is None:
        from datetime import timezone as _tz

        updated_at = updated_at.replace(tzinfo=_tz.utc)
    now_utc = datetime.now(timezone.utc)
    pandal_reports = (
        db.query(CrowdReport).filter(CrowdReport.pandal_id == pandal_id).all()
    )
    fresh_count = sum(
        1 for r in pandal_reports if _age_minutes(r, now_utc) <= CROWD_ESTIMATION_WINDOW_MINUTES
    )
    level = estimate.get("crowd_level")
    await manager.broadcast_crowd_update(
        pandal_id,
        {
            "type": "crowd_update",
            "pandal_id": pandal_id,
            "pandal_name": pandal.name if pandal else None,
            "crowd_level": level.value if level else data.crowd_level.value,
            "waiting_time_minutes": estimate.get("waiting_time_minutes"),
            "crowd_updated_at": updated_at.isoformat() if updated_at else None,
            "crowd_trend": estimate.get("crowd_trend"),
            "approach_traffic": estimate.get("approach_traffic") or data.approach_traffic,
            "barricade_distance": estimate.get("barricade_distance") or data.barricade_distance,
            "comfort_tags": estimate.get("comfort_tags") or data.comfort_tags,
            "reported": data.crowd_level.value,
            "comment": data.comment,
            "fresh_count": fresh_count,
            "ts": datetime.now(timezone.utc).isoformat(),
        },
    )
    # Bust the cached pandal list so the next REST read is fresh too
    await ttl_cache.invalidate_prefix('/api/pandals')
    return report


@router.get("/api/pandals/{pandal_id}/crowd-reports", response_model=list[CrowdReportOut])
def list_crowd_reports(
    pandal_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Most recent crowd reports for a pandal."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")
    return (
        db.query(CrowdReport)
        .filter(CrowdReport.pandal_id == pandal_id)
        .order_by(CrowdReport.created_at.desc())
        .limit(limit)
        .all()
    )
