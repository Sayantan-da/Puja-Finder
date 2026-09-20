from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class Role(str, enum.Enum):
    USER = "USER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(30), unique=True, index=True, nullable=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(Enum(Role), default=Role.USER, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Security & MFA Attributes (OWASP A07)
    is_active = Column(Boolean, default=True, nullable=False)  # False = Blocked / Inactive
    is_mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(64), nullable=True)  # Base32 TOTP secret key
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)

    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    crowd_reports = relationship("CrowdReport", back_populates="user", cascade="all, delete-orphan")
    badges_earned = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")
    itineraries = relationship("Itinerary", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan", uselist=False)
