from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.admin import require_admin
from app.models.event import Event
from app.models.pandal import Pandal
from app.models.user import User
from app.schemas.event import EventCreate, EventOut

router = APIRouter(tags=["Events"])


@router.get("/api/pandals/{pandal_id}/events", response_model=list[EventOut])
def list_events(pandal_id: int, db: Session = Depends(get_db)):
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")
    return (
        db.query(Event)
        .filter(Event.pandal_id == pandal_id)
        .order_by(Event.event_date)
        .all()
    )


@router.post(
    "/api/pandals/{pandal_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    pandal_id: int,
    data: EventCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create an event for a pandal (ADMIN only)."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")
    event = Event(pandal_id=pandal_id, **data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
