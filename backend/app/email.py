import logging
from typing import Optional
from .config import settings

logger = logging.getLogger(__name__)

_COLORS = {
    "critical": "#EF4444",
    "high":     "#F97316",
    "medium":   "#EAB308",
    "low":      "#22C55E",
}

_RISK_LABEL = {
    "critical": "CRÍTICO",
    "high":     "ALTO",
    "medium":   "MÉDIO",
    "low":      "BAIXO",
}

def _base_html(title: str, preheader: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">{preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B0F1A;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0"
             style="background:#141929;border-radius:16px;border:1px solid rgba(255,255,255,.08);overflow:hidden;">

        <!-- Header -->
        <tr><td style="padding:24px 32px 20px;border-bottom:1px solid rgba(255,255,255,.06);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="font-size:20px;font-weight:800;color:#F1F5F9;">Cheetah</span>
                <span style="font-size:13px;font-weight:600;color:#F5921B;margin-left:8px;">Security</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">{body_html}</td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,.06);text-align:center;">
          <p style="color:#334155;font-size:11px;margin:0;line-height:1.6;">
            Cheetah Technology &nbsp;·&nbsp; Plataforma de Segurança Cibernética<br/>
            Para cancelar alertas, acesse <a href="https://cheetah.technology/app/profile?tab=settings"
              style="color:#F5921B;text-decoration:none;">Configurações da conta</a>.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_threat_alert(
    to_email: str,
    file_name: str,
    threats: list[str],
    risk_level: str,
    tenant_name: str,
) -> None:
    if not settings.RESEND_API_KEY:
        return
    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        color = _COLORS.get(risk_level, "#EF4444")
        label = _RISK_LABEL.get(risk_level, risk_level.upper())
        threat_rows = "".join(
            f'<tr><td style="padding:6px 0;color:#CBD5E1;font-size:13px;">• {t}</td></tr>'
            for t in threats
        )
        body = f"""
<p style="margin:0 0 6px;color:#F5921B;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
  Alerta de segurança
</p>
<h1 style="margin:0 0 20px;color:#F1F5F9;font-size:22px;font-weight:800;">
  ⚠️ Ameaça detectada
</h1>

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:12px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 4px;color:#94A3B8;font-size:11.5px;">Arquivo</p>
    <p style="margin:0;color:#F1F5F9;font-size:14px;font-weight:700;">{file_name}</p>
  </td></tr>
  <tr><td style="padding:0 20px 16px;">
    <p style="margin:0 0 4px;color:#94A3B8;font-size:11.5px;">Nível de risco</p>
    <span style="display:inline-block;background:{color}22;border:1px solid {color}44;color:{color};
                 font-size:12px;font-weight:800;padding:3px 12px;border-radius:20px;">{label}</span>
  </td></tr>
</table>

<p style="margin:0 0 12px;color:#94A3B8;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">
  Detecções ({len(threats)})
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;
              margin-bottom:28px;">
  <tr><td style="padding:14px 18px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">{threat_rows}</table>
  </td></tr>
</table>

<p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
  O arquivo foi quarentenado automaticamente pela plataforma Cheetah.
  Acesse o painel para revisar o incidente e tomar as devidas providências.
</p>

<a href="https://cheetah.technology/app/scanner"
   style="display:inline-block;background:linear-gradient(135deg,#F5921B,#D96820);
          color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;
          text-decoration:none;">
  Ver no painel →
</a>
"""
        resend.Emails.send({
            "from":    settings.RESEND_FROM,
            "to":      [to_email],
            "subject": f"[Cheetah] ⚠️ Ameaça detectada: {file_name} ({label})",
            "html":    _base_html(
                f"Ameaça detectada — {tenant_name}",
                f"Arquivo {file_name} contém {len(threats)} ameaça(s) com risco {label}.",
                body,
            ),
        })
    except Exception as e:
        logger.warning("Resend threat alert failed: %s", e)


def send_pii_alert(
    to_email: str,
    file_name: str,
    pii_findings: list[str],
    tenant_name: str,
) -> None:
    if not settings.RESEND_API_KEY:
        return
    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        pii_rows = "".join(
            f'<tr><td style="padding:5px 0;color:#CBD5E1;font-size:13px;">• {p}</td></tr>'
            for p in pii_findings
        )
        body = f"""
<p style="margin:0 0 6px;color:#60A5FA;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
  LGPD / Dados pessoais
</p>
<h1 style="margin:0 0 20px;color:#F1F5F9;font-size:22px;font-weight:800;">
  🔒 PII detectado no documento
</h1>

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:12px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 4px;color:#94A3B8;font-size:11.5px;">Arquivo</p>
    <p style="margin:0;color:#F1F5F9;font-size:14px;font-weight:700;">{file_name}</p>
  </td></tr>
</table>

<p style="margin:0 0 12px;color:#94A3B8;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">
  Tipos de PII encontrados
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;
              margin-bottom:28px;">
  <tr><td style="padding:14px 18px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">{pii_rows}</table>
  </td></tr>
</table>

<p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
  Dados pessoais identificados neste documento estão sujeitos à LGPD.
  Revise as permissões de acesso e classifique o documento adequadamente.
</p>

<a href="https://cheetah.technology/app/scanner"
   style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#2563EB);
          color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;
          text-decoration:none;">
  Ver no painel →
</a>
"""
        resend.Emails.send({
            "from":    settings.RESEND_FROM,
            "to":      [to_email],
            "subject": f"[Cheetah] 🔒 PII detectado: {file_name}",
            "html":    _base_html(
                f"PII detectado — {tenant_name}",
                f"Dados pessoais encontrados em {file_name}: {', '.join(pii_findings)}.",
                body,
            ),
        })
    except Exception as e:
        logger.warning("Resend PII alert failed: %s", e)
