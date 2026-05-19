from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Tenant, User
from ..schemas import TenantCreate, TenantOut, UserCreate, UserOut
from ..auth import hash_password
from ..dependencies import get_current_user
from typing import List

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.post("", response_model=TenantOut)
def create_tenant(body: TenantCreate, db: Session = Depends(get_db)):
    if db.query(Tenant).filter(Tenant.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug já existe")
    tenant = Tenant(name=body.name, slug=body.slug, plan=body.plan)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant

@router.get("/{slug}", response_model=TenantOut)
def get_tenant(slug: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return tenant

@router.post("/{slug}/users", response_model=UserOut)
def create_user(slug: str, body: UserCreate, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    if db.query(User).filter(User.email == body.email, User.tenant_id == tenant.id).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado nessa empresa")
    user = User(
        tenant_id=tenant.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/{slug}/users", response_model=List[UserOut])
def list_users(slug: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
    if not tenant or tenant.id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return db.query(User).filter(User.tenant_id == tenant.id).all()
