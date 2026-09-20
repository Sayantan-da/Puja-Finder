from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pandal_id: int
    user_id: int | None = None
    image_url: str
    caption: str | None = None
    created_at: datetime | None = None
