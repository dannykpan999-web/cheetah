import { useState, FormEvent, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { User, Lock, Settings, Camera, Eye, EyeOff, Shield, Bell, Globe, Save, CheckCircle, Loader2 } from 'lucide-react'
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

/* ── Shared input ─────────────────────────────────────────────────────────── */
function Field({
  label, value, onChange, type = 'text', readOnly = false, hint,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  hint?: string
}) {
  return (
    <div>
      <label style={{ display:'block', color: C.sub, fontSize:12, fontWeight:600, marginBottom:7, letterSpacing:'.04em' }}>
        {label}
      </label>
      <input
        type={type} value={value} readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        style={{
          width:'100%', padding:'12px 14px',
          background: readOnly ? 'rgba(255,255,255,.02)' : 'rgba(10,14,26,.7)',
          border:`1.5px solid ${readOnly ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'}`,
          borderRadius:12, color: readOnly ? C.muted : C.text,
          fontSize:14, outline:'none', transition:'border-color .2s, box-shadow .2s',
          cursor: readOnly ? 'not-allowed' : 'text',
          boxSizing:'border-box',
        }}
        onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor='rgba(245,146,27,.5)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(245,146,27,.1)' }}
        onBlur={e => { e.currentTarget.style.borderColor=readOnly?'rgba(255,255,255,.04)':'rgba(255,255,255,.08)'; e.currentTarget.style.boxShadow='none' }}
      />
      {hint && <p style={{ color: C.muted, fontSize:11.5, marginTop:5 }}>{hint}</p>}
    </div>
  )
}

/* ── Toggle switch ────────────────────────────────────────────────────────── */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width:44, height:24, borderRadius:12, flexShrink:0,
      background: on ? '#F5921B' : 'rgba(255,255,255,.1)',
      border:'none', cursor:'pointer', position:'relative',
      transition:'background .25s',
    }}>
      <span style={{
        position:'absolute', top:3, left: on ? 23 : 3,
        width:18, height:18, borderRadius:'50%', background:'#fff',
        transition:'left .25s', boxShadow:'0 1px 4px rgba(0,0,0,.3)',
      }}/>
    </button>
  )
}

/* ── Save feedback ────────────────────────────────────────────────────────── */
function SaveBtn({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <button type="submit" disabled={loading} style={{
      display:'inline-flex', alignItems:'center', gap:8,
      background: saved ? 'rgba(34,197,94,.12)' : 'linear-gradient(135deg,#F5921B,#E07A10)',
      border: saved ? '1px solid rgba(34,197,94,.3)' : 'none',
      borderRadius:12, color: saved ? '#22C55E' : '#fff',
      fontWeight:700, fontSize:14, padding:'12px 26px',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? .7 : 1,
      transition:'all .3s',
    }}>
      {saved
        ? <><CheckCircle size={16}/> Salvo!</>
        : loading
          ? 'Salvando...'
          : <><Save size={15}/> Salvar alterações</>
      }
    </button>
  )
}

