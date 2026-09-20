from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.event import EventType


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=1000)
    event_date: datetime
    start_time: datetime
    end_time: datetime
    event_type: EventType = EventType.OTHER


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pandal_id: int
    title: str
    description: str | None = None
    event_date: datetime
    start_time: datetime
    end_time: datetime
    event_type: EventType
