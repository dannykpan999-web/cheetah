import os
import re
import csv
import io
import base64
import hashlib
import math
import json
import logging
from collections import Counter
from datetime import timezone
from datetime import datetime as dt
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, any_role
from ..models import ScanResult, User, Tenant, AuditLog
from ..database import get_db
from ..config import settings
from .. import email as email_svc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scanner", tags=["scanner"])

MAX_SIZE = 50 * 1024 * 1024  # 50 MB

RISKY_EXTENSIONS = {
    '.exe', '.dll', '.bat', '.cmd', '.vbs', '.ps1', '.msi',
    '.scr', '.pif', '.com', '.jar', '.hta', '.wsf', '.reg', '.sh',
}

RISK_ORDER = ["low", "medium", "high", "critical"]


def _max_risk(a: str, b: str) -> str:
    return b if RISK_ORDER.index(b) > RISK_ORDER.index(a) else a


def _get_mime(data: bytes) -> str:
    sigs = [
        (b'\x4D\x5A',          'application/x-dosexec'),
        (b'\x7fELF',           'application/x-elf'),
        (b'\x25\x50\x44\x46',  'application/pdf'),
        (b'\xD0\xCF\x11\xE0',  'application/vnd.ms-office'),
        (b'\x50\x4B\x03\x04',  'application/zip'),
        (b'\x89\x50\x4E\x47',  'image/png'),
        (b'\xFF\xD8\xFF',       'image/jpeg'),
        (b'\x47\x49\x46',      'image/gif'),
        (b'\x42\x4D',          'image/bmp'),
    ]
    for sig, mime in sigs:
        if data[:len(sig)] == sig:
            return mime
    if len(data) > 0 and all(c < 128 for c in data[:512]):
        return 'text/plain'
    return 'application/octet-stream'


def _calc_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    return -sum((c / total) * math.log2(c / total) for c in counts.values() if c > 0)


def _scan_clamav(content: bytes) -> Optional[str]:
    try:
        import clamd
        cd = clamd.ClamdNetworkSocket(host="clamav", port=3310, timeout=10)
        result = cd.instream(content)
        status = result.get("stream", ("OK", None))
        if status[0] == "FOUND":
            return status[1]
    except Exception:
        pass
    return None


def _scan_custom(content: bytes, filename: str) -> dict:
    threats: list[str] = []
    risk = "low"
    ext = os.path.splitext(filename.lower())[1]
    mime = _get_mime(content)

    if content[:2] == b'MZ':
        threats.append("Executável Windows (PE/EXE) detectado")
        risk = _max_risk(risk, "critical")

    if content[:4] == b'\x7fELF':
        threats.append("Binário executável Linux (ELF) detectado")
        risk = _max_risk(risk, "high")

    if content[:4] == b'\xD0\xCF\x11\xE0':
        macro_sigs = [b'VBA', b'_VBA_PROJECT', b'ThisWorkbook', b'AutoOpen', b'Document_Open']
        if any(sig in content for sig in macro_sigs):
            threats.append("Macro VBA maliciosa detectada em documento Office")
            risk = _max_risk(risk, "critical")
        else:
            threats.append("Documento Office formato legado (OLE) — verificar macros")
            risk = _max_risk(risk, "medium")

    if content[:4] == b'%PDF':
        if b'/JavaScript' in content or b'/JS ' in content:
            threats.append("JavaScript embutido em PDF — possível exploit de leitor")
            risk = _max_risk(risk, "critical")
        if b'/EmbeddedFile' in content:
            threats.append("Arquivo embutido em PDF detectado")
            risk = _max_risk(risk, "medium")
        if b'/OpenAction' in content or b'/AA ' in content:
            threats.append("Ação automática ao abrir PDF (AutoOpen/AA)")
            risk = _max_risk(risk, "high")

    if content[:4] == b'PK\x03\x04':
        if b'vbaProject.bin' in content or b'xl/vbaProject' in content:
            threats.append("Macro VBA em arquivo OOXML (.xlsm/.docm)")
            risk = _max_risk(risk, "high")

    if ext in RISKY_EXTENSIONS:
        threats.append(f"Extensão de arquivo de alto risco: {ext}")
        risk = _max_risk(risk, "high")

    if b'\x90\x90\x90\x90\x90\x90' in content:
        threats.append("Padrão NOP sled detectado — possível shellcode")
        risk = _max_risk(risk, "critical")

    sus_strings = [
        b'cmd.exe /c', b'powershell -enc', b'WScript.Shell',
        b'CreateObject("ADODB', b'Shell.Application', b'net user /add',
    ]
    found = [s.decode('latin-1') for s in sus_strings if s.lower() in content.lower()]
    if found:
        threats.append(f"Strings de comando suspeitas: {', '.join(found[:3])}")
        risk = _max_risk(risk, "high")

    sample = content[:8192] if len(content) > 8192 else content
    entropy = _calc_entropy(sample)
    if entropy > 7.6 and len(content) > 2048 and mime not in ('image/png', 'image/jpeg', 'image/gif'):
        threats.append(f"Alta entropia ({entropy:.2f}/8.0) — possível payload cifrado ou compactado")
        risk = _max_risk(risk, "medium")

    return {"threats": threats, "risk_level": risk, "mime_type": mime}


