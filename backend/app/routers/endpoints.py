import uuid
import secrets
import logging
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Endpoint, EndpointAlert, EndpointVulnerability, User, AuditLog
from ..dependencies import get_current_user, owner_or_admin, any_role
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/endpoints", tags=["endpoints"])

# ── Wazuh API helpers ──────────────────────────────────────────────────────────

WAZUH_HOST = "http://wazuh:55000"
WAZUH_USER = "wazuh-wui"
WAZUH_PASS = "MyS3cr37P450r.*-"

def _wazuh_token() -> Optional[str]:
    try:
        r = httpx.post(
            f"{WAZUH_HOST}/security/user/authenticate",
            auth=(WAZUH_USER, WAZUH_PASS),
            verify=False, timeout=5,
        )
        if r.status_code == 200:
            return r.json()["data"]["token"]
    except Exception:
        pass
    return None

def _wazuh_get(path: str) -> Optional[dict]:
    token = _wazuh_token()
    if not token:
        return None
    try:
        r = httpx.get(
            f"{WAZUH_HOST}{path}",
            headers={"Authorization": f"Bearer {token}"},
            verify=False, timeout=10,
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None

def _sync_wazuh_agents(db: Session, tenant_id):
    """Pull agent list from Wazuh and upsert into local DB."""
    data = _wazuh_get("/agents?limit=500")
    if not data:
        return
    for a in data.get("data", {}).get("affected_items", []):
        if a.get("id") == "000":
            continue  # skip manager itself
        ep = db.query(Endpoint).filter(
            Endpoint.tenant_id == tenant_id,
            Endpoint.agent_id == a["id"],
        ).first()
        status_map = {"active": "active", "disconnected": "disconnected",
                      "never_connected": "never_connected", "pending": "never_connected"}
        status = status_map.get(a.get("status", ""), "never_connected")
        last_hb = None
        if a.get("lastKeepAlive") and a["lastKeepAlive"] != "1970-01-01T00:00:00Z":
            try:
                last_hb = datetime.fromisoformat(a["lastKeepAlive"].replace("Z", "+00:00"))
            except Exception:
                pass
        if ep:
            ep.status         = status
            ep.ip_address     = (a.get("ip") or ep.ip_address)
            ep.os_version     = (a.get("os", {}).get("name") or ep.os_version)
            ep.last_heartbeat = last_hb or ep.last_heartbeat
        else:
            os_raw = (a.get("os", {}).get("platform") or "").lower()
            os_type = "linux" if "linux" in os_raw else ("windows" if "windows" in os_raw else "macos" if "darwin" in os_raw else "linux")
            ep = Endpoint(
                tenant_id      = tenant_id,
                agent_id       = a["id"],
                hostname       = a.get("name", f"agent-{a['id']}"),
                os_type        = os_type,
                os_version     = a.get("os", {}).get("name", ""),
                ip_address     = a.get("ip", ""),
                status         = status,
                agent_token    = secrets.token_hex(32),
                last_heartbeat = last_hb,
            )
            db.add(ep)
    db.commit()

def _sync_wazuh_vulns(db: Session, tenant_id, endpoint: Endpoint):
    """Pull vulnerabilities for an agent from Wazuh."""
    if not endpoint.agent_id:
        return
    data = _wazuh_get(f"/vulnerability/{endpoint.agent_id}?limit=100")
    if not data:
        return
    db.query(EndpointVulnerability).filter(
        EndpointVulnerability.endpoint_id == endpoint.id
    ).delete()
    for v in data.get("data", {}).get("affected_items", []):
        db.add(EndpointVulnerability(
            tenant_id   = tenant_id,
            endpoint_id = endpoint.id,
            cve_id      = v.get("cve", ""),
            severity    = v.get("severity", "medium").lower(),
            package     = v.get("name", ""),
            version     = v.get("version", ""),
            description = v.get("title", ""),
        ))
    db.commit()

def _sync_wazuh_sca(db: Session, endpoint: Endpoint):
    """Pull SCA score for an agent from Wazuh."""
    if not endpoint.agent_id:
        return
    data = _wazuh_get(f"/sca/{endpoint.agent_id}?limit=1")
    if not data:
        return
    items = data.get("data", {}).get("affected_items", [])
    if items:
        score = items[0].get("score", 0)
        endpoint.sca_score = score
        db.commit()

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), user: User = Depends(any_role)):
    agents = db.query(Endpoint).filter(Endpoint.tenant_id == user.tenant_id).all()
    total     = len(agents)
    online    = sum(1 for a in agents if a.status == "active")
    offline   = sum(1 for a in agents if a.status == "disconnected")
    alerts    = db.query(EndpointAlert).filter(
        EndpointAlert.tenant_id == user.tenant_id,
        EndpointAlert.resolved  == False,
    ).count()
    critical_alerts = db.query(EndpointAlert).filter(
        EndpointAlert.tenant_id == user.tenant_id,
        EndpointAlert.severity  == "critical",
        EndpointAlert.resolved  == False,
    ).count()
    vulns = db.query(EndpointVulnerability).filter(
        EndpointVulnerability.tenant_id == user.tenant_id
    ).count()
    critical_vulns = db.query(EndpointVulnerability).filter(
        EndpointVulnerability.tenant_id == user.tenant_id,
        EndpointVulnerability.severity  == "critical",
    ).count()
    return {
        "total": total, "online": online, "offline": offline,
        "alerts": alerts, "critical_alerts": critical_alerts,
        "vulnerabilities": vulns, "critical_vulnerabilities": critical_vulns,
    }

