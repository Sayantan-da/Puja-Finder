from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, func

from app.database import Base


class GroupTrip(Base):
    __tablename__ = "group_trips"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String(64), unique=True, index=True, nullable=False)
    group_name = Column(String(200), nullable=False)
    join_code = Column(String(12), unique=True, index=True, nullable=False)
    invite_token = Column(String(64), unique=True, index=True, nullable=True)
    created_by = Column(String(64), nullable=False)  # Host user_id
    status = Column(String(20), default="ACTIVE", nullable=False)  # UPCOMING, ACTIVE, COMPLETED, CANCELLED
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    max_members = Column(Integer, default=10, nullable=False)
    is_private = Column(Boolean, default=True, nullable=False)

    # Route and Navigation info
    destination = Column(JSON, default=dict, nullable=False)
    route_pandals = Column(JSON, default=list, nullable=False)
    checkpoints = Column(JSON, default=list, nullable=False)
    meet_here_pin = Column(JSON, default=dict, nullable=True)

    # Real-time state
    members = Column(JSON, default=dict, nullable=False)
    messages = Column(JSON, default=list, nullable=False)
    alerts = Column(JSON, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
