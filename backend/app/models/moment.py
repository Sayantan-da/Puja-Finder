from sqlalchemy import Boolean, Column, CheckConstraint, Index, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class Moment(Base):
    """A photo shared by a user — a 'special moment' from the pujos."""

    __tablename__ = "moments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_url = Column(String(300), nullable=False)
    caption = Column(String(300), nullable=True)
    is_approved = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")

    __table_args__ = (
        Index("ix_moments_created", "created_at"),
    )


class MomentVote(Base):
    """A user's 1–5 star rating on a moment (one vote per user per moment)."""

    __tablename__ = "moment_votes"

    id = Column(Integer, primary_key=True, index=True)
    moment_id = Column(Integer, ForeignKey("moments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("moment_id", "user_id", name="unique_moment_vote"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="moment_rating_range"),
    )