@router.get("/agents")
def list_agents(
    db: Session = Depends(get_db),
    user: User = Depends(any_role),
    sync: bool = Query(False),
):
    if sync:
        _sync_wazuh_agents(db, user.tenant_id)
    agents = db.query(Endpoint).filter(Endpoint.tenant_id == user.tenant_id).all()
    result = []
    for a in agents:
        alert_count   = db.query(EndpointAlert).filter(
            EndpointAlert.endpoint_id == a.id, EndpointAlert.resolved == False).count()
        vuln_count    = db.query(EndpointVulnerability).filter(
            EndpointVulnerability.endpoint_id == a.id).count()
        critical_vuln = db.query(EndpointVulnerability).filter(
            EndpointVulnerability.endpoint_id == a.id,
            EndpointVulnerability.severity == "critical").count()
        result.append({
            "id":              str(a.id),
            "agent_id":        a.agent_id,
            "hostname":        a.hostname,
            "os_type":         a.os_type,
            "os_version":      a.os_version,
            "ip_address":      a.ip_address,
            "status":          a.status,
            "sca_score":       a.sca_score,
            "alert_count":     alert_count,
            "vuln_count":      vuln_count,
            "critical_vulns":  critical_vuln,
            "last_heartbeat":  a.last_heartbeat.isoformat() if a.last_heartbeat else None,
            "registered_at":   a.registered_at.isoformat() if a.registered_at else None,
        })
    return result

@router.post("/agents")
def create_agent(
    hostname: str,
    os_type:  str = "linux",
    db: Session = Depends(get_db),
    user: User = Depends(owner_or_admin),
):
    token = secrets.token_hex(32)
    ep = Endpoint(
        tenant_id   = user.tenant_id,
        hostname    = hostname,
        os_type     = os_type,
        status      = "never_connected",
        agent_token = token,
    )
    db.add(ep)
    db.add(AuditLog(tenant_id=user.tenant_id, user_id=user.id,
                    action="register_endpoint", resource=hostname))
    db.commit()
    db.refresh(ep)
    return {"id": str(ep.id), "hostname": ep.hostname, "agent_token": token,
            "os_type": os_type, "status": "never_connected"}

@router.get("/agents/{agent_id}")
def get_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(any_role),
):
    ep = db.query(Endpoint).filter(
        Endpoint.id == agent_id, Endpoint.tenant_id == user.tenant_id
    ).first()
    if not ep:
        raise HTTPException(404, "Agente não encontrado")

    # Try syncing from Wazuh
    _sync_wazuh_sca(db, ep)
    _sync_wazuh_vulns(db, user.tenant_id, ep)

    alerts = db.query(EndpointAlert).filter(
        EndpointAlert.endpoint_id == ep.id
    ).order_by(EndpointAlert.created_at.desc()).limit(20).all()

    vulns = db.query(EndpointVulnerability).filter(
        EndpointVulnerability.endpoint_id == ep.id
    ).order_by(EndpointVulnerability.severity).limit(50).all()

    return {
        "id":            str(ep.id),
        "agent_id":      ep.agent_id,
        "hostname":      ep.hostname,
        "os_type":       ep.os_type,
        "os_version":    ep.os_version,
        "ip_address":    ep.ip_address,
        "status":        ep.status,
        "sca_score":     ep.sca_score,
        "agent_token":   ep.agent_token,
        "last_heartbeat": ep.last_heartbeat.isoformat() if ep.last_heartbeat else None,
        "registered_at": ep.registered_at.isoformat() if ep.registered_at else None,
        "alerts": [
            {"id": str(a.id), "rule_id": a.rule_id, "severity": a.severity,
             "category": a.category, "description": a.description,
             "resolved": a.resolved, "created_at": a.created_at.isoformat()}
            for a in alerts
        ],
        "vulnerabilities": [
            {"id": str(v.id), "cve_id": v.cve_id, "severity": v.severity,
             "package": v.package, "version": v.version, "description": v.description,
             "detected_at": v.detected_at.isoformat()}
            for v in vulns
        ],
    }

