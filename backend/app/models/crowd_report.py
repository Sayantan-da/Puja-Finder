from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class CrowdLevel(str, enum.Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class CrowdReport(Base):
    __tablename__ = "crowd_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pandal_id = Column(Integer, ForeignKey("pandals.id"), nullable=False)
    crowd_level = Column(Enum(CrowdLevel), nullable=False)
    waiting_time_minutes = Column(Integer, nullable=True)
    approach_traffic = Column(String(30), nullable=True)  # CLEAR, CONGESTED, PEDESTRIAN_ONLY
    barricade_distance = Column(String(30), nullable=True)  # DIRECT, MODERATE, LONG_CIRCUIT
    comfort_tags = Column(String(255), nullable=True)  # comma-separated tags
    comment = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="crowd_reports")
    pandal = relationship("Pandal", back_populates="crowd_reports")

    __table_args__ = (
        # Hot path: the crowd estimation only ever reads the last-30-min window
        Index("ix_crowd_reports_pandal_created", "pandal_id", "created_at"),
    )
