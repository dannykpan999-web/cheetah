from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any

from ..database import get_db
from ..dependencies import any_role
from ..models import User, ScanResult, Endpoint, DnsPolicy, Tenant
from ..schemas import UserOut

router = APIRouter(prefix="/billing", tags=["billing"])

PLANS = {
    "starter": {
        "label":  "Starter",
        "price":  "R$ 99",
        "period": "mês",
        "color":  "#3B82F6",
        "limits": {"scans": 50, "endpoints": 3, "dns_rules": 10},
        "features": ["50 scans/mês", "3 endpoints", "10 regras DNS", "Scanner LGPD", "Suporte por e-mail"],
    },
    "professional": {
        "label":  "Professional",
        "price":  "R$ 299",
        "period": "mês",
        "color":  "#F5921B",
        "limits": {"scans": 500, "endpoints": 20, "dns_rules": 100},
        "features": ["500 scans/mês", "20 endpoints", "100 regras DNS", "Scorecard LGPD", "Scan agendado", "Suporte prioritário"],
    },
    "enterprise": {
        "label":  "Enterprise",
        "price":  "R$ 799",
        "period": "mês",
        "color":  "#7C3AED",
        "limits": {"scans": -1, "endpoints": -1, "dns_rules": -1},
        "features": ["Scans ilimitados", "Endpoints ilimitados", "DNS ilimitado", "LGPD + relatórios", "SLA garantido", "Suporte dedicado"],
    },
}

def _mock_invoices(plan_label: str, price: str, active_since: datetime):
    invoices = []
    base = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    statuses = ["paid", "paid", "paid", "failed", "paid"]
    for i, status in enumerate(statuses):
        d = base - timedelta(days=30 * i)
        invoices.append({
            "id":          f"INV-{(base.year * 100 + base.month - i):06d}",
            "date":        d.strftime("%Y-%m-%d"),
            "date_label":  d.strftime("%d/%m/%Y"),
            "description": f"{plan_label} — Mensal",
            "amount":      price + ",00",
            "status":      status,
        })
    return invoices


@router.get("/overview")
def billing_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
) -> Any:
    tid = current_user.tenant_id
    tenant: Tenant = db.query(Tenant).filter(Tenant.id == tid).first()

    plan_key   = (tenant.plan or "starter").lower()
    plan_data  = PLANS.get(plan_key, PLANS["starter"])
    limits     = plan_data["limits"]

    scans_used     = db.query(ScanResult).filter(ScanResult.tenant_id == tid).count()
    endpoints_used = db.query(Endpoint).filter(Endpoint.tenant_id == tid).count()
    dns_used       = db.query(DnsPolicy).filter(DnsPolicy.tenant_id == tid).count()

    active_since = tenant.created_at or datetime.utcnow()

    return {
        "plan":         plan_key,
        "plan_label":   plan_data["label"],
        "price":        plan_data["price"],
        "period":       plan_data["period"],
        "plan_color":   plan_data["color"],
        "active_since": active_since.strftime("%d/%m/%Y"),
        "features":     plan_data["features"],
        "limits":       limits,
        "usage": {
            "scans":     scans_used,
            "endpoints": endpoints_used,
            "dns_rules": dns_used,
        },
        "all_plans": [
            {
                "key":      k,
                "label":    v["label"],
                "price":    v["price"],
                "period":   v["period"],
                "color":    v["color"],
                "features": v["features"],
                "limits":   v["limits"],
                "current":  k == plan_key,
            }
            for k, v in PLANS.items()
        ],
        "invoices": _mock_invoices(plan_data["label"], plan_data["price"], active_since),
    }
