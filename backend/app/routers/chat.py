import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from ..dependencies import get_current_user
from ..models import User
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_PROMPT = """Você é o Cheetah AI, assistente de segurança inteligente da Cheetah Security Platform — uma plataforma SaaS de cibersegurança para PMEs brasileiras.

Você auxilia administradores com:
- DNS Security: monitoramento de domínios, listas negras, integração com AdGuard Home
- Scanner de Arquivos: motor ClamAV + Cheetah Engine para malware, macros VBA, executáveis suspeitos
- Detecção de PII / LGPD: CPF, CNPJ, RG, cartões, e-mail — conformidade com a LGPD
- Proteção de Endpoint: agente Wazuh, monitoramento de integridade (FIM), vulnerabilidades CVE, alertas
- Notificações: alertas por e-mail via Resend, preferências por tipo de evento
- Gestão de conta: perfil, senha, plano, funções (owner/admin/viewer)

Regras de comportamento:
- Responda sempre em Português do Brasil, a menos que o usuário escreva em inglês
- Seja conciso e direto — máximo de 180 palavras por resposta, salvo quando necessário
- NUNCA use símbolos de Markdown: sem #, sem ##, sem **, sem *, sem ___, sem backticks
- Para listas use hífen simples (-) no início da linha
- Para passos numerados use 1. 2. 3. sem nenhuma formatação extra
- Separe seções com uma linha em branco, nunca com títulos com #
- Nunca invente dados do sistema — oriente o usuário a verificar no painel
- Tom: profissional, técnico mas acessível, focado em segurança"""


class ChatMsg(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMsg] = []


@router.post("/message")
async def chat_message(
    body: ChatRequest,
    user: User = Depends(get_current_user),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "Assistente AI não configurado")

    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        raise HTTPException(503, "Biblioteca anthropic não instalada")

    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Keep last 20 messages to avoid token bloat
    history = body.history[-20:]
    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": body.message})

    async def generate():
        try:
            async with client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'t': text})}\n\n"
        except Exception as e:
            logger.error("AI stream error: %s", e)
            yield f"data: {json.dumps({'err': 'Erro ao processar resposta.'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