/* ── Profile tab ──────────────────────────────────────────────────────────── */
function ProfileTab() {
  const userRaw   = JSON.parse(localStorage.getItem('user') || '{}')
  const [user, setUser] = useState(userRaw)
  const initials  = (user.full_name || user.email || 'U')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const [name,       setName]      = useState(user.full_name || '')
  const [loading,    setLoading]   = useState(false)
  const [saved,      setSaved]     = useState(false)
  const [error,      setError]     = useState('')
  const [preview,    setPreview]   = useState<string | null>(null)
  const [uploading,  setUploading] = useState(false)
  const [uploadErr,  setUploadErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    uploadAvatar(file)
  }

  async function uploadAvatar(file: File) {
    setUploading(true); setUploadErr('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/auth/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      localStorage.setItem('user', JSON.stringify(data))
      setUser(data)
      setPreview(null)
    } catch (err: any) {
      setUploadErr(err.response?.data?.detail || 'Erro ao enviar imagem.')
      setPreview(null)
    } finally { setUploading(false) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.patch('/auth/me', { full_name: name })
      localStorage.setItem('user', JSON.stringify(data))
      setUser(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally { setLoading(false) }
  }

  const avatarSrc = preview || (user.avatar_url ? `${user.avatar_url}?t=${Date.now()}` : null)

  return (
    <form onSubmit={submit}>
      {/* Avatar section */}
      <div style={{
        display:'flex', alignItems:'center', gap:20,
        padding:'24px', background:C.card,
        border:C.brd, borderRadius:16, marginBottom:24,
      }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          {/* Avatar circle */}
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" style={{
              width:80, height:80, borderRadius:'50%', objectFit:'cover',
              boxShadow:'0 4px 20px rgba(245,146,27,.25)',
              border:'2px solid rgba(245,146,27,.3)',
            }}/>
          ) : (
            <div style={{
              width:80, height:80, borderRadius:'50%',
              background:'linear-gradient(135deg,#F5921B,#D96820)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28, fontWeight:800, color:'#fff',
              boxShadow:'0 4px 20px rgba(245,146,27,.3)',
            }}>{initials}</div>
          )}

          {/* Upload overlay */}
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            position:'absolute', bottom:0, right:0,
            width:28, height:28, borderRadius:'50%',
            background: uploading ? 'rgba(245,146,27,.9)' : C.card,
            border:`2px solid ${C.bg}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            color: uploading ? '#fff' : C.sub,
            transition:'background .2s',
          }}>
            {uploading
              ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/>
              : <Camera size={13}/>
            }
          </button>

          {/* Hidden file input */}
          <input
            ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display:'none' }} onChange={onFileChange}
          />
        </div>

        <div>
          <p style={{ color: C.text, fontWeight:700, fontSize:16, marginBottom:4 }}>
            {user.full_name || 'Usuário'}
          </p>
          <p style={{ color: C.muted, fontSize:13, marginBottom:8 }}>{user.email}</p>
          {uploadErr
            ? <p style={{ color:'#FCA5A5', fontSize:12 }}>{uploadErr}</p>
            : uploading
              ? <p style={{ color:'#F5921B', fontSize:12 }}>Enviando foto...</p>
              : <p style={{ color:'#334155', fontSize:12 }}>
                  Clique no ícone de câmera · JPG, PNG ou WebP · máx. 2MB
                </p>
          }
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* Form */}
      <div style={{
        background:C.card, border:C.brd, borderRadius:16, padding:'24px',
        marginBottom:24,
      }}>
        <h3 style={{ color: C.text, fontWeight:700, fontSize:15, marginBottom:20 }}>
          Informações pessoais
        </h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <Field label="Nome completo" value={name} onChange={setName} />
          <Field label="E-mail" value={user.email || ''} readOnly hint="Não é possível alterar o e-mail" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Função" value={user.role === 'owner' ? 'Proprietário' : user.role === 'admin' ? 'Administrador' : 'Visualizador'} readOnly />
          <Field label="Empresa (slug)" value={user.tenant_slug || ''} readOnly />
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:16, padding:'11px 14px', borderRadius:10,
          background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)',
          color:'#FCA5A5', fontSize:13 }}>{error}
        </div>
      )}

      <SaveBtn loading={loading} saved={saved}/>
    </form>
  )
}

/* ── Password tab ─────────────────────────────────────────────────────────── */
function PasswordTab() {
  const [form, setForm]     = useState({ current:'', newpwd:'', confirm:'' })
  const [show, setShow]     = useState({ current:false, newpwd:false, confirm:false })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const tog = (k: keyof typeof show)  => setShow(s => ({ ...s, [k]: !s[k] }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.newpwd !== form.confirm) { setError('As senhas não coincidem'); return }
    if (form.newpwd.length < 6) { setError('Nova senha deve ter ao menos 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      await api.patch('/auth/me/password', { current_password: form.current, new_password: form.newpwd })
      setForm({ current:'', newpwd:'', confirm:'' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao alterar senha.')
    } finally { setLoading(false) }
  }

  const PWD_FIELDS = [
    { key:'current', label:'Senha atual',          hint:undefined                },
    { key:'newpwd',  label:'Nova senha',           hint:'Mínimo de 6 caracteres' },
    { key:'confirm', label:'Confirmar nova senha', hint:undefined                },
  ] as const

  return (
    <form onSubmit={submit}>
      <div style={{ background:C.card, border:C.brd, borderRadius:16, padding:'24px', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'rgba(245,146,27,.1)', border:'1px solid rgba(245,146,27,.2)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Lock size={16} style={{ color:'#F5921B' }}/>
          </div>
          <div>
            <h3 style={{ color: C.text, fontWeight:700, fontSize:15, margin:0 }}>Alterar senha</h3>
            <p style={{ color: C.muted, fontSize:12, marginTop:2 }}>Sua senha deve ter ao menos 6 caracteres</p>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {PWD_FIELDS.map(({ key, label, hint }) => (
            <div key={key} style={{ position:'relative' }}>
              <label style={{ display:'block', color: C.sub, fontSize:12, fontWeight:600, marginBottom:7, letterSpacing:'.04em' }}>
                {label}
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={show[key] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={e => set(key)(e.target.value)}
                  required
                  style={{
                    width:'100%', padding:'12px 44px 12px 14px',
                    background:'rgba(10,14,26,.7)',
                    border:'1.5px solid rgba(255,255,255,.08)',
                    borderRadius:12, color: C.text,
                    fontSize:14, outline:'none', transition:'border-color .2s, box-shadow .2s',
                    boxSizing:'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor='rgba(245,146,27,.5)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(245,146,27,.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.08)'; e.currentTarget.style.boxShadow='none' }}
                />
                <button type="button" onClick={() => tog(key)} style={{
                  position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color: C.muted,
                  display:'flex', alignItems:'center',
                }}>
                  {show[key] ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              {hint && <p style={{ color: C.muted, fontSize:11.5, marginTop:5 }}>{hint}</p>}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:16, padding:'11px 14px', borderRadius:10,
          background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)',
          color:'#FCA5A5', fontSize:13 }}>{error}
        </div>
      )}

      <SaveBtn loading={loading} saved={saved}/>
    </form>
  )
}

/* ── Settings tab ─────────────────────────────────────────────────────────── */
function SettingsTab() {
  const userRaw = JSON.parse(localStorage.getItem('user') || '{}')
  const planMap: Record<string, string> = {
    starter:'Starter', professional:'Profissional', enterprise:'Enterprise',
  }
  const plan = planMap[userRaw.plan] || 'Starter'

  const [notifs, setNotifs] = useState({
    email_threats:  userRaw.notif_email_threats  ?? true,
    email_reports:  userRaw.notif_email_reports  ?? false,
    email_system:   userRaw.notif_email_system   ?? true,
    browser_alerts: userRaw.notif_browser_alerts ?? true,
  })
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)

  async function tog(k: keyof typeof notifs) {
    const next = { ...notifs, [k]: !notifs[k] }
    setNotifs(next)
    setSaving(true); setSaved(false)
    try {
      const { data } = await api.patch('/auth/me/notifications', {
        email_threats:  next.email_threats,
        email_reports:  next.email_reports,
        email_system:   next.email_system,
        browser_alerts: next.browser_alerts,
      })
      localStorage.setItem('user', JSON.stringify(data))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const NOTIF_ROWS = [
    { key:'email_threats',  Icon: Shield, label:'Alertas de ameaças por e-mail',   desc:'Notificações imediatas de DNS bloqueado, PII e anomalias'   },
    { key:'email_reports',  Icon: Bell,   label:'Relatórios semanais por e-mail',  desc:'Resumo semanal de atividade e eventos de segurança'         },
    { key:'email_system',   Icon: Globe,  label:'Notificações do sistema',         desc:'Atualizações de configuração, backups e status dos agentes' },
    { key:'browser_alerts', Icon: Bell,   label:'Alertas no navegador',            desc:'Notificações push para eventos críticos em tempo real'      },
  ] as const

  return (
    <div>
      {/* Plan card */}
      <div style={{
        background:'linear-gradient(135deg, rgba(245,146,27,.08) 0%, rgba(13,16,32,1) 100%)',
        border:'1px solid rgba(245,146,27,.2)', borderRadius:16, padding:'22px 24px',
        marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <Shield size={16} style={{ color:'#F5921B' }}/>
            <span style={{ color:'#F5921B', fontWeight:700, fontSize:14 }}>Plano {plan}</span>
          </div>
          <p style={{ color: C.sub, fontSize:13 }}>Sua assinatura está ativa</p>
        </div>
        <button style={{
          background:'rgba(245,146,27,.12)', border:'1px solid rgba(245,146,27,.3)',
          color:'#F5921B', fontSize:13, fontWeight:600,
          padding:'9px 18px', borderRadius:10, cursor:'pointer',
          transition:'background .15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background='rgba(245,146,27,.2)')}
          onMouseLeave={e => (e.currentTarget.style.background='rgba(245,146,27,.12)')}
        >
          Gerenciar plano
        </button>
      </div>

      {/* Notification settings */}
      <div style={{ background:C.card, border:C.brd, borderRadius:16, padding:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ color: C.text, fontWeight:700, fontSize:15, margin:0 }}>
            Preferências de notificação
          </h3>
          {saving && <span style={{ color:'#475569', fontSize:12 }}>Salvando...</span>}
          {!saving && saved && <span style={{ color:'#22C55E', fontSize:12, fontWeight:600 }}>✓ Salvo</span>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {NOTIF_ROWS.map(({ key, Icon, label, desc }) => (
            <div key={key} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 16px', borderRadius:12,
              background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.04)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{
                  width:36, height:36, borderRadius:10,
                  background:'rgba(245,146,27,.08)', border:'1px solid rgba(245,146,27,.15)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Icon size={15} style={{ color:'#F5921B' }}/>
                </div>
                <div>
                  <p style={{ color: C.text, fontSize:13.5, fontWeight:600 }}>{label}</p>
                  <p style={{ color: C.muted, fontSize:12, marginTop:2 }}>{desc}</p>
                </div>
              </div>
              <Toggle on={notifs[key]} onToggle={() => tog(key)}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const [searchParams] = useSearchParams()
  const initialTab     = searchParams.get('tab') === 'settings' ? 'settings' : 'profile'
  const [tab, setTab]  = useState<'profile'|'password'|'settings'>(initialTab as any)

  const TABS = [
    { id:'profile',  Icon: User,     label:'Perfil'          },
    { id:'password', Icon: Lock,     label:'Senha'           },
    { id:'settings', Icon: Settings, label:'Configurações'   },
  ] as const

  return (
    <div style={{ padding:'28px 32px 48px', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* Page header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color: C.text, fontSize:22, fontWeight:800, letterSpacing:-.4, margin:0 }}>
          Configurações da conta
        </h1>
        <p style={{ color: C.muted, fontSize:13.5, marginTop:6 }}>
          Gerencie seu perfil, senha e preferências da plataforma
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display:'flex', gap:4, marginBottom:28,
        borderBottom:'1px solid rgba(255,255,255,.07)', paddingBottom:0,
      }}>
        {TABS.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 18px', borderRadius:'10px 10px 0 0',
            border:'none', cursor:'pointer', fontSize:13.5, fontWeight:600,
            background: tab===id ? 'rgba(245,146,27,.08)' : 'transparent',
            color: tab===id ? '#F5921B' : C.muted,
            borderBottom: tab===id ? '2px solid #F5921B' : '2px solid transparent',
            transition:'all .15s',
          }}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,680px) 1fr', gap:24, alignItems:'start' }}>
        <div>
          {tab === 'profile'  && <ProfileTab/>}
          {tab === 'password' && <PasswordTab/>}
          {tab === 'settings' && <SettingsTab/>}
        </div>
        {/* Right sidebar — quick info panel */}
        <div style={{
          background:C.card, border:C.brd, borderRadius:16, padding:'22px',
          display:'flex', flexDirection:'column', gap:16,
        }}>
          <h4 style={{ color:C.sub, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', margin:0 }}>
            Informações da conta
          </h4>
          {[
            { label:'Plataforma',   value:'Cheetah Technology'          },
            { label:'Versão',       value:'2.0.0'                       },
            { label:'Status',       value:'Ativo ✓'                     },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:'flex', flexDirection:'column', gap:3 }}>
              <span style={{ color:C.muted, fontSize:11.5 }}>{label}</span>
              <span style={{ color:C.text,  fontSize:13.5, fontWeight:600 }}>{value}</span>
            </div>
          ))}
          <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ color:C.muted, fontSize:11.5 }}>Segurança</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:8, height:8, borderRadius:'50%', background:'#22C55E',
                boxShadow:'0 0 6px rgba(34,197,94,.6)',
              }}/>
              <span style={{ color:'#22C55E', fontSize:13, fontWeight:600 }}>2FA disponível</span>
            </div>
          </div>
          <div style={{ height:1, background:'rgba(255,255,255,.06)' }}/>
          <p style={{ color:'#334155', fontSize:11.5, lineHeight:1.6, margin:0 }}>
            Suas credenciais são criptografadas com bcrypt e seus tokens expiram automaticamente após 30 minutos de inatividade.
          </p>
        </div>
      </div>
    </div>
  )
}
