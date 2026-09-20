from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MomentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str = ""
    image_url: str
    caption: str | None = None
    created_at: datetime | None = None
    avg_rating: float | None = None
    vote_count: int = 0
    my_rating: int | None = None


class MomentRate(BaseModel):
    rating: int = Field(ge=1, le=5)