# ── PII / LGPD detection ──────────────────────────────────────────────────────

_PII_PATTERNS = [
    ("CPF",          r'\b\d{3}\.?\d{3}\.?\d{3}[-.\s]?\d{2}\b'),
    ("CNPJ",         r'\b\d{2}\.?\d{3}\.?\d{3}[/\\]?\d{4}[-.\s]?\d{2}\b'),
    ("RG",           r'\b\d{2}\.?\d{3}\.?\d{3}[-.\s]?\d{1}\b'),
    ("E-mail",       r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'),
    ("Telefone BR",  r'(\+55|55)?\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}\b'),
    ("Cartão",       r'\b(?:\d[ -]?){15,16}\b'),
]

def _scan_pii(content: bytes) -> dict:
    findings: list[str] = []
    try:
        text = content.decode('utf-8', errors='ignore')
    except Exception:
        return {"pii_detected": False, "pii_findings": []}

    seen: set[str] = set()
    for label, pattern in _PII_PATTERNS:
        if label in seen:
            continue
        if re.search(pattern, text):
            findings.append(label)
            seen.add(label)

    return {"pii_detected": bool(findings), "pii_findings": findings}


# ── DOCAS Evidence Bridge — RFC-3161-style timestamp token ───────────────────

def _generate_timestamp_token(file_hash: str, scanned_at: str) -> str:
    """
    When DOCAS_API_URL + DOCAS_API_KEY are set in .env, calls the real TSA.
    Until then, returns a deterministic stub token — same field name/storage.
    """
    if settings.DOCAS_API_URL and settings.DOCAS_API_KEY:
        try:
            import httpx
            resp = httpx.post(
                f"{settings.DOCAS_API_URL}/timestamp",
                json={"hash": file_hash, "algorithm": "sha256", "timestamp": scanned_at},
                headers={"Authorization": f"Bearer {settings.DOCAS_API_KEY}"},
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json().get("token", "")
        except Exception as exc:
            logger.warning("DOCAS TSA call failed, falling back to stub: %s", exc)

    # Stub — deterministic, verifiable locally
    raw = f"{file_hash}|{scanned_at}|CHEETAH-DOCAS-BRIDGE-v1"
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    payload = {
        "version":    1,
        "policy":     "1.3.6.1.4.1.99999.1",
        "messageImprint": {"hashAlgorithm": "sha256", "hashedMessage": file_hash},
        "serialNumber": int(token_hash[:8], 16),
        "genTime":    scanned_at,
        "tsa":        "CHEETAH/DOCAS-BRIDGE-STUB",
        "token":      token_hash,
    }
    return base64.b64encode(json.dumps(payload).encode()).decode()


def scan_file(content: bytes, filename: str) -> dict:
    mime = _get_mime(content)
    threats: list[str] = []
    risk = "low"

    clam_hit = _scan_clamav(content)
    if clam_hit:
        threats.append(f"ClamAV: {clam_hit}")
        risk = _max_risk(risk, "critical")

    custom = _scan_custom(content, filename)
    threats.extend(custom["threats"])
    risk = _max_risk(risk, custom["risk_level"])
    mime = custom["mime_type"]

    engine = "Cheetah Scanner v1.0 + ClamAV" if clam_hit is not None else "Cheetah Scanner v1.0"

    return {
        "threats": threats,
        "risk_level": risk,
        "scan_status": "threat_found" if threats else "clean",
        "mime_type": mime,
        "scan_engine": engine,
    }


def _quarantine_file(tenant_id: str, file_hash: str, content: bytes, filename: str):
    try:
        qdir = f"/var/cheetah/quarantine/{tenant_id}"
        os.makedirs(qdir, exist_ok=True)
        qpath = os.path.join(qdir, f"{file_hash}_{filename}")
        with open(qpath, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.warning("Quarantine write failed: %s", e)


def _notify_owner(db: Session, tenant_id, file_name: str, threats: list[str],
                  risk_level: str, pii_findings: list[str]) -> None:
    if not settings.RESEND_API_KEY:
        return
    owner = (
        db.query(User)
        .filter(User.tenant_id == tenant_id, User.role.in_(["owner", "admin"]), User.is_active == True)
        .first()
    )
    if not owner:
        return
    tenant      = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    tenant_name = tenant.name if tenant else "sua empresa"

    if threats and getattr(owner, "notif_email_threats", True):
        email_svc.send_threat_alert(owner.email, file_name, threats, risk_level, tenant_name)

    if pii_findings and getattr(owner, "notif_email_threats", True):
        email_svc.send_pii_alert(owner.email, file_name, pii_findings, tenant_name)


# ── Helper: serialize one ScanResult row ─────────────────────────────────────

def _row_dict(r: ScanResult) -> dict:
    return {
        "id":              str(r.id),
        "file_name":       r.file_name,
        "file_size":       r.file_size,
        "file_hash":       r.file_hash or "",
        "mime_type":       r.mime_type or "",
        "scan_status":     r.scan_status,
        "threats":         json.loads(r.threats or "[]"),
        "risk_level":      r.risk_level,
        "scan_engine":     r.scan_engine,
        "quarantined":     r.quarantined or False,
        "pii_detected":    r.pii_detected or False,
        "pii_findings":    json.loads(r.pii_findings or "[]"),
        "timestamp_token": r.timestamp_token or "",
        "scanned_at":      r.scanned_at.isoformat(),
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_scan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande. Limite máximo: 50 MB")

    file_hash = hashlib.sha256(content).hexdigest()
    result    = scan_file(content, file.filename or "unknown")
    pii       = _scan_pii(content)

    threat_found = result["scan_status"] == "threat_found"
    quarantined  = threat_found

    if quarantined:
        _quarantine_file(str(current_user.tenant_id), file_hash, content, file.filename or "unknown")

    scanned_at      = dt.now(timezone.utc).isoformat()
    timestamp_token = _generate_timestamp_token(file_hash, scanned_at)

    scan = ScanResult(
        tenant_id       = current_user.tenant_id,
        user_id         = current_user.id,
        file_name       = file.filename or "unknown",
        file_size       = len(content),
        file_hash       = file_hash,
        mime_type       = result["mime_type"],
        scan_status     = result["scan_status"],
        threats         = json.dumps(result["threats"], ensure_ascii=False),
        risk_level      = result["risk_level"],
        scan_engine     = result["scan_engine"],
        quarantined     = quarantined,
        pii_detected    = pii["pii_detected"],
        pii_findings    = json.dumps(pii["pii_findings"], ensure_ascii=False),
        timestamp_token = timestamp_token,
    )
    db.add(scan)

    db.add(AuditLog(
        tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="scan_file", resource=file.filename or "unknown"
    ))
    db.commit()
    db.refresh(scan)

    if threat_found or pii["pii_detected"]:
        _notify_owner(db, current_user.tenant_id, file.filename or "unknown",
                      result["threats"], result["risk_level"], pii["pii_findings"])

    return {
        "id":              str(scan.id),
        "file_name":       scan.file_name,
        "file_size":       scan.file_size,
        "file_hash":       file_hash,
        "mime_type":       result["mime_type"],
        "scan_status":     result["scan_status"],
        "threats":         result["threats"],
        "risk_level":      result["risk_level"],
        "scan_engine":     scan.scan_engine,
        "quarantined":     scan.quarantined,
        "pii_detected":    scan.pii_detected,
        "pii_findings":    pii["pii_findings"],
        "timestamp_token": timestamp_token,
        "scanned_at":      scan.scanned_at.isoformat(),
    }


@router.get("/results")
def list_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
    severity: Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
):
    q = db.query(ScanResult).filter(ScanResult.tenant_id == current_user.tenant_id)

    if severity and severity in RISK_ORDER:
        q = q.filter(ScanResult.risk_level == severity)
    if status and status in ("clean", "threat_found"):
        q = q.filter(ScanResult.scan_status == status)
    if date_from:
        try:
            q = q.filter(ScanResult.scanned_at >= dt.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(ScanResult.scanned_at <= dt.fromisoformat(date_to))
        except ValueError:
            pass

    rows = q.order_by(ScanResult.scanned_at.desc()).limit(500).all()
    return [_row_dict(r) for r in rows]


@router.get("/results/export")
def export_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
):
    """Export full scan history as CSV (UTF-8 BOM for Excel compatibility)."""
    rows = (
        db.query(ScanResult)
        .filter(ScanResult.tenant_id == current_user.tenant_id)
        .order_by(ScanResult.scanned_at.desc())
        .limit(1000).all()
    )
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["ID", "Arquivo", "Tamanho (bytes)", "Status", "Risco", "MIME",
                "Motor", "Quarentena", "PII / LGPD", "Ameacas", "Data"])
    for r in rows:
        threats = json.loads(r.threats or "[]")
        w.writerow([
            str(r.id), r.file_name, r.file_size,
            r.scan_status, r.risk_level, r.mime_type or "",
            r.scan_engine,
            "Sim" if r.quarantined else "Nao",
            "Sim" if r.pii_detected else "Nao",
            "; ".join(threats),
            r.scanned_at.strftime("%Y-%m-%d %H:%M:%S"),
        ])
    out.seek(0)
    return Response(
        content=out.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cheetah_scans.csv"},
    )


@router.get("/results/{result_id}/report")
def download_report(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
):
    """Generate and download a PDF report for one scan result."""
    row = (
        db.query(ScanResult)
        .filter(ScanResult.id == result_id, ScanResult.tenant_id == current_user.tenant_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Resultado não encontrado")

    try:
        from fpdf import FPDF
    except ImportError:
        raise HTTPException(503, "fpdf2 nao instalado — contate o suporte")

    threats      = json.loads(row.threats or "[]")
    pii_findings = json.loads(row.pii_findings or "[]")

    risk_rgb  = {"low": (16,185,129), "medium": (245,158,11), "high": (239,68,68), "critical": (124,58,237)}
    risk_lbl  = {"low": "BAIXO", "medium": "MEDIO", "high": "ALTO", "critical": "CRITICO"}
    status_lbl = {"clean": "LIMPO", "threat_found": "AMEACA DETECTADA"}

    class PDF(FPDF):
        def header(self):
            self.set_fill_color(11, 15, 26)
            self.rect(0, 0, 210, 38, 'F')
            self.set_text_color(245, 146, 27)
            self.set_font("Helvetica", "B", 16)
            self.set_xy(15, 10)
            self.cell(0, 8, "Cheetah Security Platform")
            self.set_text_color(148, 163, 184)
            self.set_font("Helvetica", "", 9)
            self.set_xy(15, 22)
            self.cell(0, 6, "Relatorio de Analise de Arquivo  |  DOCAS Evidence Bridge")
            self.set_text_color(30, 30, 30)
            self.ln(30)

        def footer(self):
            self.set_y(-15)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(150, 150, 150)
            now = dt.utcnow().strftime("%d/%m/%Y %H:%M UTC")
            self.cell(0, 5, f"Gerado em {now}  |  Cheetah Security Platform  |  cheetah.technology", align="C")

    pdf = PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_text_color(30, 30, 30)

    # File info table
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, "Informacoes do Arquivo", ln=True)
    pdf.set_line_width(0.1)
    for label, value in [
        ("Arquivo",      row.file_name[:80]),
        ("Tamanho",      f"{row.file_size:,} bytes  ({row.file_size/1024:.1f} KB)"),
        ("MIME Type",    row.mime_type or "desconhecido"),
        ("SHA-256",      (row.file_hash or "n/a")[:64]),
        ("Motor",        row.scan_engine),
        ("Analisado em", row.scanned_at.strftime("%d/%m/%Y %H:%M:%S UTC")),
    ]:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(220, 224, 235)
        pdf.cell(52, 7, label, border=1, fill=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_fill_color(248, 249, 252)
        pdf.cell(133, 7, str(value), border=1, fill=True, ln=True)

    pdf.ln(4)

    # Status + Risk boxes
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, "Resultado da Analise", ln=True)
    pdf.set_font("Helvetica", "B", 13)
    sl = status_lbl.get(row.scan_status, row.scan_status.upper())
    rl = risk_lbl.get(row.risk_level, row.risk_level.upper())
    rc = risk_rgb.get(row.risk_level, (100, 100, 100))

    if row.scan_status == "clean":
        pdf.set_fill_color(16, 185, 129)
    else:
        pdf.set_fill_color(239, 68, 68)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(88, 11, f"  {sl}", fill=True)
    pdf.set_fill_color(*rc)
    pdf.cell(88, 11, f"  Risco: {rl}", fill=True, ln=True)
    pdf.set_text_color(30, 30, 30)
    pdf.ln(4)

    # Threats
    if threats:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(200, 50, 50)
        pdf.cell(0, 7, f"Ameacas Detectadas ({len(threats)})", ln=True)
        pdf.set_text_color(30, 30, 30)
        pdf.set_font("Helvetica", "", 9)
        for t in threats:
            pdf.cell(5, 0)
            pdf.cell(0, 6, f"- {t[:110]}", ln=True)
    else:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(16, 185, 129)
        pdf.cell(0, 7, "Nenhuma ameaca detectada. Arquivo seguro.", ln=True)
        pdf.set_text_color(30, 30, 30)

    pdf.ln(3)

    # PII / LGPD
    if pii_findings:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(200, 100, 20)
        pdf.cell(0, 7, "Alerta LGPD  -  Dados Pessoais Detectados", ln=True)
        pdf.set_text_color(30, 30, 30)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 6, f"Tipos encontrados: {', '.join(pii_findings)}", ln=True)
        pdf.multi_cell(0, 5,
            "Recomendacao: Revisar o arquivo e aplicar controles de protecao de dados pessoais "
            "conforme a LGPD (Lei 13.709/2018).")

    pdf.ln(5)

    # DOCAS Evidence Bridge section
    pdf.set_draw_color(245, 146, 27)
    pdf.set_line_width(0.5)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(180, 100, 10)
    pdf.cell(0, 7, "DOCAS Evidence Bridge  -  Timestamp RFC-3161", ln=True)
    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", "", 8)
    token = row.timestamp_token or ""
    if token:
        pdf.multi_cell(0, 5, f"Token (primeiros 80 chars): {token[:80]}")
    docas_note = (
        "Integracao com DOCAS TSA ativa." if (settings.DOCAS_API_URL and settings.DOCAS_API_KEY)
        else "Stub local ativo — configure DOCAS_API_URL e DOCAS_API_KEY para habilitar TSA real."
    )
    pdf.set_text_color(120, 120, 120)
    pdf.set_font("Helvetica", "I", 7)
    pdf.cell(0, 5, docas_note, ln=True)

    pdf_bytes = bytes(pdf.output())
    safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in (row.file_name or "scan"))
    filename = f"cheetah_report_{safe[:50]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/quarantine")
