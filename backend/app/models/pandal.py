from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class Pandal(Base):
    __tablename__ = "pandals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    address = Column(String(300), nullable=False)
    locality = Column(String(120), index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    theme = Column(String(200))
    description = Column(String(1000))
    opening_time = Column(String(10))   # e.g. "04:00"
    closing_time = Column(String(10))   # e.g. "23:00"
    dates = Column(String(100), nullable=True)  # e.g. "Oct 18 - Oct 24, 2026"
    accessibility_tags = Column(String(250), nullable=True)  # e.g. "wheelchair,pram_friendly,elderly_seating"
    official_links = Column(String(500), nullable=True)  # e.g. "https://fb.com/..."
    
    # Transit & Navigation Info
    parking_info = Column(String(300), nullable=True)  # e.g. "Paid parking available at playground 200m away"
    metro_info = Column(String(300), nullable=True)    # e.g. "MG Road Metro Gate 2 (5 mins walk)"
    route_tips = Column(String(500), nullable=True)    # e.g. "Approach via Chittaranjan Ave"

    # Publishing & Soft Deletion Lifecycle
    is_verified_by_admin = Column(Boolean, default=False, nullable=False, index=True)
    is_published = Column(Boolean, default=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)  # Soft delete
    deleted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    reviews = relationship("Review", back_populates="pandal", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="pandal", cascade="all, delete-orphan")
    crowd_reports = relationship("CrowdReport", back_populates="pandal", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="pandal", cascade="all, delete-orphan")
