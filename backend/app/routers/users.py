from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
import uuid as _uuid
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..dependencies import get_current_user, owner_or_admin
from ..models import User
from ..auth import hash_password

router = APIRouter(prefix="/users", tags=["users"])


class InviteUser(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "viewer"   # admin | viewer


class RoleUpdate(BaseModel):
    role: str


def _serialize(u: User) -> dict:
    return {
        "id":         str(u.id),
        "email":      u.email,
        "full_name":  u.full_name,
        "role":       u.role,
        "is_active":  u.is_active,
        "avatar_url": u.avatar_url,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("/team")
def list_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    users = db.query(User).filter(User.tenant_id == current_user.tenant_id).all()
    return [_serialize(u) for u in users]


@router.post("/invite")
def invite_user(
    body: InviteUser,
    db: Session = Depends(get_db),
    current_user: User = Depends(owner_or_admin),
) -> Any:
    if body.role == "owner":
        raise HTTPException(status_code=403, detail="Não é possível criar usuários proprietários")
    if body.role == "admin" and current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Apenas proprietários podem convidar administradores")

    existing = db.query(User).filter(
        User.email == body.email,
        User.tenant_id == current_user.tenant_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado neste tenant")

    user = User(
        tenant_id=current_user.tenant_id,
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize(user)


@router.patch("/{user_id}/role")
def update_role(
    user_id: str,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(owner_or_admin),
) -> Any:
    if body.role not in ("admin", "viewer"):
        raise HTTPException(status_code=400, detail="Role inválido. Use 'admin' ou 'viewer'")
    if body.role == "admin" and current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Apenas proprietários podem promover a administrador")

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.role == "owner":
        raise HTTPException(status_code=403, detail="O cargo do proprietário não pode ser alterado")
    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Você não pode alterar seu próprio cargo")

    user.role = body.role
    db.commit()
    return {"ok": True, "role": body.role}


@router.delete("/{user_id}")
def remove_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(owner_or_admin),
) -> Any:
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.role == "owner":
        raise HTTPException(status_code=403, detail="O proprietário não pode ser removido")
    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Você não pode remover sua própria conta")

    db.delete(user)
    db.commit()
    return {"ok": True}
