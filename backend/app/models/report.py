from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime
from app.database import Base
import enum

class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    pandal_id = Column(Integer, ForeignKey("pandals.id"))
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=True)
    reason = Column(String)
    description = Column(String)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    created_at = Column(DateTime)
