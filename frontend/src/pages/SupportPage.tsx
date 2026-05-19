import { useState } from 'react'
import { HelpCircle, Mail, MessageCircle, BookOpen, ChevronDown, ChevronUp, ExternalLink, Shield } from 'lucide-react'
import api from '../api/client'

const C = {
  bg:     '#0B0F1A',
  card:   '#141929',
  border: 'rgba(255,255,255,0.07)',
  brd:    '1px solid rgba(255,255,255,0.07)',
  accent: '#F5921B',
  muted:  '#475569',
  sub:    '#94A3B8',
  text:   '#F1F5F9',
}

const FAQ = [
  {
    q: 'Como adicionar um novo endpoint ao monitoramento?',
    a: 'Acesse a página Endpoint, clique em "Novo Endpoint" e siga as instruções para instalar o agente Cheetah no dispositivo. O agente se comunica com o servidor via token seguro.',
  },
  {
    q: 'O que acontece quando uma ameaça é detectada no scanner?',
    a: 'O arquivo é automaticamente quarentenado em /var/cheetah/quarantine. Se você tiver alertas de e-mail ativados (Configurações > Preferências de notificação), um e-mail é enviado imediatamente ao administrador da conta.',
  },
  {
    q: 'Como funcionam as políticas de DNS?',
    a: 'Você pode criar políticas de blacklist (bloqueio) ou whitelist (permissão) por domínio. O servidor AdGuard Home integrado aplica essas políticas em tempo real para toda a rede do tenant.',
  },
  {
    q: 'O que é a detecção de PII / LGPD?',
    a: 'O scanner analisa o conteúdo dos arquivos em busca de dados pessoais brasileiros: CPF, CNPJ, RG, e-mail, telefone e número de cartão. Documentos com PII são sinalizados para revisão de conformidade com a LGPD.',
  },
  {
    q: 'Como alterar o plano da minha conta?',
    a: 'Entre em contato com nossa equipe pelo e-mail suporte@cheetah.technology ou através do chat abaixo. Nossa equipe de vendas irá orientá-lo sobre os planos disponíveis (Starter, Profissional, Enterprise).',
  },
  {
    q: 'Como exportar relatórios de segurança?',
    a: 'A exportação de relatórios em PDF e CSV está disponível no plano Profissional e Enterprise. Para solicitar acesso antecipado ou upgrade, entre em contato com o suporte.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: C.brd, borderRadius:12, overflow:'hidden',
      background: open ? 'rgba(245,146,27,.03)' : 'rgba(255,255,255,.02)',
      transition:'background .2s',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', background:'none', border:'none',
          cursor:'pointer', textAlign:'left',
        }}
      >
        <span style={{ color: C.text, fontSize:13.5, fontWeight:600, flex:1, paddingRight:16 }}>{q}</span>
        {open
          ? <ChevronUp size={15} style={{ color: C.accent, flexShrink:0 }}/>
          : <ChevronDown size={15} style={{ color: C.muted, flexShrink:0 }}/>
        }
      </button>
      {open && (
        <div style={{ padding:'0 20px 16px' }}>
          <p style={{ color: C.sub, fontSize:13, lineHeight:1.65, margin:0 }}>{a}</p>
        </div>
      )}
    </div>
  )
}

