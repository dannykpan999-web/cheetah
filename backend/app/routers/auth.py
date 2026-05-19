from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models import User, Tenant, AuditLog
from ..schemas import LoginRequest, Token, UserOut
from ..auth import verify_password, create_access_token, create_refresh_token, decode_token
from ..dependencies import get_current_user
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.slug == body.tenant_slug, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    user = db.query(User).filter(User.email == body.email, User.tenant_id == tenant.id).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    payload = {"sub": str(user.id), "tenant_id": str(tenant.id), "role": user.role}
    log = AuditLog(tenant_id=tenant.id, user_id=user.id, action="login", resource="auth",
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    db.commit()
    return Token(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload)
    )

@router.post("/refresh", response_model=Token)
def refresh(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()), db: Session = Depends(get_db)):
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    new_payload = {"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role}
    return Token(
        access_token=create_access_token(new_payload),
        refresh_token=create_refresh_token(new_payload)
    )

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
