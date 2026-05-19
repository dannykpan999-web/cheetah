import os
import re
import base64
import hashlib
import math
import json
import smtplib
import logging
from collections import Counter
from datetime import timezone
from datetime import datetime as dt
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, any_role
from ..models import ScanResult, User, Tenant, AuditLog
from ..database import get_db
from ..config import settings

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
    """Try ClamAV scan. Returns virus name string or None if clean/unavailable."""
    try:
        import clamd
        cd = clamd.ClamdNetworkSocket(host="clamav", port=3310, timeout=10)
        result = cd.instream(content)
        status = result.get("stream", ("OK", None))
        if status[0] == "FOUND":
            return status[1]  # virus name
    except Exception:
        pass
    return None


def _scan_custom(content: bytes, filename: str) -> dict:
    """Cheetah's own signature-based engine (magic bytes + patterns + entropy)."""
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
    """Detect Brazilian PII in text-extractable content for LGPD compliance."""
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
    Produce a deterministic base64 token that mimics an RFC-3161 TimeStampToken.
    Payload: sha256(file_hash + scanned_at + "CHEETAH-DOCAS-BRIDGE").
    When the real DOCAS TSA API is available (Phase 4), swap this call for the
    actual TSA response — the field name and storage are already in place.
    """
    raw = f"{file_hash}|{scanned_at}|CHEETAH-DOCAS-BRIDGE-v1"
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    payload = {
        "version":    1,
        "policy":     "1.3.6.1.4.1.99999.1",   # placeholder OID — replace with DOCAS OID
        "messageImprint": {"hashAlgorithm": "sha256", "hashedMessage": file_hash},
        "serialNumber": int(token_hash[:8], 16),
        "genTime":    scanned_at,
        "tsa":        "CHEETAH/DOCAS-BRIDGE (Phase 3 — TSA pending Phase 4)",
        "token":      token_hash,
    }
    return base64.b64encode(json.dumps(payload).encode()).decode()


def scan_file(content: bytes, filename: str) -> dict:
    """Run ClamAV first, fall back to custom engine. Merge results."""
    mime = _get_mime(content)
    threats: list[str] = []
    risk = "low"

    # ClamAV pass
    clam_hit = _scan_clamav(content)
    if clam_hit:
        threats.append(f"ClamAV: {clam_hit}")
        risk = _max_risk(risk, "critical")

    # Custom engine pass (always runs — catches what ClamAV misses)
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
    """Store quarantined file in /var/cheetah/quarantine/<tenant>/<hash>."""
    try:
        qdir = f"/var/cheetah/quarantine/{tenant_id}"
        os.makedirs(qdir, exist_ok=True)
        qpath = os.path.join(qdir, f"{file_hash}_{filename}")
        with open(qpath, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.warning("Quarantine write failed: %s", e)


def _send_threat_email(db: Session, tenant_id, file_name: str, threats: list[str], risk_level: str):
    """Send threat alert email to tenant owner/admin if SMTP configured."""
    smtp_host = getattr(settings, "SMTP_HOST", None)
    smtp_from = getattr(settings, "SMTP_FROM", None)
    if not smtp_host or not smtp_from:
        return
    try:
        owner = (
            db.query(User)
            .filter(User.tenant_id == tenant_id, User.role.in_(["owner", "admin"]), User.is_active == True)
            .first()
        )
        if not owner:
            return
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        tenant_name = tenant.name if tenant else "sua empresa"

        body = (
            f"⚠️ Ameaça detectada em {tenant_name}\n\n"
            f"Arquivo: {file_name}\n"
            f"Risco: {risk_level.upper()}\n\n"
            f"Detecções:\n" + "\n".join(f"  • {t}" for t in threats) +
            f"\n\nAcesse o painel: https://cheetah.technology/app/scanner"
        )
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = f"[Cheetah] ⚠️ Ameaça detectada: {file_name}"
        msg["From"] = smtp_from
        msg["To"] = owner.email

        smtp_port = int(getattr(settings, "SMTP_PORT", 587))
        smtp_user = getattr(settings, "SMTP_USER", None)
        smtp_pass = getattr(settings, "SMTP_PASS", None)

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as s:
            s.starttls()
            if smtp_user and smtp_pass:
                s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_from, [owner.email], msg.as_string())
    except Exception as e:
        logger.warning("Email alert failed: %s", e)


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

    if threat_found:
        _send_threat_email(db, current_user.tenant_id, file.filename or "unknown",
                           result["threats"], result["risk_level"])

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
def list_results(db: Session = Depends(get_db), current_user: User = Depends(any_role)):
    rows = (
        db.query(ScanResult)
        .filter(ScanResult.tenant_id == current_user.tenant_id)
        .order_by(ScanResult.scanned_at.desc())
        .limit(100).all()
    )
    return [
        {
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
        for r in rows
    ]


@router.get("/quarantine")
def list_quarantine(db: Session = Depends(get_db), current_user: User = Depends(any_role)):
    rows = (
        db.query(ScanResult)
        .filter(ScanResult.tenant_id == current_user.tenant_id, ScanResult.quarantined == True)
        .order_by(ScanResult.scanned_at.desc())
        .all()
    )
    return [
        {
            "id":          str(r.id),
            "file_name":   r.file_name,
            "file_size":   r.file_size,
            "file_hash":   r.file_hash or "",
            "scan_status": r.scan_status,
            "threats":     json.loads(r.threats or "[]"),
            "risk_level":  r.risk_level,
            "scan_engine": r.scan_engine,
            "scanned_at":  r.scanned_at.isoformat(),
        }
        for r in rows
    ]


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