def list_quarantine(db: Session = Depends(get_db), current_user: User = Depends(any_role)):
    rows = (
        db.query(ScanResult)
        .filter(ScanResult.tenant_id == current_user.tenant_id, ScanResult.quarantined == True)
        .order_by(ScanResult.scanned_at.desc())
        .all()
    )
    return [_row_dict(r) for r in rows]


@router.post("/quarantine/{result_id}/release")
def release_quarantine(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
):
    """Remove a file from quarantine (marks it as released, does not delete)."""
    row = (
        db.query(ScanResult)
        .filter(
            ScanResult.id == result_id,
            ScanResult.tenant_id == current_user.tenant_id,
            ScanResult.quarantined == True,
        )
        .first()
    )
    if not row:
        raise HTTPException(404, "Arquivo em quarentena nao encontrado")
    row.quarantined = False
    db.add(AuditLog(
        tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="quarantine_release", resource=row.file_name
    ))
    db.commit()
    return {"message": "Arquivo liberado da quarentena"}


@router.get("/stats")
def scan_stats(db: Session = Depends(get_db), current_user: User = Depends(any_role)):
    base = db.query(ScanResult).filter(ScanResult.tenant_id == current_user.tenant_id)
    return {
        "total_scanned": base.count(),
        "threats_found": base.filter(ScanResult.scan_status == "threat_found").count(),
        "clean_files":   base.filter(ScanResult.scan_status == "clean").count(),
        "quarantined":   base.filter(ScanResult.quarantined == True).count(),
        "pii_alerts":    base.filter(ScanResult.pii_detected == True).count(),
    }


@router.delete("/results/{result_id}")
def delete_result(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_role),
):
    row = (
        db.query(ScanResult)
        .filter(ScanResult.id == result_id, ScanResult.tenant_id == current_user.tenant_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Resultado não encontrado")
    db.delete(row)
    db.commit()
    return {"message": "Resultado removido"}
