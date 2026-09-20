from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import Role, User


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Strictly require ADMIN role."""
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    """Allow ADMIN or MODERATOR role."""
    if current_user.role not in (Role.ADMIN, Role.MODERATOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff (Admin or Moderator) access required",
        )
    return current_user
