from pydantic import BaseModel, ConfigDict, Field

from datetime import datetime


class ContentBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    title: str
    body: str
    updated_at: datetime | None = None


class ContentBlockCreate(BaseModel):
    key: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9_]+$")
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2, max_length=8000)


class ContentBlockUpdate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2, max_length=8000)
