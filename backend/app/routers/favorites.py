from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.favorite import Favorite
from app.models.pandal import Pandal
from app.models.user import User
from app.routers.pandals import _with_aggregates
from app.schemas.pandal import PandalOut

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])


@router.get("", response_model=list[PandalOut])
def list_favorites(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List the current user's favourite pandals (with ratings & crowd info)."""
    favs = db.query(Favorite).filter(Favorite.user_id == user.id).all()
    pandals = [p for p in (db.get(Pandal, f.pandal_id) for f in favs) if p is not None]
    return _with_aggregates(db, pandals)


@router.post("/{pandal_id}")
def toggle_favorite(
    request: Request,
    pandal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add/remove a pandal from favourites. Returns the new state."""
    if not db.get(Pandal, pandal_id):
        raise HTTPException(status_code=404, detail="Pandal not found")

    fav = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.pandal_id == pandal_id)
        .first()
    )
    if fav:
        db.delete(fav)
        db.commit()
        return {"pandal_id": pandal_id, "favorited": False}
    db.add(Favorite(user_id=user.id, pandal_id=pandal_id))
    db.commit()
    return {"pandal_id": pandal_id, "favorited": True}
