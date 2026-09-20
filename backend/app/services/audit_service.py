import json
import logging
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger("pujafinder.audit")


def record_audit_log(
    db: Session,
    user: Optional[User],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[Any] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Record an administrative action to the audit log table."""
    details_str = None
    if details is not None:
        if isinstance(details, (dict, list)):
            try:
                details_str = json.dumps(details)
            except Exception:
                details_str = str(details)
        else:
            details_str = str(details)

    log_entry = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else "system",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details_str,
        ip_address=ip_address,
    )
    db.add(log_entry)
    db.commit()
    logger.info("AUDIT [%s] %s by user %s on %s:%s", action, details_str or "", user.email if user else "sys", entity_type, entity_id)
    return log_entry
