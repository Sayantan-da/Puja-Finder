from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pandal_id = Column(Integer, ForeignKey("pandals.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="favorites")
    pandal = relationship("Pandal", back_populates="favorites")

    __table_args__ = (UniqueConstraint("user_id", "pandal_id", name="unique_favorite"),)
