from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
