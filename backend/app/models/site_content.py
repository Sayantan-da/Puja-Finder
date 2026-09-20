from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.database import Base


class ContentBlock(Base):
    """Editable site content (e.g. the 'About Durga Puja' page sections).

    ADMINs can create/update/delete blocks; every block is identified by a
    stable `key` so pages can also fetch specific sections."""

    __tablename__ = "content_blocks"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(80), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(String(8000), nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
