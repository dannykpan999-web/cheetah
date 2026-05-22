import json
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, any_role
from ..models import (
    AuditLog,
    DnsPolicy,
    Endpoint,
    EndpointAlert,
    ScanResult,
    ScanSchedule,
    User,
)
from ..database import get_db

router = APIRouter(prefix="/lgpd", tags=["lgpd"])

# ── Grade helpers ─────────────────────────────────────────────────────────────

def _grade(score: int) -> tuple[str, str]:
    if score >= 90:
        return "A", "#10B981"
    if score >= 75:
        return "B", "#3B82F6"
    if score >= 60:
        return "C", "#F59E0B"
    if score >= 45:
        return "D", "#F97316"
    return "F", "#EF4444"


# ── Recommendation map ────────────────────────────────────────────────────────

_RECS: dict[str, dict[str, str]] = {
    "scan_performed": {
        "priority": "alta",
        "action":   "Iniciar Verificação de Documentos",
        "detail":   "Faça upload de documentos para análise no Scanner.",
    },
    "no_active_threats": {
        "priority": "alta",
        "action":   "Tratar Ameaças Detectadas",
        "detail":   "Arquivos maliciosos não quarentenados representam risco ativo.",
    },
    "dns_protection": {
        "priority": "média",
        "action":   "Configurar Proteção DNS",
        "detail":   "Adicione domínios maliciosos à blacklist na seção DNS.",
    },
    "endpoint_monitoring": {
        "priority": "média",
        "action":   "Instalar Agentes de Endpoint",
        "detail":   "Instale o agente Wazuh nos dispositivos da empresa.",
    },
    "pii_cataloged": {
        "priority": "alta",
        "action":   "Mapear Dados Pessoais",
        "detail":   "Faça scan de documentos que contenham CPF, e-mail ou dados de saúde.",
    },
    "scan_scheduled": {
        "priority": "média",
        "action":   "Agendar Revisão Periódica",
        "detail":   "Ative o scan automático semanal no painel Scanner.",
    },
    "no_critical_alerts": {
        "priority": "alta",
        "action":   "Resolver Alertas Críticos",
        "detail":   "Acesse Endpoints > Alertas e resolva os alertas críticos abertos.",
    },
    "audit_trail": {
        "priority": "baixa",
        "action":   "Gerar Histórico de Auditoria",
        "detail":   "Use a plataforma regularmente — ações são registradas automaticamente.",
    },
}


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.get("/scorecard")
def lgpd_scorecard(
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
) -> Any:
    tid = current_user.tenant_id

    # ── Raw queries ───────────────────────────────────────────────────────────

    all_scans: list[ScanResult] = (
        db.query(ScanResult)
        .filter(ScanResult.tenant_id == tid)
        .all()
    )
    total_scans = len(all_scans)

    threat_scans = [s for s in all_scans if s.scan_status == "threat_found"]
    active_threats = [s for s in threat_scans if not s.quarantined]
    quarantined_count = sum(1 for s in all_scans if s.quarantined)

    blacklist_count: int = (
        db.query(DnsPolicy)
        .filter(DnsPolicy.tenant_id == tid, DnsPolicy.policy_type == "blacklist")
        .count()
    )
    dns_rules_total: int = (
        db.query(DnsPolicy)
        .filter(DnsPolicy.tenant_id == tid)
        .count()
    )

    all_endpoints: list[Endpoint] = (
        db.query(Endpoint)
        .filter(Endpoint.tenant_id == tid)
        .all()
    )
    active_endpoints = [e for e in all_endpoints if e.status == "active"]

    pii_scans = [s for s in all_scans if s.pii_detected]

    schedule: ScanSchedule | None = (
        db.query(ScanSchedule)
        .filter(ScanSchedule.tenant_id == tid)
        .first()
    )

    unresolved_alerts: list[EndpointAlert] = (
        db.query(EndpointAlert)
        .filter(EndpointAlert.tenant_id == tid, EndpointAlert.resolved == False)
        .all()
    )
    critical_alerts = [a for a in unresolved_alerts if a.severity == "critical"]
    non_critical_unresolved = [
        a for a in unresolved_alerts if a.severity in ("medium", "high")
    ]

    audit_count: int = (
        db.query(AuditLog)
        .filter(AuditLog.tenant_id == tid)
        .count()
    )

    # ── Build checks ──────────────────────────────────────────────────────────

    checks: list[dict] = []

    # 1. scan_performed
    if total_scans >= 5:
        c1_passed, c1_partial = True, False
        c1_earned = 15
    elif total_scans >= 1:
        c1_passed, c1_partial = False, True
        c1_earned = 7
    else:
        c1_passed, c1_partial = False, False
        c1_earned = 0
    checks.append({
        "id":          "scan_performed",
        "title":       "Verificação de Documentos",
        "description": "Arquivos foram analisados pelo scanner para detecção de ameaças e dados pessoais.",
        "article":     "Art. 46",
        "passed":      c1_passed,
        "partial":     c1_partial,
        "weight":      15,
        "earned":      c1_earned,
        "detail":      f"{total_scans} arquivos verificados",
    })

    # 2. no_active_threats
    if active_threats:
        c2_passed, c2_partial = False, False
        c2_earned = 0
    elif threat_scans and not active_threats and len(threat_scans) >= 3:
        c2_passed, c2_partial = False, True
        c2_earned = 10
    else:
        c2_passed, c2_partial = True, False
        c2_earned = 20
    checks.append({
        "id":          "no_active_threats",
        "title":       "Sem Ameaças Ativas",
        "description": "Nenhum arquivo malicioso detectado fora de quarentena.",
        "article":     "Art. 47",
        "passed":      c2_passed,
        "partial":     c2_partial,
        "weight":      20,
        "earned":      c2_earned,
        "detail":      f"{len(active_threats)} ameaças ativas / {quarantined_count} em quarentena",
    })

    # 3. dns_protection
    if blacklist_count >= 3:
        c3_passed, c3_partial = True, False
        c3_earned = 10
    elif blacklist_count >= 1:
        c3_passed, c3_partial = False, True
        c3_earned = 5
    else:
        c3_passed, c3_partial = False, False
        c3_earned = 0
    checks.append({
        "id":          "dns_protection",
        "title":       "Proteção DNS Ativa",
        "description": "Domínios maliciosos bloqueados via política DNS blacklist.",
        "article":     "Art. 46",
        "passed":      c3_passed,
        "partial":     c3_partial,
        "weight":      10,
        "earned":      c3_earned,
        "detail":      f"{blacklist_count} regras de bloqueio DNS configuradas",
    })

    # 4. endpoint_monitoring
    if active_endpoints:
        c4_passed, c4_partial = True, False
        c4_earned = 15
    elif all_endpoints:
        c4_passed, c4_partial = False, True
        c4_earned = 7
    else:
        c4_passed, c4_partial = False, False
        c4_earned = 0
    checks.append({
        "id":          "endpoint_monitoring",
        "title":       "Monitoramento de Endpoints",
        "description": "Agentes de segurança instalados e ativos nos dispositivos da organização.",
        "article":     "Art. 46",
        "passed":      c4_passed,
        "partial":     c4_partial,
        "weight":      15,
        "earned":      c4_earned,
        "detail":      f"{len(active_endpoints)} endpoint(s) ativo(s) de {len(all_endpoints)} registrado(s)",
    })

    # 5. pii_cataloged
    if pii_scans:
        c5_passed, c5_partial = True, False
        c5_earned = 15
    elif total_scans == 0:
        c5_passed, c5_partial = False, False
        c5_earned = 0
    else:
        c5_passed, c5_partial = False, True
        c5_earned = 7
    checks.append({
        "id":          "pii_cataloged",
        "title":       "Mapeamento de Dados Pessoais",
        "description": "Documentos com dados pessoais identificados e catalogados conforme LGPD.",
        "article":     "Art. 37",
        "passed":      c5_passed,
        "partial":     c5_partial,
        "weight":      15,
        "earned":      c5_earned,
        "detail":      f"{len(pii_scans)} arquivos com dados pessoais identificados",
    })

    # 6. scan_scheduled
    if schedule and schedule.enabled:
        c6_passed, c6_partial = True, False
        c6_earned = 10
    elif schedule and not schedule.enabled:
        c6_passed, c6_partial = False, True
        c6_earned = 5
    else:
        c6_passed, c6_partial = False, False
        c6_earned = 0
    checks.append({
        "id":          "scan_scheduled",
        "title":       "Revisão Periódica Configurada",
        "description": "Scan automático periódico habilitado para garantir monitoramento contínuo.",
        "article":     "Art. 48",
        "passed":      c6_passed,
        "partial":     c6_partial,
        "weight":      10,
        "earned":      c6_earned,
        "detail":      (
            "Scan automático ativo"
            if (schedule and schedule.enabled)
            else ("Agenda configurada mas desativada" if schedule else "Nenhuma agenda configurada")
        ),
    })

    # 7. no_critical_alerts
    if critical_alerts:
        c7_passed, c7_partial = False, False
        c7_earned = 0
    elif non_critical_unresolved:
        c7_passed, c7_partial = False, True
        c7_earned = 5
    else:
        c7_passed, c7_partial = True, False
        c7_earned = 10
    checks.append({
        "id":          "no_critical_alerts",
        "title":       "Sem Alertas Críticos Abertos",
        "description": "Nenhum alerta crítico de endpoint pendente de resolução.",
        "article":     "Art. 47",
        "passed":      c7_passed,
        "partial":     c7_partial,
        "weight":      10,
        "earned":      c7_earned,
        "detail":      f"{len(critical_alerts)} alerta(s) crítico(s) aberto(s)",
    })

    # 8. audit_trail
    if audit_count >= 10:
        c8_passed, c8_partial = True, False
        c8_earned = 5
    elif audit_count >= 1:
        c8_passed, c8_partial = False, True
        c8_earned = 2
    else:
        c8_passed, c8_partial = False, False
        c8_earned = 0
    checks.append({
        "id":          "audit_trail",
        "title":       "Trilha de Auditoria",
        "description": "Registro de ações dos usuários disponível para rastreabilidade.",
        "article":     "Art. 37",
        "passed":      c8_passed,
        "partial":     c8_partial,
        "weight":      5,
        "earned":      c8_earned,
        "detail":      f"{audit_count} registro(s) de auditoria",
    })

    # ── Score & grade ─────────────────────────────────────────────────────────

    score = sum(c["earned"] for c in checks)
    grade, grade_color = _grade(score)

    # ── PII files ─────────────────────────────────────────────────────────────

    pii_files = []
    for s in pii_scans:
        try:
            pii_types: list[str] = json.loads(s.pii_findings or "[]")
        except (json.JSONDecodeError, TypeError):
            pii_types = []
        pii_files.append({
            "file_name":  s.file_name,
            "pii_types":  pii_types,
            "scanned_at": s.scanned_at.isoformat(),
            "risk_level": s.risk_level,
        })

    # ── Summary ───────────────────────────────────────────────────────────────

    summary = {
        "total_scans":      total_scans,
        "threats_blocked":  quarantined_count,
        "pii_files_found":  len(pii_scans),
        "dns_rules":        dns_rules_total,
        "active_endpoints": len(active_endpoints),
        "critical_alerts":  len(critical_alerts),
    }

    # ── Recommendations (failed/partial, ordered by weight desc, max 5) ──────

    failed_or_partial = [
        c for c in checks if not c["passed"]
    ]
    failed_or_partial.sort(key=lambda c: c["weight"], reverse=True)

    recommendations = []
    for c in failed_or_partial[:5]:
        rec_template = _RECS.get(c["id"])
        if rec_template:
            recommendations.append(dict(rec_template))

    return {
        "score":           score,
        "grade":           grade,
        "grade_color":     grade_color,
        "checks":          checks,
        "pii_files":       pii_files,
        "summary":         summary,
        "recommendations": recommendations,
    }
