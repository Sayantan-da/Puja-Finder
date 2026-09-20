from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class BadgeCategory(str, enum.Enum):
    EXPLORATION = "exploration"
    CONTRIBUTION = "contribution"
    SOCIAL = "social"
    STREAK = "streak"
    SPECIAL = "special"


class Badge(Base):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String(50), nullable=False)  # Emoji or icon class
    category = Column(Enum(BadgeCategory), nullable=False)
    criteria_type = Column(String(50), nullable=False)  # e.g., "pandals_visited", "reviews_written"
    criteria_value = Column(Integer, nullable=False)  # Threshold to earn badge
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_id = Column(Integer, ForeignKey("badges.id"), nullable=False)
    progress = Column(Integer, default=0, nullable=False)  # Current progress toward badge
    earned_at = Column(DateTime, nullable=True)  # When badge was earned
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="badges_earned")
    badge = relationship("Badge", back_populates="user_badges")


DEFAULT_BADGES = [
    {"name": "First Visit", "description": "Visited your first pandal", "icon": "🎯", "category": BadgeCategory.EXPLORATION, "criteria_type": "pandals_visited", "criteria_value": 1},
    {"name": "Pandal Hopper", "description": "Visited 5 different pandals", "icon": "🦘", "category": BadgeCategory.EXPLORATION, "criteria_type": "pandals_visited", "criteria_value": 5},
    {"name": "Pandal Explorer", "description": "Visited 15 different pandals", "icon": "🧭", "category": BadgeCategory.EXPLORATION, "criteria_type": "pandals_visited", "criteria_value": 15},
    {"name": "Theme Explorer", "description": "Visited pandals with 3 different themes", "icon": "🎨", "category": BadgeCategory.EXPLORATION, "criteria_type": "themes_explored", "criteria_value": 3},
    {"name": "Review Starter", "description": "Wrote your first review", "icon": "✍️", "category": BadgeCategory.CONTRIBUTION, "criteria_type": "reviews_written", "criteria_value": 1},
    {"name": "Review Master", "description": "Wrote 10 reviews", "icon": "⭐", "category": BadgeCategory.CONTRIBUTION, "criteria_type": "reviews_written", "criteria_value": 10},
    {"name": "Moment Maker", "description": "Shared 5 moments", "icon": "📸", "category": BadgeCategory.CONTRIBUTION, "criteria_type": "moments_shared", "criteria_value": 5},
    {"name": "Crowd Scout", "description": "Posted 20 crowd reports", "icon": "📡", "category": BadgeCategory.CONTRIBUTION, "criteria_type": "crowd_reports", "criteria_value": 20},
    {"name": "Favourite Collector", "description": "Have 10 favourites", "icon": "❤️", "category": BadgeCategory.SOCIAL, "criteria_type": "favorites", "criteria_value": 10},
    {"name": "Early Bird", "description": "Visited a pandal before 9 AM", "icon": "🌅", "category": BadgeCategory.STREAK, "criteria_type": "early_visits", "criteria_value": 1},
    {"name": "Night Owl", "description": "Visited a pandal after 9 PM", "icon": "🌙", "category": BadgeCategory.STREAK, "criteria_type": "night_visits", "criteria_value": 1},
    {"name": "Local Expert", "description": "Visited pandals in 5 different localities", "icon": "🗺️", "category": BadgeCategory.EXPLORATION, "criteria_type": "localities_visited", "criteria_value": 5},
]