function ContactCard({
  Icon, title, desc, action, actionLabel, color = C.accent,
}: {
  Icon: any; title: string; desc: string; action: () => void; actionLabel: string; color?: string
}) {
  return (
    <div style={{
      background: C.card, border: C.brd, borderRadius:16, padding:'24px',
      display:'flex', flexDirection:'column', gap:16,
    }}>
      <div style={{
        width:48, height:48, borderRadius:14,
        background:`${color}18`, border:`1px solid ${color}30`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <Icon size={20} style={{ color }}/>
      </div>
      <div>
        <h3 style={{ color: C.text, fontSize:15, fontWeight:700, margin:'0 0 6px' }}>{title}</h3>
        <p style={{ color: C.muted, fontSize:13, lineHeight:1.6, margin:0 }}>{desc}</p>
      </div>
      <button
        onClick={action}
        style={{
          display:'inline-flex', alignItems:'center', gap:8, alignSelf:'flex-start',
          background:`${color}15`, border:`1px solid ${color}30`,
          color, fontSize:13, fontWeight:600,
          padding:'9px 18px', borderRadius:10, cursor:'pointer',
          transition:'background .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = `${color}25`)}
        onMouseLeave={e => (e.currentTarget.style.background = `${color}15`)}
      >
        {actionLabel} <ExternalLink size={12}/>
      </button>
    </div>
  )
}

export default function SupportPage() {
  const [ticket, setTicket] = useState({ subject:'', message:'' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [ticketErr, setTicketErr] = useState('')

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!ticket.subject.trim() || !ticket.message.trim()) return
    setSending(true); setTicketErr('')
    try {
      await api.post('/support/ticket', ticket)
      setSent(true)
      setTicket({ subject:'', message:'' })
    } catch {
      setTicketErr('Não foi possível enviar. Tente por e-mail diretamente.')
    } finally { setSending(false) }
  }

  return (
    <div style={{ padding:'28px 32px 48px', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <div style={{
            width:40, height:40, borderRadius:12,
            background:'rgba(245,146,27,.1)', border:'1px solid rgba(245,146,27,.2)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <HelpCircle size={18} style={{ color: C.accent }}/>
          </div>
          <h1 style={{ color: C.text, fontSize:22, fontWeight:800, letterSpacing:-.4, margin:0 }}>
            Central de suporte
          </h1>
        </div>
        <p style={{ color: C.muted, fontSize:13.5, marginTop:4 }}>
          Tire dúvidas, reporte problemas ou fale com nossa equipe
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,360px)', gap:24, alignItems:'start' }}>

        {/* Left column */}
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* FAQ */}
          <div style={{ background: C.card, border: C.brd, borderRadius:16, padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <BookOpen size={16} style={{ color: C.accent }}/>
              <h2 style={{ color: C.text, fontSize:15, fontWeight:700, margin:0 }}>
                Perguntas frequentes
              </h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {FAQ.map(({ q, a }) => <FaqItem key={q} q={q} a={a}/>)}
            </div>
          </div>

          {/* Contact form */}
          <div style={{ background: C.card, border: C.brd, borderRadius:16, padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <MessageCircle size={16} style={{ color: C.accent }}/>
              <h2 style={{ color: C.text, fontSize:15, fontWeight:700, margin:0 }}>
                Abrir chamado
              </h2>
            </div>

            {sent ? (
              <div style={{
                padding:'20px', borderRadius:12,
                background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.2)',
                color:'#22C55E', fontSize:13.5, fontWeight:600, textAlign:'center',
              }}>
                ✓ Chamado enviado com sucesso! Responderemos em até 24h.
              </div>
            ) : (
              <form onSubmit={submitTicket} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ display:'block', color: C.sub, fontSize:12, fontWeight:600, marginBottom:7, letterSpacing:'.04em' }}>
                    ASSUNTO
                  </label>
                  <input
                    value={ticket.subject}
                    onChange={e => setTicket(t => ({ ...t, subject: e.target.value }))}
                    placeholder="Ex.: Problema ao fazer upload de arquivo"
                    required
                    style={{
                      width:'100%', padding:'12px 14px',
                      background:'rgba(10,14,26,.7)',
                      border:'1.5px solid rgba(255,255,255,.08)',
                      borderRadius:12, color: C.text,
                      fontSize:14, outline:'none', boxSizing:'border-box',
                      transition:'border-color .2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor='rgba(245,146,27,.5)' }}
                    onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.08)' }}
                  />
                </div>
                <div>
                  <label style={{ display:'block', color: C.sub, fontSize:12, fontWeight:600, marginBottom:7, letterSpacing:'.04em' }}>
                    MENSAGEM
                  </label>
                  <textarea
                    value={ticket.message}
                    onChange={e => setTicket(t => ({ ...t, message: e.target.value }))}
                    placeholder="Descreva o problema em detalhes..."
                    required
                    rows={5}
                    style={{
                      width:'100%', padding:'12px 14px', resize:'vertical',
                      background:'rgba(10,14,26,.7)',
                      border:'1.5px solid rgba(255,255,255,.08)',
                      borderRadius:12, color: C.text,
                      fontSize:14, outline:'none', boxSizing:'border-box',
                      fontFamily:"'Inter','Segoe UI',sans-serif",
                      transition:'border-color .2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor='rgba(245,146,27,.5)' }}
                    onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.08)' }}
                  />
                </div>
                {ticketErr && (
                  <p style={{ color:'#FCA5A5', fontSize:12.5, margin:0 }}>{ticketErr}</p>
                )}
                <button type="submit" disabled={sending} style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, alignSelf:'flex-start',
                  background:'linear-gradient(135deg,#F5921B,#E07A10)',
                  border:'none', borderRadius:12, color:'#fff',
                  fontWeight:700, fontSize:14, padding:'12px 28px',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  opacity: sending ? .7 : 1,
                }}>
                  {sending ? 'Enviando...' : 'Enviar chamado'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <ContactCard
            Icon={Mail}
            title="E-mail"
            desc="Envie suas dúvidas ou reporte incidentes diretamente para nossa equipe técnica."
            action={() => window.open('mailto:suporte@cheetah.technology', '_blank')}
            actionLabel="suporte@cheetah.technology"
          />
          <ContactCard
            Icon={Shield}
            title="Segurança crítica"
            desc="Para vulnerabilidades ou incidentes críticos que requerem resposta imediata."
            action={() => window.open('mailto:security@cheetah.technology', '_blank')}
            actionLabel="security@cheetah.technology"
            color="#EF4444"
          />

          {/* SLA card */}
          <div style={{ background: C.card, border: C.brd, borderRadius:16, padding:'22px' }}>
            <h4 style={{ color: C.sub, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', margin:'0 0 14px' }}>
              Tempos de resposta
            </h4>
            {[
              { tier:'Crítico',      sla:'1h',   color:'#EF4444' },
              { tier:'Alto',         sla:'4h',   color:'#F97316' },
              { tier:'Médio',        sla:'24h',  color:'#EAB308' },
              { tier:'Baixo / FAQ',  sla:'48h',  color:'#22C55E' },
            ].map(({ tier, sla, color }) => (
              <div key={tier} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 0',
                borderBottom:'1px solid rgba(255,255,255,.05)',
              }}>
                <span style={{ color: C.sub, fontSize:13 }}>{tier}</span>
                <span style={{ color, fontSize:13, fontWeight:700 }}>{sla}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
