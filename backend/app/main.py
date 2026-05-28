import secrets
import logging
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .database import engine, Base, get_db, SessionLocal
from .models import (Tenant, User, DnsPolicy, ScanResult,
                     Endpoint, EndpointAlert, EndpointVulnerability, ScanSchedule, DeviceDnsPolicy)
from .auth import hash_password
from .routers import auth, tenants, dns, scanner, audit, endpoints, chat, lgpd, billing, users, support
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Cheetah Security Platform API",
    version="2.0.0",
    description="Plataforma SaaS Multi-Tenant de Cibersegurança para PMEs",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cheetah.technology",
        "https://www.cheetah.technology",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/v1")
app.include_router(tenants.router,   prefix="/api/v1")
app.include_router(dns.router,       prefix="/api/v1")
app.include_router(scanner.router,   prefix="/api/v1")
app.include_router(audit.router,     prefix="/api/v1")
app.include_router(endpoints.router, prefix="/api/v1")
app.include_router(chat.router,      prefix="/api/v1")
app.include_router(lgpd.router,      prefix="/api/v1")
app.include_router(billing.router,   prefix="/api/v1")
app.include_router(users.router,     prefix="/api/v1")
app.include_router(support.router,   prefix="/api/v1")

@app.on_event("startup")
def seed_demo_data():
    db: Session = SessionLocal()
    try:
        if db.query(Tenant).count() > 0:
            _seed_scan_results(db)
            _seed_endpoints(db)
            return
        # ── Tenant 1: Clínica Bem Estar ──
        t1 = Tenant(name="Clínica Bem Estar", slug="clinica-bemestar", plan="professional")
        db.add(t1); db.flush()
        db.add(User(tenant_id=t1.id, email="admin@clinicabemestar.com.br",
                    hashed_password=hash_password("admin123"),
                    full_name="Dr. Carlos Lima", role="owner"))
        db.add(User(tenant_id=t1.id, email="recepcao@clinicabemestar.com.br",
                    hashed_password=hash_password("viewer123"),
                    full_name="Ana Souza", role="viewer"))
        for d in ["malware.com", "phishing-bank.net", "ransomware-host.ru"]:
            db.add(DnsPolicy(tenant_id=t1.id, domain=d, policy_type="blacklist", category="malware"))
        db.add(DnsPolicy(tenant_id=t1.id, domain="clinicabemestar.com.br",
                         policy_type="whitelist", category="corporate"))
        # ── Tenant 2: Oficina Santos ──
        t2 = Tenant(name="Oficina Santos", slug="oficina-santos", plan="starter")
        db.add(t2); db.flush()
        db.add(User(tenant_id=t2.id, email="jose@oficinasantos.com.br",
                    hashed_password=hash_password("admin123"),
                    full_name="José Santos", role="owner"))
        for d in ["adware-tracker.com", "fake-update.net"]:
            db.add(DnsPolicy(tenant_id=t2.id, domain=d, policy_type="blacklist", category="adware"))
        db.commit()
        _seed_scan_results(db, t1_id=t1.id, t2_id=t2.id)
        _seed_endpoints(db, t1_id=t1.id, t2_id=t2.id)
        db.commit()
    finally:
        db.close()


def _seed_scan_results(db: Session, t1_id=None, t2_id=None):
    import json as _json
    if db.query(ScanResult).count() > 0:
        return
    if t1_id is None:
        t1 = db.query(Tenant).filter(Tenant.slug == "clinica-bemestar").first()
        t2 = db.query(Tenant).filter(Tenant.slug == "oficina-santos").first()
        if not t1 or not t2:
            return
        t1_id, t2_id = t1.id, t2.id
    demo = [
        ScanResult(tenant_id=t1_id, file_name="relatorio_financeiro_2025.pdf",
                   file_size=245_760, file_hash="a3f5c2d1e8b047903f2ca1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
                   mime_type="application/pdf", scan_status="clean",
                   threats=_json.dumps([]), risk_level="low", quarantined=False),
        ScanResult(tenant_id=t1_id, file_name="curriculo_ana_souza.docx",
                   file_size=87_040, file_hash="b4c6d8e0f2a4c6e8a0b2d4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6",
                   mime_type="application/zip", scan_status="clean",
                   threats=_json.dumps([]), risk_level="low", quarantined=False),
        ScanResult(tenant_id=t1_id, file_name="update_sistema.exe",
                   file_size=1_048_576, file_hash="c5d7e9f1a3b5c7e9a1b3d5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7e9a1b3d5f7",
                   mime_type="application/x-dosexec", scan_status="threat_found",
                   threats=_json.dumps(["Executavel Windows (PE/EXE) detectado",
                                        "Strings de comando suspeitas: cmd.exe /c, powershell -enc"]),
                   risk_level="critical", quarantined=True),
        ScanResult(tenant_id=t1_id, file_name="planilha_pacientes_jan.xlsx",
                   file_size=52_224, file_hash="d6e8f0a2b4c6d8e0f2a4c6e8a0b2d4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8",
                   mime_type="application/zip", scan_status="clean",
                   threats=_json.dumps([]), risk_level="low", quarantined=False),
        ScanResult(tenant_id=t2_id, file_name="nota_fiscal_fornecedor.pdf",
                   file_size=112_640, file_hash="e7f9a1b3c5d7e9f1a3b5c7e9a1b3d5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7e9",
                   mime_type="application/pdf", scan_status="clean",
                   threats=_json.dumps([]), risk_level="low", quarantined=False),
        ScanResult(tenant_id=t2_id, file_name="driver_impressora_HP.exe",
                   file_size=3_145_728, file_hash="f8a0b2c4d6e8f0a2b4c6e8a0b2d4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6e8a0",
                   mime_type="application/x-dosexec", scan_status="threat_found",
                   threats=_json.dumps(["Executavel Windows (PE/EXE) detectado"]),
                   risk_level="critical", quarantined=True),
    ]
    for s in demo:
        db.add(s)
    db.commit()


