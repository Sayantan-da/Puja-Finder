from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.crowd_report import CrowdLevel


class CrowdReportCreate(BaseModel):
    crowd_level: CrowdLevel
    waiting_time_minutes: int | None = Field(default=None, ge=0, le=600)
    approach_traffic: Literal["CLEAR", "CONGESTED", "PEDESTRIAN_ONLY"] | None = None
    barricade_distance: Literal["DIRECT", "MODERATE", "LONG_CIRCUIT"] | None = None
    comfort_tags: list[str] = Field(default_factory=list)
    comment: str | None = Field(default=None, max_length=500)


class CrowdReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crowd_level: CrowdLevel
    waiting_time_minutes: int | None = None
    approach_traffic: str | None = None
    barricade_distance: str | None = None
    comfort_tags: list[str] = Field(default_factory=list)
    comment: str | None = None
    created_at: datetime | None = None

    @field_validator("comfort_tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        if isinstance(v, (list, set, tuple)):
            return [str(t).strip() for t in v if str(t).strip()]
        return []

