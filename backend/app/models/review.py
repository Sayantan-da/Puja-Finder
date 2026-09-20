from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pandal_id = Column(Integer, ForeignKey("pandals.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String(1000))
    is_approved = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="reviews")
    pandal = relationship("Pandal", back_populates="reviews")

    __table_args__ = (
        UniqueConstraint("user_id", "pandal_id", name="unique_user_pandal_review"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="rating_range"),
        # Hot path: avg/count per pandal + recent-reviews listing
        Index("ix_reviews_pandal_created", "pandal_id", "created_at"),
    )
