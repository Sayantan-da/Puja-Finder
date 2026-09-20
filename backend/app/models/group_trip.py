from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, func

from app.database import Base


class GroupTrip(Base):
    __tablename__ = "group_trips"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String(64), unique=True, index=True, nullable=False)
    group_name = Column(String(200), nullable=False)
    join_code = Column(String(12), unique=True, index=True, nullable=False)
    created_by = Column(String(64), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    destination = Column(JSON, default=dict, nullable=False)
    members = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
