from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import httpx
from ..database import get_db
from ..models import User, DnsPolicy
from ..schemas import DnsPolicyCreate, DnsPolicyOut, DnsStats
from ..dependencies import get_current_user, owner_or_admin
from ..config import settings

router = APIRouter(prefix="/dns", tags=["dns"])

def adguard_request(method: str, path: str, **kwargs):
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.request(
                method,
                f"{settings.ADGUARD_HOST}{path}",
                auth=(settings.ADGUARD_USER, settings.ADGUARD_PASS),
                **kwargs
            )
            r.raise_for_status()
            return r
    except Exception:
        return None

@router.get("/stats", response_model=DnsStats)
def get_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = adguard_request("GET", "/control/stats")
    if r:
        data = r.json()
        top_blocked = [{"domain": k, "count": v} for k, v in list((data.get("top_blocked_domains") or {}).items())[:5]]
        return DnsStats(
            total_queries=data.get("num_dns_queries", 0),
            blocked_today=data.get("num_blocked_filtering", 0),
            allowed_today=data.get("num_dns_queries", 0) - data.get("num_blocked_filtering", 0),
            top_blocked=top_blocked
        )
    policies = db.query(DnsPolicy).filter(DnsPolicy.tenant_id == user.tenant_id).all()
    return DnsStats(total_queries=0, blocked_today=0, allowed_today=0, top_blocked=[])

@router.get("/policies", response_model=List[DnsPolicyOut])
def list_policies(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(DnsPolicy).filter(DnsPolicy.tenant_id == user.tenant_id).all()

@router.post("/policies", response_model=DnsPolicyOut)
def create_policy(body: DnsPolicyCreate, db: Session = Depends(get_db), user: User = Depends(owner_or_admin)):
    policy = DnsPolicy(
        tenant_id=user.tenant_id,
        domain=body.domain,
        policy_type=body.policy_type,
        category=body.category
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    _sync_adguard(db, user.tenant_id)
    return policy

@router.delete("/policies/{policy_id}")
def delete_policy(policy_id: str, db: Session = Depends(get_db), user: User = Depends(owner_or_admin)):
    policy = db.query(DnsPolicy).filter(DnsPolicy.id == policy_id, DnsPolicy.tenant_id == user.tenant_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Política não encontrada")
    db.delete(policy)
    db.commit()
    _sync_adguard(db, user.tenant_id)
    return {"ok": True}

@router.get("/adguard/status")
def adguard_status(user: User = Depends(get_current_user)):
    r = adguard_request("GET", "/control/status")
    if r:
        return r.json()
    return {"running": False, "message": "AdGuard Home não acessível"}

def _sync_adguard(db: Session, tenant_id):
    blocked = db.query(DnsPolicy).filter(
        DnsPolicy.tenant_id == tenant_id,
        DnsPolicy.policy_type == "blacklist"
    ).all()
    rules = [f"||{p.domain}^" for p in blocked]
    adguard_request("POST", "/control/filtering/set_rules", json={"rules": rules})
