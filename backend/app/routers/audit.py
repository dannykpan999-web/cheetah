from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import AuditLog, User
from ..dependencies import get_current_user

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs")
def list_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.tenant_id == current_user.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":         str(r.id),
            "action":     r.action,
            "resource":   r.resource,
            "ip_address": r.ip_address,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
