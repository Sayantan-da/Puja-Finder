from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class EventType(str, enum.Enum):
    PUJA = "PUJA"
    CULTURAL = "CULTURAL"
    MUSIC = "MUSIC"
    FOOD = "FOOD"
    PROCESSION = "PROCESSION"
    SPECIAL = "SPECIAL"
    OTHER = "OTHER"


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    pandal_id = Column(Integer, ForeignKey("pandals.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(1000))
    event_date = Column(DateTime, nullable=False, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    event_type = Column(Enum(EventType), default=EventType.OTHER)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    pandal = relationship("Pandal", back_populates="events")
