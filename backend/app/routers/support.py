from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any
import uuid
from pydantic import BaseModel

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, AuditLog

router = APIRouter(prefix="/support", tags=["support"])


class TicketCreate(BaseModel):
    subject: str
    message: str


@router.post("/ticket")
def create_ticket(
    body: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    log = AuditLog(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action=f"support_ticket: {body.subject[:80]}",
        resource="support",
        ip_address=None,
    )
    db.add(log)
    db.commit()

    ticket_id = f"TKT-{str(uuid.uuid4())[:8].upper()}"
    return {"ok": True, "ticket_id": ticket_id}