def _seed_endpoints(db: Session, t1_id=None, t2_id=None):
    if db.query(Endpoint).count() > 0:
        return
    if t1_id is None:
        t1 = db.query(Tenant).filter(Tenant.slug == "clinica-bemestar").first()
        t2 = db.query(Tenant).filter(Tenant.slug == "oficina-santos").first()
        if not t1 or not t2:
            return
        t1_id, t2_id = t1.id, t2.id

    now = datetime.utcnow()

    # ── Clínica Bem Estar: 3 endpoints ──
    win = Endpoint(tenant_id=t1_id, agent_id="001", hostname="DESKTOP-DRCARLIMA",
                   os_type="windows", os_version="Windows 11 Pro 23H2",
                   ip_address="192.168.1.101", status="active", sca_score=78,
                   agent_token=secrets.token_hex(32),
                   last_heartbeat=now - timedelta(minutes=3),
                   registered_at=now - timedelta(days=14))
    db.add(win); db.flush()

    srv = Endpoint(tenant_id=t1_id, agent_id="002", hostname="ubuntu-server-01",
                   os_type="linux", os_version="Ubuntu 22.04.4 LTS",
                   ip_address="192.168.1.50", status="active", sca_score=92,
                   agent_token=secrets.token_hex(32),
                   last_heartbeat=now - timedelta(seconds=45),
                   registered_at=now - timedelta(days=30))
    db.add(srv); db.flush()

    mac = Endpoint(tenant_id=t1_id, agent_id="003", hostname="macbook-dra-ana",
                   os_type="macos", os_version="macOS 14.4 Sonoma",
                   ip_address="192.168.1.78", status="disconnected", sca_score=65,
                   agent_token=secrets.token_hex(32),
                   last_heartbeat=now - timedelta(hours=6),
                   registered_at=now - timedelta(days=7))
    db.add(mac); db.flush()

    # ── Alerts for Clínica ──
    db.add(EndpointAlert(tenant_id=t1_id, endpoint_id=win.id, rule_id="550",
                         severity="critical", category="fim",
                         description="Arquivo modificado em caminho crítico: C:\\Windows\\System32\\drivers\\etc\\hosts",
                         created_at=now - timedelta(hours=2)))
    db.add(EndpointAlert(tenant_id=t1_id, endpoint_id=win.id, rule_id="5710",
                         severity="high", category="intrusion",
                         description="Múltiplas tentativas de login falho detectadas (brute force SSH)",
                         created_at=now - timedelta(hours=5)))
    db.add(EndpointAlert(tenant_id=t1_id, endpoint_id=mac.id, rule_id="550",
                         severity="medium", category="fim",
                         description="Alteração de configuração detectada: /etc/sudoers",
                         created_at=now - timedelta(days=1)))

    # ── Vulnerabilities for Clínica ──
    db.add(EndpointVulnerability(tenant_id=t1_id, endpoint_id=win.id,
                                  cve_id="CVE-2024-21351", severity="critical",
                                  package="Microsoft Windows SmartScreen",
                                  version="10.0.22621", description="Bypass de segurança SmartScreen — permite execução de código arbitrário",
                                  detected_at=now - timedelta(days=5)))
    db.add(EndpointVulnerability(tenant_id=t1_id, endpoint_id=win.id,
                                  cve_id="CVE-2024-26169", severity="high",
                                  package="Windows Error Reporting Service",
                                  version="10.0.22621", description="Escalação de privilégio local via Windows Error Reporting",
                                  detected_at=now - timedelta(days=5)))
    db.add(EndpointVulnerability(tenant_id=t1_id, endpoint_id=win.id,
                                  cve_id="CVE-2024-21338", severity="high",
                                  package="Windows Kernel",
                                  version="10.0.22621", description="Escalação de privilégio no kernel do Windows",
                                  detected_at=now - timedelta(days=5)))
    db.add(EndpointVulnerability(tenant_id=t1_id, endpoint_id=srv.id,
                                  cve_id="CVE-2024-3094", severity="medium",
                                  package="liblzma5 (xz-utils)",
                                  version="5.4.1", description="Backdoor em xz-utils versão 5.6.x — comprometimento de autenticação SSH",
                                  detected_at=now - timedelta(days=10)))
    db.add(EndpointVulnerability(tenant_id=t1_id, endpoint_id=mac.id,
                                  cve_id="CVE-2024-23222", severity="medium",
                                  package="WebKit / Safari", version="17.2",
                                  description="Confusão de tipo em WebKit permitindo execução de código via página web maliciosa",
                                  detected_at=now - timedelta(days=3)))
    db.add(EndpointVulnerability(tenant_id=t1_id, endpoint_id=mac.id,
                                  cve_id="CVE-2024-23296", severity="medium",
                                  package="iOS / macOS RTKit", version="14.3",
                                  description="Corrupção de memória em RTKit — possível bypass de kernel protection",
                                  detected_at=now - timedelta(days=3)))

    # ── Oficina Santos: 1 endpoint ──
    win2 = Endpoint(tenant_id=t2_id, agent_id="001", hostname="PC-JOSE-SANTOS",
                    os_type="windows", os_version="Windows 10 Pro 22H2",
                    ip_address="10.0.0.5", status="active", sca_score=71,
                    agent_token=secrets.token_hex(32),
                    last_heartbeat=now - timedelta(minutes=12),
                    registered_at=now - timedelta(days=20))
    db.add(win2); db.flush()
    db.add(EndpointAlert(tenant_id=t2_id, endpoint_id=win2.id, rule_id="5710",
                         severity="high", category="intrusion",
                         description="Processo suspeito detectado: powershell.exe -hidden -enc ...",
                         created_at=now - timedelta(hours=1)))
    db.add(EndpointVulnerability(tenant_id=t2_id, endpoint_id=win2.id,
                                  cve_id="CVE-2024-21338", severity="high",
                                  package="Windows Kernel", version="10.0.19045",
                                  description="Escalação de privilégio no kernel do Windows",
                                  detected_at=now - timedelta(days=8)))
    db.commit()


