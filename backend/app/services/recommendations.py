"""Personalized pandal recommendation engine.

Uses a simple weighted scoring approach combining:
- User preferences (localities, themes, max travel distance)
- User history (favorites, reviews, crowd reports, itineraries)
- Global popularity signals (ratings, crowd levels, recent activity)
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.badge import DEFAULT_BADGES
from app.models.favorite import Favorite
from app.models.itinerary import Itinerary, UserPreference
from app.models.pandal import Pandal
from app.models.review import Review
from app.models.user import User


def get_or_create_preferences(db: Session, user_id: int) -> UserPreference:
    pref = db.scalar(select(UserPreference).where(UserPreference.user_id == user_id))
    if pref is None:
        pref = UserPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def update_preferences(
    db: Session,
    user_id: int,
    dark_mode: bool | None = None,
    preferred_localities: list[str] | None = None,
    preferred_themes: list[str] | None = None,
    max_travel_distance_km: int | None = None,
    receive_notifications: bool | None = None,
) -> UserPreference:
    pref = get_or_create_preferences(db, user_id)
    if dark_mode is not None:
        pref.dark_mode = dark_mode
    if preferred_localities is not None:
        pref.preferred_localities = preferred_localities
    if preferred_themes is not None:
        pref.preferred_themes = preferred_themes
    if max_travel_distance_km is not None:
        pref.max_travel_distance_km = max_travel_distance_km
    if receive_notifications is not None:
        pref.receive_notifications = receive_notifications
    db.commit()
    db.refresh(pref)
    return pref


def _compute_progress(db: Session, user_id: int) -> dict[str, int]:
    """Compute the raw counts used to evaluate badge criteria."""
    pandals_visited = db.scalar(
        select(func.count(func.distinct(Review.pandal_id))).where(Review.user_id == user_id)
    ) or 0
    # Distinct localities from reviews
    localities = db.execute(
        select(func.count(func.distinct(Pandal.locality)))
        .join(Review, Review.pandal_id == Pandal.id)
        .where(Review.user_id == user_id)
    ).scalar() or 0
    # Distinct themes from reviews
    themes = db.execute(
        select(func.count(func.distinct(Pandal.theme)))
        .join(Review, Review.pandal_id == Pandal.id)
        .where(Review.user_id == user_id)
    ).scalar() or 0

    reviews_written = db.scalar(
        select(func.count(Review.id)).where(Review.user_id == user_id)
    ) or 0
    favorites = db.scalar(
        select(func.count(Favorite.id)).where(Favorite.user_id == user_id)
    ) or 0
    crowd_reports = db.scalar(
        select(func.count()).select_from(Review.__table__)  # placeholder, replaced below
    )

    from app.models.crowd_report import CrowdReport

    crowd_reports = db.scalar(
        select(func.count(CrowdReport.id)).where(CrowdReport.user_id == user_id)
    ) or 0

    from app.models.moment import Moment

    moments_shared = db.scalar(
        select(func.count(Moment.id)).where(Moment.user_id == user_id)
    ) or 0

    return {
        "pandals_visited": pandals_visited,
        "localities_visited": localities,
        "themes_explored": themes,
        "reviews_written": reviews_written,
        "favorites": favorites,
        "crowd_reports": crowd_reports,
        "moments_shared": moments_shared,
        "early_visits": 0,  # Would need timestamp analysis on visits
        "night_visits": 0,
    }


def evaluate_badges(db: Session, user_id: int) -> list[dict]:
    """Evaluate all badge criteria for a user and award new badges."""
    progress = _compute_progress(db, user_id)

    from app.models.badge import Badge, UserBadge

    awarded = db.scalars(
        select(Badge).where(Badge.is_active.is_(True))
    ).all()

    earned_badges = []
    for badge in awarded:
        user_badge = db.scalar(
            select(UserBadge).where(
                UserBadge.user_id == user_id,
                UserBadge.badge_id == badge.id,
            )
        )
        current = progress.get(badge.criteria_type, 0)
        is_earned = current >= badge.criteria_value

        if user_badge is None:
            user_badge = UserBadge(
                user_id=user_id,
                badge_id=badge.id,
                progress=current,
                earned_at=func.now() if is_earned else None,
            )
            db.add(user_badge)
        else:
            user_badge.progress = current
            if is_earned and user_badge.earned_at is None:
                user_badge.earned_at = func.now()

        earned_badges.append({
            "id": badge.id,
            "name": badge.name,
            "description": badge.description,
            "icon": badge.icon,
            "category": badge.category.value,
            "progress": current,
            "criteria_value": badge.criteria_value,
            "earned": is_earned,
            "earned_at": user_badge.earned_at.isoformat() if user_badge.earned_at else None,
        })

    db.commit()
    return earned_badges


def get_user_badges(db: Session, user_id: int) -> list[dict]:
    """Get the user's badge status with progress."""
    from app.models.badge import Badge, UserBadge

    badges = db.execute(
        select(Badge, UserBadge)
        .outerjoin(UserBadge, (UserBadge.badge_id == Badge.id) & (UserBadge.user_id == user_id))
        .where(Badge.is_active.is_(True))
        .order_by(Badge.category, Badge.criteria_value)
    ).all()

    result = []
    for badge, user_badge in badges:
        progress = user_badge.progress if user_badge else 0
        earned = (user_badge is not None) and (user_badge.earned_at is not None)
        result.append({
            "id": badge.id,
            "name": badge.name,
            "description": badge.description,
            "icon": badge.icon,
            "category": badge.category.value,
            "progress": progress,
            "criteria_value": badge.criteria_value,
            "earned": earned,
            "earned_at": user_badge.earned_at.isoformat() if user_badge and user_badge.earned_at else None,
        })
    return result


