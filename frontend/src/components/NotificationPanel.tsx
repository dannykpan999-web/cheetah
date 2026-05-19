import { useRef, useEffect } from 'react'
import { Bell, Filter, RefreshCw, X, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

interface Notification {
  id: string
  type: 'alert' | 'info' | 'success'
  title: string
  desc: string
  tag: string
  time: string
  read: boolean
}

const MOCK: Notification[] = [
  { id:'1', type:'alert',   title:'Ameaça DNS Bloqueada',        desc:'Domínio malicioso interceptado: malware-c2.xyz',      tag:'dns security',  time:'2m atrás',   read:false },
  { id:'2', type:'success', title:'Scan Concluído com Sucesso',  desc:'12 arquivos verificados · nenhuma ameaça detectada',  tag:'scanner',       time:'14m atrás',  read:false },
  { id:'3', type:'alert',   title:'PII Detectado no Documento',  desc:'CPF encontrado em contrato-agosto.pdf',               tag:'lgpd · docas',  time:'1h atrás',   read:false },
  { id:'4', type:'info',    title:'Novo Endpoint Registrado',    desc:'192.168.1.45 · Windows 11 · agent v3.2.1',            tag:'endpoint',      time:'3h atrás',   read:true  },
  { id:'5', type:'success', title:'Backup de Config. Concluído', desc:'Configurações DNS salvas com sucesso',                tag:'sistema',       time:'5h atrás',   read:true  },
  { id:'6', type:'alert',   title:'Tentativa de Acesso Negado',  desc:'Usuário bloqueado após 5 tentativas falhas',          tag:'autenticação',  time:'8h atrás',   read:true  },
]

const TYPE_CFG = {
  alert:   { bg:'rgba(239,68,68,.14)',  color:'#EF4444', Icon: AlertTriangle  },
  info:    { bg:'rgba(59,130,246,.14)', color:'#60A5FA', Icon: Info           },
  success: { bg:'rgba(34,197,94,.14)',  color:'#22C55E', Icon: CheckCircle2   },
}

interface Props { onClose: () => void }

export default function NotificationPanel({ onClose }: Props) {
  const ref  = useRef<HTMLDivElement>(null)
  const unread = MOCK.filter(n => !n.read).length

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const BTN = [
    { Icon: Filter,    tip: 'Filtrar'    },
    { Icon: RefreshCw, tip: 'Atualizar'  },
    { Icon: X,         tip: 'Fechar', onClick: onClose },
  ]

  return (
    <div ref={ref} style={{
      position:'absolute', top:'calc(100% + 10px)', right:0,
      width:380, maxHeight:520,
      background:'#141929',
      border:'1px solid rgba(255,255,255,.08)',
      borderRadius:16,
      boxShadow:'0 28px 72px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03)',
      display:'flex', flexDirection:'column',
      zIndex:200, overflow:'hidden',
      fontFamily:"'Inter','Segoe UI',sans-serif",
      animation:'np-in .2s cubic-bezier(.22,1,.36,1)',
    }}>
      <style>{`
        @keyframes np-in {
          from { opacity:0; transform:translateY(-8px) scale(.98); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'16px 18px 14px',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Bell size={15} style={{ color:'#F5921B' }}/>
          <span style={{ color:'#F1F5F9', fontWeight:700, fontSize:15 }}>Notificações</span>
          {unread > 0 && (
            <span style={{
              background:'rgba(245,146,27,.18)', color:'#F5921B',
              fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20,
              border:'1px solid rgba(245,146,27,.3)',
            }}>{unread} novas</span>
          )}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {BTN.map(({ Icon, tip, onClick }) => (
            <button key={tip} title={tip} onClick={onClick} style={{
              width:28, height:28, borderRadius:7,
              border:'1px solid rgba(255,255,255,.07)',
              background:'rgba(255,255,255,.04)', color:'#64748B',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', transition:'background .15s, color .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.color='#94A3B8' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.color='#64748B' }}
            >
              <Icon size={12}/>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display:'flex', gap:2, padding:'10px 14px 0',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        {(['Todas', 'Não lidas', 'Alertas'] as const).map((label, i) => (
          <button key={label} style={{
            padding:'7px 14px', borderRadius:'8px 8px 0 0',
            fontSize:12.5, fontWeight:600, border:'none', cursor:'pointer',
            background: i===0 ? 'rgba(245,146,27,.08)' : 'transparent',
            color: i===0 ? '#F5921B' : '#475569',
            borderBottom: i===0 ? '2px solid #F5921B' : '2px solid transparent',
            transition:'all .15s', position:'relative',
          }}>
            {label}
            {i===1 && unread>0 && (
              <span style={{
                marginLeft:5, background:'#F5921B', color:'#fff',
                fontSize:9.5, fontWeight:800, padding:'1px 5px', borderRadius:10,
                verticalAlign:'middle',
              }}>{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Notification list ── */}
      <div style={{ overflowY:'auto', flex:1 }}>
        {MOCK.map((n, i) => {
          const { bg, color, Icon } = TYPE_CFG[n.type]
          return (
            <div key={n.id} style={{
              display:'flex', gap:13, padding:'14px 18px',
              borderBottom: i < MOCK.length-1 ? '1px solid rgba(255,255,255,.04)' : 'none',
              background: n.read ? 'transparent' : 'rgba(245,146,27,.025)',
              cursor:'pointer', transition:'background .15s', position:'relative',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
              onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(245,146,27,.025)')}
            >
              {/* Unread left bar */}
              {!n.read && (
                <div style={{
                  position:'absolute', left:0, top:'22%', bottom:'22%',
                  width:3, borderRadius:'0 2px 2px 0', background:'#F5921B',
                }}/>
              )}

              {/* Icon circle */}
              <div style={{
                width:38, height:38, borderRadius:11, background:bg,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                <Icon size={17} style={{ color }}/>
              </div>

              {/* Text */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{
                  color:'#F1F5F9', fontSize:13, lineHeight:1.4,
                  fontWeight: n.read ? 500 : 700,
                }}>{n.title}</p>
                <p style={{ color:'#475569', fontSize:11.5, marginTop:2, lineHeight:1.4 }}>{n.desc}</p>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
                  <span style={{
                    fontSize:11, color:'#475569',
                    background:'rgba(255,255,255,.05)',
                    border:'1px solid rgba(255,255,255,.07)',
                    borderRadius:20, padding:'2px 9px',
                  }}>{n.tag}</span>
                  <span style={{ fontSize:11, color:'#334155' }}>{n.time}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding:'12px 18px', borderTop:'1px solid rgba(255,255,255,.06)',
        display:'flex', justifyContent:'center',
      }}>
        <button style={{
          background:'none', border:'none', cursor:'pointer',
          color:'#F5921B', fontSize:12.5, fontWeight:600,
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity='.7')}
          onMouseLeave={e => (e.currentTarget.style.opacity='1')}
        >
          Marcar todas como lidas
        </button>
      </div>
    </div>
  )
}
