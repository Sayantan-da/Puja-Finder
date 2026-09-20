from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.crowd_report import CrowdLevel


class PandalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str = Field(min_length=2, max_length=300)
    locality: str = Field(default="", max_length=120)
    latitude: float = Field(default=22.5726, ge=-90, le=90)
    longitude: float = Field(default=88.3639, ge=-180, le=180)
    theme: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=1000)
    opening_time: str = Field(default="04:00", max_length=10)
    closing_time: str = Field(default="23:00", max_length=10)
    dates: str | None = Field(default=None, max_length=100)
    accessibility_tags: str | None = Field(default=None, max_length=250)
    official_links: str | None = Field(default=None, max_length=500)
    parking_info: str | None = Field(default=None, max_length=300)
    metro_info: str | None = Field(default=None, max_length=300)
    route_tips: str | None = Field(default=None, max_length=500)


class PandalOut(BaseModel):
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
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # Aggregated fields (filled in by the API)
    avg_rating: float | None = None
    review_count: int = 0
    crowd_level: CrowdLevel | None = None
    waiting_time_minutes: int | None = None
    crowd_updated_at: datetime | None = None  # freshness of the crowd estimate
    confidence: int | None = None                # crowd-estimate confidence 0–100
    confidence_label: str | None = None          # HIGH | MODERATE | PRELIMINARY
    fresh_count: int = 0                         # number of fresh crowd reports in window
    distinct_reporters_count: int = 0            # number of unique users who reported
    is_stale: bool = False                       # true when no fresh report exists
    crowd_trend: str | None = None               # SURGING | STEADY | COOLING
    approach_traffic: str | None = None          # CLEAR | CONGESTED | PEDESTRIAN_ONLY
    barricade_distance: str | None = None        # DIRECT | MODERATE | LONG_CIRCUIT
    comfort_tags: list[str] = Field(default_factory=list)
    hourly_pattern: list[dict] = Field(default_factory=list) # 24h curve: [{hour, rush_level, wait_estimate}]
    open_now: bool | None = None          # computed in Asia/Kolkata timezone
    cover_image: str | None = None        # first uploaded photo, for cards
    distance_km: float | None = None      # only filled by /nearby


class PandalFlagRequest(BaseModel):
    reason: str = Field(..., description="WRONG_LOCATION | WRONG_HOURS | INCORRECT_THEME | PANDAL_CLOSED | OTHER")
    description: str = Field("", max_length=500)
    suggested_correction: str | None = Field(None, max_length=500)
