from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    pandal_ids = Column(JSON, default=list, nullable=False)  # Ordered list of pandal IDs
    start_date = Column(DateTime, nullable=True)
    reminder_time = Column(String(10), nullable=True)  # e.g., "18:00"
    is_reminder_enabled = Column(Boolean, default=False, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="itineraries")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    dark_mode = Column(Boolean, default=False, nullable=False)
    preferred_localities = Column(JSON, default=list, nullable=False)  # List of localities
    preferred_themes = Column(JSON, default=list, nullable=False)  # List of theme keywords
    max_travel_distance_km = Column(Integer, default=10, nullable=False)
    receive_notifications = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="preferences")