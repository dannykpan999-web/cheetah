import os
import io
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models import User, Tenant, AuditLog
from ..schemas import LoginRequest, Token, UserOut, UserUpdateName, UserUpdatePassword, UserUpdateNotifications
from ..auth import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from ..dependencies import get_current_user
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

limiter    = Limiter(key_func=get_remote_address)
router     = APIRouter(prefix="/auth", tags=["auth"])
AVATAR_DIR = "/var/cheetah/avatars"


def _user_out(user: User) -> dict:
    return {
        "id":                  user.id,
        "email":               user.email,
        "full_name":           user.full_name,
        "role":                user.role,
        "is_active":           user.is_active,
        "tenant_id":           user.tenant_id,
        "created_at":          user.created_at,
        "tenant_slug":         user.tenant.slug if user.tenant else None,
        "plan":                user.tenant.plan if user.tenant else None,
        "avatar_url":          user.avatar_url,
        "notif_email_threats":  user.notif_email_threats  if user.notif_email_threats  is not None else True,
        "notif_email_reports":  user.notif_email_reports  if user.notif_email_reports  is not None else False,
        "notif_email_system":   user.notif_email_system   if user.notif_email_system   is not None else True,
        "notif_browser_alerts": user.notif_browser_alerts if user.notif_browser_alerts is not None else True,
    }


# ── Auth ──────────────────────────────────────────────────────────────────────

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
    db.add(AuditLog(tenant_id=tenant.id, user_id=user.id, action="login", resource="auth",
                    ip_address=request.client.host if request.client else None))
    db.commit()
    return Token(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
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
        refresh_token=create_refresh_token(new_payload),
    )


# ── Current user ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(body: UserUpdateName, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.full_name is not None:
        user.full_name = body.full_name
        db.commit()
        db.refresh(user)
    return _user_out(user)


@router.patch("/me/password", status_code=200)
def change_password(body: UserUpdatePassword, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"detail": "Senha alterada com sucesso"}


@router.patch("/me/notifications", response_model=UserOut)
def update_notifications(
    body: UserUpdateNotifications,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.email_threats  is not None: user.notif_email_threats  = body.email_threats
    if body.email_reports  is not None: user.notif_email_reports  = body.email_reports
    if body.email_system   is not None: user.notif_email_system   = body.email_system
    if body.browser_alerts is not None: user.notif_browser_alerts = body.browser_alerts
    db.commit()
    db.refresh(user)
    return _user_out(user)


# ── Avatar upload ─────────────────────────────────────────────────────────────

@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ALLOWED = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG, PNG ou WebP")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 2MB")

    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content)).convert("RGB")
        w, h  = img.size
        side  = min(w, h)
        left  = (w - side) // 2
        top   = (h - side) // 2
        img   = img.crop((left, top, left + side, top + side))
        img   = img.resize((256, 256), Image.LANCZOS)
    except Exception:
        raise HTTPException(status_code=400, detail="Imagem inválida ou corrompida")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    path = os.path.join(AVATAR_DIR, f"{user.id}.jpg")
    img.save(path, "JPEG", quality=88, optimize=True)

    user.avatar_url = f"/api/v1/auth/avatars/{user.id}"
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/avatars/{user_id}")
def get_avatar(user_id: str):
    path = os.path.join(AVATAR_DIR, f"{user_id}.jpg")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Avatar não encontrado")
    return FileResponse(path, media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