@app.on_event("startup")
def start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        scheduler.add_job(_run_scan_schedules, "interval", hours=1, id="scan_schedules")
        scheduler.start()
        app.state.scheduler = scheduler
        logger.info("APScheduler started — scan schedule checker running every hour")
    except ImportError:
        logger.warning("apscheduler not installed — scheduled scans disabled")


def _run_scan_schedules():
    """Called every hour: send weekly summary email to tenants whose schedule is due."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        due = db.query(ScanSchedule).filter(
            ScanSchedule.enabled == True,
            ScanSchedule.next_run <= now,
        ).all()
        for sched in due:
            _send_weekly_summary(db, sched, now)
            # compute next run
            from .routers.scanner import _compute_next_run
            sched.last_run = now
            sched.next_run = _compute_next_run(sched)
            db.commit()
    except Exception as e:
        logger.error("scan schedule job error: %s", e)
    finally:
        db.close()


def _send_weekly_summary(db: Session, sched: ScanSchedule, now: datetime):
    """Send a weekly security summary email to the tenant owner."""
    try:
        from . import email as email_svc
        tenant = db.query(Tenant).filter(Tenant.id == sched.tenant_id).first()
        owner  = db.query(User).filter(
            User.tenant_id == sched.tenant_id, User.role == "owner"
        ).first()
        if not tenant or not owner:
            return

        one_week_ago = now - timedelta(days=7)
        base   = db.query(ScanResult).filter(ScanResult.tenant_id == sched.tenant_id)
        weekly = base.filter(ScanResult.scanned_at >= one_week_ago)

        total      = weekly.count()
        threats    = weekly.filter(ScanResult.scan_status == "threat_found").count()
        clean      = weekly.filter(ScanResult.scan_status == "clean").count()
        quarantine = weekly.filter(ScanResult.quarantined == True).count()
        pii        = weekly.filter(ScanResult.pii_detected == True).count()

        # reuse threat alert email as weekly digest (repurposed subject/body)
        if threats > 0:
            email_svc.send_threat_alert(
                to_email    = owner.email,
                file_name   = f"Resumo semanal — {total} arquivo(s) analisado(s)",
                threats     = [
                    f"{threats} arquivo(s) com ameaças detectadas",
                    f"{quarantine} arquivo(s) em quarentena",
                    f"{pii} alerta(s) LGPD / dados pessoais",
                    f"{clean} arquivo(s) limpos",
                ],
                risk_level  = "high" if threats > 0 else "low",
                tenant_name = tenant.name,
            )
        logger.info("Weekly summary sent to %s (%s)", owner.email, tenant.slug)
    except Exception as e:
        logger.warning("weekly summary email failed: %s", e)


@app.get("/api/v1/health")
def health():
    db = SessionLocal()
    try:
        return {
            "status": "ok",
            "version": "2.0.0",
            "tenant_count": db.query(Tenant).count(),
            "endpoint_count": db.query(Endpoint).count(),
        }
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Cheetah Security Platform API v2.0", "docs": "/docs"}
