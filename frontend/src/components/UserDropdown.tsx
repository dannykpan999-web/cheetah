import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Settings, HelpCircle, LogOut, Shield } from 'lucide-react'
import { logout } from '../api/client'

interface Props { onClose: () => void }

export default function UserDropdown({ onClose }: Props) {
  const ref      = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const user     = JSON.parse(localStorage.getItem('user') || '{}')
  const initials = (user.full_name || user.email || 'U')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const planMap: Record<string, string> = {
    starter:'Starter', professional:'Profissional', enterprise:'Enterprise',
  }
  const roleMap: Record<string, string> = {
    owner:'Proprietário', admin:'Administrador', viewer:'Visualizador',
  }
  const plan = planMap[user.plan] || 'Starter'
  const role = roleMap[user.role] || user.role || ''

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  function go(path: string) { navigate(path); onClose() }

  const ITEMS = [
    { Icon: User,       label:'Meu Perfil',    sub:'Editar informações',    action: () => go('/app/profile')               },
    { Icon: Settings,   label:'Configurações', sub:'Preferências da conta', action: () => go('/app/profile?tab=settings')  },
    { Icon: HelpCircle, label:'Suporte',       sub:'Central de ajuda',      action: () => {}                               },
  ]

  return (
    <div ref={ref} style={{
      position:'absolute', top:'calc(100% + 10px)', right:0,
      width:268,
      background:'#141929',
      border:'1px solid rgba(255,255,255,.08)',
      borderRadius:16,
      boxShadow:'0 28px 72px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03)',
      overflow:'hidden', zIndex:200,
      fontFamily:"'Inter','Segoe UI',sans-serif",
      animation:'ud-in .2s cubic-bezier(.22,1,.36,1)',
    }}>
      <style>{`
        @keyframes ud-in {
          from { opacity:0; transform:translateY(-8px) scale(.98); }
          to   { opacity:1; transform:translateY(0)    scale(1);   }
        }
      `}</style>

      {/* ── User info card ── */}
      <div style={{ padding:'18px 18px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" style={{
              width:46, height:46, borderRadius:'50%', objectFit:'cover', flexShrink:0,
              boxShadow:'0 4px 16px rgba(245,146,27,.25)',
              border:'2px solid rgba(245,146,27,.3)',
            }}/>
          ) : (
            <div style={{
              width:46, height:46, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,#F5921B,#D96820)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:17, fontWeight:800, color:'#fff',
              boxShadow:'0 4px 16px rgba(245,146,27,.3)',
            }}>{initials}</div>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{
              color:'#F1F5F9', fontWeight:700, fontSize:14, marginBottom:2,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {user.full_name || 'Usuário'}
            </p>
            <p style={{
              color:'#475569', fontSize:12,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {user.email || ''}
            </p>
          </div>
        </div>

        {/* Plan + role badges */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12 }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5,
            background:'rgba(245,146,27,.15)', border:'1px solid rgba(245,146,27,.3)',
            color:'#F5921B', fontSize:11, fontWeight:700,
            padding:'3px 10px', borderRadius:20,
          }}>
            <Shield size={10}/> {plan}
          </span>
          {role && (
            <span style={{
              color:'#475569', fontSize:12,
              background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)',
              padding:'3px 9px', borderRadius:20,
            }}>{role}</span>
          )}
        </div>
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>

      {/* ── Menu items ── */}
      <div style={{ padding:'8px' }}>
        {ITEMS.map(({ Icon, label, sub, action }) => (
          <button key={label} onClick={action} style={{
            display:'flex', alignItems:'center', gap:12, width:'100%',
            padding:'9px 10px', borderRadius:10,
            background:'none', border:'none', cursor:'pointer',
            transition:'background .15s', textAlign:'left',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <div style={{
              width:34, height:34, borderRadius:9, flexShrink:0,
              background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#64748B',
            }}>
              <Icon size={15}/>
            </div>
            <div>
              <p style={{ color:'#E2E8F0', fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>{label}</p>
              <p style={{ color:'#475569', fontSize:11.5, lineHeight:1.3 }}>{sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>

      {/* ── Logout ── */}
      <div style={{ padding:'8px' }}>
        <button onClick={logout} style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          width:'100%', padding:'11px', borderRadius:10,
          background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.14)',
          color:'#F87171', fontSize:13.5, fontWeight:600,
          cursor:'pointer', transition:'background .15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,.08)')}
        >
          <LogOut size={14}/> Sair da conta
        </button>
      </div>
    </div>
  )
}
