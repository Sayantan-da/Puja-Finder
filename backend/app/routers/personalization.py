"""Personalization endpoints: badges, itineraries, preferences, recommendations."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.dependencies.auth import get_current_user
from app.models.itinerary import Itinerary
from app.models.user import User
from app.services import recommendations as rec

router = APIRouter(prefix="/api", tags=["personalization"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Schemas ----------
class ItineraryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    pandal_ids: list[int] = Field(default_factory=list)
    start_date: str | None = None
    reminder_time: str | None = None
    is_reminder_enabled: bool = False
    is_public: bool = False


class ItineraryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    pandal_ids: list[int] | None = None
    start_date: str | None = None
    reminder_time: str | None = None
    is_reminder_enabled: bool | None = None
    is_public: bool | None = None


class PreferencesUpdate(BaseModel):
    dark_mode: bool | None = None
    preferred_localities: list[str] | None = None
    preferred_themes: list[str] | None = None
    max_travel_distance_km: int | None = Field(None, ge=1, le=100)
    receive_notifications: bool | None = None


# ---------- Badges ----------
@router.get("/badges")
def get_my_badges(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current user's badges with progress."""
    return rec.get_user_badges(db, user.id)


@router.post("/badges/evaluate")
def evaluate_my_badges(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Re-evaluate and award any newly earned badges."""
    return rec.evaluate_badges(db, user.id)


# ---------- Recommendations ----------
@router.get("/recommendations")
def get_recommendations(
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get personalized pandal recommendations for the current user."""
    limit = max(1, min(limit, 50))
    return rec.get_recommendations(db, user.id, limit)


# ---------- Preferences ----------
@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = rec.get_or_create_preferences(db, user.id)
    return {
        "dark_mode": pref.dark_mode,
        "preferred_localities": pref.preferred_localities or [],
        "preferred_themes": pref.preferred_themes or [],
        "max_travel_distance_km": pref.max_travel_distance_km,
        "receive_notifications": pref.receive_notifications,
    }


@router.put("/preferences")
def update_preferences(
    payload: PreferencesUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = rec.update_preferences(
        db,
        user.id,
        dark_mode=payload.dark_mode,
        preferred_localities=payload.preferred_localities,
        preferred_themes=payload.preferred_themes,
        max_travel_distance_km=payload.max_travel_distance_km,
        receive_notifications=payload.receive_notifications,
    )
    return {
        "dark_mode": pref.dark_mode,
        "preferred_localities": pref.preferred_localities or [],
        "preferred_themes": pref.preferred_themes or [],
        "max_travel_distance_km": pref.max_travel_distance_km,
        "receive_notifications": pref.receive_notifications,
    }


# ---------- Itineraries ----------
@router.get("/itineraries")
def list_itineraries(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    itins = db.scalars(
        select(Itinerary).where(Itinerary.user_id == user.id).order_by(Itinerary.created_at.desc())
    ).all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "description": i.description,
            "pandal_ids": i.pandal_ids or [],
            "start_date": i.start_date.isoformat() if i.start_date else None,
            "reminder_time": i.reminder_time,
            "is_reminder_enabled": i.is_reminder_enabled,
            "is_public": i.is_public,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in itins
    ]


@router.post("/itineraries")
def create_itinerary(
    payload: ItineraryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    itin = Itinerary(
        user_id=user.id,
        name=payload.name,
        description=payload.description,
        pandal_ids=payload.pandal_ids,
        start_date=payload.start_date,
        reminder_time=payload.reminder_time,
        is_reminder_enabled=payload.is_reminder_enabled,
        is_public=payload.is_public,
    )
    db.add(itin)
    db.commit()
    db.refresh(itin)
    return {
        "id": itin.id,
        "name": itin.name,
        "description": itin.description,
        "pandal_ids": itin.pandal_ids or [],
        "start_date": itin.start_date.isoformat() if itin.start_date else None,
        "reminder_time": itin.reminder_time,
        "is_reminder_enabled": itin.is_reminder_enabled,
        "is_public": itin.is_public,
        "created_at": itin.created_at.isoformat() if itin.created_at else None,
    }


@router.get("/itineraries/{itinerary_id}")
def get_itinerary(
    itinerary_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    itin = db.scalar(
        select(Itinerary).where(
            Itinerary.id == itinerary_id,
            (Itinerary.user_id == user.id) | (Itinerary.is_public.is_(True)),
        )
    )
    if itin is None:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return {
        "id": itin.id,
        "name": itin.name,
        "description": itin.description,
        "pandal_ids": itin.pandal_ids or [],
        "start_date": itin.start_date.isoformat() if itin.start_date else None,
        "reminder_time": itin.reminder_time,
        "is_reminder_enabled": itin.is_reminder_enabled,
        "is_public": itin.is_public,
        "created_at": itin.created_at.isoformat() if itin.created_at else None,
    }


@router.put("/itineraries/{itinerary_id}")
def update_itinerary(
    itinerary_id: int,
    payload: ItineraryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    itin = db.scalar(
        select(Itinerary).where(Itinerary.id == itinerary_id, Itinerary.user_id == user.id)
    )
    if itin is None:
        raise HTTPException(status_code=404, detail="Itinerary not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(itin, field, value)

    db.commit()
    db.refresh(itin)
    return {
        "id": itin.id,
        "name": itin.name,
        "description": itin.description,
        "pandal_ids": itin.pandal_ids or [],
        "start_date": itin.start_date.isoformat() if itin.start_date else None,
        "reminder_time": itin.reminder_time,
        "is_reminder_enabled": itin.is_reminder_enabled,
        "is_public": itin.is_public,
        "created_at": itin.created_at.isoformat() if itin.created_at else None,
    }


@router.delete("/itineraries/{itinerary_id}")
def delete_itinerary(
    itinerary_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    itin = db.scalar(
        select(Itinerary).where(Itinerary.id == itinerary_id, Itinerary.user_id == user.id)
    )
    if itin is None:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    db.delete(itin)
    db.commit()
    return {"ok": True}