def get_recommendations(db: Session, user_id: int, limit: int = 10) -> list[dict]:
    """Generate personalized pandal recommendations."""
    pref = get_or_create_preferences(db, user_id)
    fav_ids = set(db.scalars(select(Favorite.pandal_id).where(Favorite.user_id == user_id)).all())
    reviewed_ids = set(db.scalars(select(Review.pandal_id).where(Review.user_id == user_id)).all())

    # Get all pandals with their aggregate signals
    pandals = db.execute(
        select(
            Pandal,
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("review_count"),
        )
        .outerjoin(Review, Review.pandal_id == Pandal.id)
        .group_by(Pandal.id)
    ).all()

    scored = []
    for pandal, avg_rating, review_count in pandals:
        if pandal.id in fav_ids or pandal.id in reviewed_ids:
            continue  # Skip already-known pandals

        score = 0.0

        # Locality match (strongest signal)
        if pref.preferred_localities and pandal.locality:
            if pandal.locality in pref.preferred_localities:
                score += 30

        # Theme match
        if pref.preferred_themes and pandal.theme:
            theme_lower = pandal.theme.lower()
            if any(t.lower() in theme_lower for t in pref.preferred_themes):
                score += 20

        # Popularity
        if review_count > 0:
            score += min(review_count, 50) * 0.3  # up to 15 points
        if avg_rating:
            score += float(avg_rating) * 5  # up to 25 points

        # Open now bonus
        if pandal.open_now:
            score += 10

        # Slight freshness bonus for recent crowd reports
        if pandal.crowd_updated_at:
            score += 5

        scored.append((score, pandal))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "id": p.id,
            "name": p.name,
            "locality": p.locality,
            "theme": p.theme,
            "address": p.address,
            "avg_rating": float(avg_rating) if avg_rating else None,
            "review_count": review_count,
            "crowd_level": p.crowd_level,
            "open_now": p.open_now,
            "cover_image": p.cover_image,
            "score": round(s, 1),
            "distance_km": p.distance_km,
        }
        for s, p in scored[:limit]
    ]


def seed_default_badges(db: Session) -> None:
    """Insert default badges if they don't exist."""
    from app.models.badge import Badge

    existing = set(db.scalars(select(Badge.name)).all())
    for b in DEFAULT_BADGES:
        if b["name"] not in existing:
            db.add(Badge(**b))
    db.commit()