from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.database import Base

class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True)
    pandal_id = Column(Integer, ForeignKey("pandals.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_url = Column(String, nullable=False)
    caption = Column(String)
    created_at = Column(DateTime)