@router.delete("/agents/{agent_id}")
def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(owner_or_admin),
):
    ep = db.query(Endpoint).filter(
        Endpoint.id == agent_id, Endpoint.tenant_id == user.tenant_id
    ).first()
    if not ep:
        raise HTTPException(404, "Agente não encontrado")
    db.delete(ep)
    db.add(AuditLog(tenant_id=user.tenant_id, user_id=user.id,
                    action="delete_endpoint", resource=ep.hostname))
    db.commit()
    return {"ok": True}

@router.get("/alerts")
def list_alerts(
    resolved: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(any_role),
):
    q = db.query(EndpointAlert, Endpoint.hostname).join(
        Endpoint, EndpointAlert.endpoint_id == Endpoint.id
    ).filter(EndpointAlert.tenant_id == user.tenant_id)
    if resolved is not None:
        q = q.filter(EndpointAlert.resolved == resolved)
    rows = q.order_by(EndpointAlert.created_at.desc()).limit(limit).all()
    return [
        {"id": str(a.id), "rule_id": a.rule_id, "severity": a.severity,
         "category": a.category, "description": a.description,
         "resolved": a.resolved, "hostname": hostname,
         "endpoint_id": str(a.endpoint_id),
         "created_at": a.created_at.isoformat()}
        for a, hostname in rows
    ]

@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(owner_or_admin),
):
    alert = db.query(EndpointAlert).filter(
        EndpointAlert.id == alert_id, EndpointAlert.tenant_id == user.tenant_id
    ).first()
    if not alert:
        raise HTTPException(404, "Alerta não encontrado")
    alert.resolved = True
    db.commit()
    return {"ok": True}

@router.get("/vulnerabilities")
def list_vulnerabilities(
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(any_role),
):
    q = db.query(EndpointVulnerability, Endpoint.hostname).join(
        Endpoint, EndpointVulnerability.endpoint_id == Endpoint.id
    ).filter(EndpointVulnerability.tenant_id == user.tenant_id)
    if severity:
        q = q.filter(EndpointVulnerability.severity == severity)
    rows = q.order_by(EndpointVulnerability.severity).limit(200).all()
    return [
        {"id": str(v.id), "cve_id": v.cve_id, "severity": v.severity,
         "package": v.package, "version": v.version, "description": v.description,
         "hostname": hostname, "endpoint_id": str(v.endpoint_id),
         "detected_at": v.detected_at.isoformat()}
        for v, hostname in rows
    ]

@router.get("/onboarding/{os_type}")
def get_onboarding(
    os_type: str,
    db: Session = Depends(get_db),
    user: User = Depends(owner_or_admin),
):
    token = secrets.token_hex(32)
    ep = Endpoint(
        tenant_id   = user.tenant_id,
        hostname    = f"pending-{os_type}-{token[:6]}",
        os_type     = os_type,
        status      = "never_connected",
        agent_token = token,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)

    base_url = "https://cheetah.technology"
    cmds = {
        "linux": (
            f"curl -s {base_url}/install/linux.sh | "
            f"sudo bash -s -- --token={token} --host={base_url}"
        ),
        "windows": (
            f'iex (irm "{base_url}/install/windows.ps1") '
            f'-Token "{token}" -Host "{base_url}"'
        ),
        "macos": (
            f"curl -s {base_url}/install/macos.sh | "
            f"sudo bash -s -- --token={token} --host={base_url}"
        ),
    }
    return {
        "agent_id":    str(ep.id),
        "agent_token": token,
        "os_type":     os_type,
        "command":     cmds.get(os_type, cmds["linux"]),
        "instructions": [
            f"1. Abra o terminal como administrador no dispositivo alvo.",
            f"2. Execute o comando abaixo — o agente será instalado e registrado automaticamente.",
            f"3. Em 2 minutos o dispositivo aparecerá na lista com status Online.",
        ]
    }
