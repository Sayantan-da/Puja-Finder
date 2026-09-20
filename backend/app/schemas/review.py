from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserOut


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int
    comment: str | None = None
    created_at: datetime | None = None
    user: UserOut
