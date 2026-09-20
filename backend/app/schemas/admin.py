from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.crowd_report import CrowdLevel
from app.schemas.auth import UserOut


class AdminStatsResponse(BaseModel):
    total_users: int
    total_pandals: int
    active_pandals: int
    total_events: int
    total_reviews: int
    total_crowd_reports: int
    total_moments: int
    pending_reports_count: int


class HourlyCrowdPoint(BaseModel):
    hour: int
    report_count: int
    low_count: int
    moderate_count: int
    high_count: int
    avg_waiting_time_minutes: float | None = None


class PeakHour(BaseModel):
    hour: int
    report_count: int


class TopPandalTrend(BaseModel):
    pandal_id: int
    pandal_name: str
    report_count: int
    avg_waiting_time_minutes: float | None = None
    latest_crowd_level: str | None = None


class AdminAnalyticsResponse(BaseModel):
    hourly_crowd: list[HourlyCrowdPoint]
    peak_hours: list[PeakHour]
    top_pandals: list[TopPandalTrend]


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    pandal_id: int | None = None
    review_id: int | None = None
    reason: str | None = None
    description: str | None = None
    status: str
    created_at: datetime | None = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    user_email: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime | None = None


class PandalAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str
    locality: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    theme: str | None = None
    description: str | None = None
    opening_time: str | None = None
    closing_time: str | None = None
    dates: str | None = None
    accessibility_tags: str | None = None
    official_links: str | None = None
    parking_info: str | None = None
    metro_info: str | None = None
    route_tips: str | None = None
    is_verified_by_admin: bool = False
    is_published: bool = True
    is_active: bool = True
    deleted_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    avg_rating: float | None = None
    review_count: int = 0
    photo_count: int = 0
    crowd_level: CrowdLevel | None = None


class PandalUpdateAdmin(BaseModel):
    name: str | None = None
    address: str | None = None
    locality: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    theme: str | None = None
    description: str | None = None
    opening_time: str | None = None
    closing_time: str | None = None
    dates: str | None = None
    accessibility_tags: str | None = None
    official_links: str | None = None
    parking_info: str | None = None
    metro_info: str | None = None
    route_tips: str | None = None
    is_verified_by_admin: bool | None = None
    is_published: bool | None = None
    is_active: bool | None = None


class ReviewModerationItem(BaseModel):
    id: int
    pandal_id: int
    pandal_name: str
    user_id: int
    user_name: str
    user_email: str | None = None
    rating: int
    comment: str | None = None
    is_approved: bool
    created_at: datetime | None = None
    flag_count: int = 0


class MomentModerationItem(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str | None = None
    image_url: str
    caption: str | None = None
    is_approved: bool
    created_at: datetime | None = None
