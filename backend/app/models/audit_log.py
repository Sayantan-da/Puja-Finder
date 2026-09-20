from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(60), nullable=False, index=True)  # e.g. PANDAL_CREATE, PANDAL_EDIT, PANDAL_PUBLISH, REVIEW_MODERATE, USER_BLOCK
    entity_type = Column(String(60), nullable=False)        # e.g. pandal, review, moment, user
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)                  # JSON / human summary of changes
    ip_address = Column(String(60), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
