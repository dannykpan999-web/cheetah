import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Building2, User, ChevronRight, ChevronLeft, CheckCircle, Zap } from 'lucide-react'
import api from '../api/client'

/* ── reuse same base CSS from LoginPage + register extras ────────────────── */
const STYLES = `
  @keyframes ct-card-in {
    from { opacity:0; transform:translateY(28px) scale(0.98); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }
  @keyframes ct-float {
    0%,100% { transform: translateY(0px);   }
    50%     { transform: translateY(-14px); }
  }
  @keyframes ct-pulse-glow {
    0%,100% { opacity:.35; transform:scale(1);    }
    50%     { opacity:.6;  transform:scale(1.06); }
  }
  @keyframes ct-flare {
    0%,100% { opacity:.5; }
    50%     { opacity:1;  }
  }
  @keyframes ct-shake {
    0%,100% { transform:translateX(0); }
    20%,60% { transform:translateX(-7px); }
    40%,80% { transform:translateX(7px);  }
  }
  @keyframes ct-spin-slow {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
  @keyframes ct-step-in {
    from { opacity:0; transform:translateX(24px); }
    to   { opacity:1; transform:translateX(0);    }
  }
  @keyframes ct-step-out {
    from { opacity:1; transform:translateX(0);    }
    to   { opacity:0; transform:translateX(-24px);}
  }
  @keyframes ct-success-pop {
    0%   { opacity:0; transform:scale(.5);  }
    70%  { transform:scale(1.12); }
    100% { opacity:1; transform:scale(1);   }
  }

  .ct-card       { animation: ct-card-in .55s cubic-bezier(.22,1,.36,1) both; }
  .ct-hero       { animation: ct-float 5s ease-in-out infinite; }
  .ct-glow       { animation: ct-pulse-glow 7s ease-in-out infinite; }
  .ct-flare      { animation: ct-flare 3s ease-in-out infinite; }
  .ct-shake      { animation: ct-shake .4s ease; }
  .ct-step-in    { animation: ct-step-in .3s cubic-bezier(.22,1,.36,1) both; }
  .ct-success    { animation: ct-success-pop .5s cubic-bezier(.22,1,.36,1) both; }

  .fl-group  { position:relative; }
  .fl-input  {
    background: rgba(10,14,26,.85);
    border: 1.5px solid rgba(255,255,255,.07);
    border-radius: 12px;
    padding: 22px 44px 8px 16px;
    color: #F1F5F9; font-size:14px;
    width:100%; outline:none;
    transition: border-color .2s, box-shadow .2s;
    caret-color: #F5921B;
  }
  .fl-input:focus {
    border-color: rgba(245,146,27,.55);
    box-shadow: 0 0 0 3.5px rgba(245,146,27,.11);
  }
  .fl-input.error {
    border-color: rgba(239,68,68,.55);
    box-shadow: 0 0 0 3.5px rgba(239,68,68,.1);
  }
  .fl-label {
    position:absolute; left:16px; top:15px;
    color:#475569; font-size:14px;
    pointer-events:none;
    transition: all .2s cubic-bezier(.22,1,.36,1);
  }
  .fl-input:focus ~ .fl-label,
  .fl-input:not(:placeholder-shown) ~ .fl-label {
    top:7px; font-size:10.5px; color:#F5921B; letter-spacing:.04em; font-weight:600;
  }

  .ct-btn {
    background: linear-gradient(135deg, #F5921B 0%, #E07A10 100%);
    border:none; border-radius:12px;
    color:#fff; font-weight:700; font-size:14px;
    padding:14px 24px; width:100%; cursor:pointer;
    transition: transform .15s, box-shadow .2s, opacity .2s;
    position:relative; overflow:hidden;
  }
  .ct-btn::after {
    content:'';
    position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,.15) 0%, transparent 60%);
    border-radius:inherit;
  }
  .ct-btn:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.01);
    box-shadow: 0 8px 28px rgba(245,146,27,.4);
  }
  .ct-btn:active:not(:disabled) { transform:scale(.98); }
  .ct-btn:disabled { opacity:.6; cursor:not-allowed; }

  .ct-btn-ghost {
    background: rgba(255,255,255,.04);
    border: 1.5px solid rgba(255,255,255,.08);
    border-radius:12px;
    color:#94A3B8; font-weight:600; font-size:14px;
    padding:13px 24px; cursor:pointer;
    transition: background .15s, color .15s;
  }
  .ct-btn-ghost:hover { background:rgba(255,255,255,.07); color:#F1F5F9; }

  /* slug preview */
  .slug-preview {
    font-size:12px; color:#475569; margin-top:6px; padding:0 4px;
  }
  .slug-preview span { color:#F5921B; font-weight:600; }

  /* plan card */
  .plan-card {
    border:1.5px solid rgba(255,255,255,.07);
    border-radius:12px; padding:14px;
    cursor:pointer; transition: border-color .2s, background .2s;
    background: rgba(10,14,26,.6);
  }
  .plan-card:hover { border-color:rgba(245,146,27,.3); background:rgba(245,146,27,.04); }
  .plan-card.selected { border-color:rgba(245,146,27,.6); background:rgba(245,146,27,.07); }

  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(245,146,27,.3); border-radius:8px; }
`

/* ── Network canvas (same as LoginPage) ──────────────────────────────────── */
interface Node { x:number; y:number; vx:number; vy:number }
function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const N = 52
    const nodes: Node[] = []
    const resize = () => { canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    for (let i=0; i<N; i++) nodes.push({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4,
    })
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      nodes.forEach(n => {
        n.x+=n.vx; n.y+=n.vy
        if (n.x<0||n.x>canvas.width)  n.vx*=-1
        if (n.y<0||n.y>canvas.height) n.vy*=-1
      })
      for (let i=0;i<N;i++) for (let j=i+1;j<N;j++) {
        const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y
        const d=Math.sqrt(dx*dx+dy*dy)
        if (d<110) {
          ctx.strokeStyle=`rgba(245,146,27,${(1-d/110)*.2})`
          ctx.lineWidth=.8; ctx.beginPath()
          ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.stroke()
        }
      }
      nodes.forEach(n => {
        ctx.fillStyle='rgba(245,146,27,.5)'; ctx.beginPath()
        ctx.arc(n.x,n.y,2.2,0,Math.PI*2); ctx.fill()
      })
      raf=requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  },[])
  return <canvas ref={ref} style={{ position:'absolute',inset:0,width:'100%',height:'100%' }}/>
}

/* ── Animated network-sphere SVG hero ────────────────────────────────────── */
function HeroVisual() {
  return (
    <div className="ct-hero" style={{ width:260, height:260, position:'relative', margin:'0 auto' }}>
      <div style={{
        position:'absolute', inset:-24, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(245,146,27,.16) 0%, transparent 70%)',
      }} className="ct-glow"/>
      <img src="/hero-register.png" alt=""
        onError={e=>{(e.target as HTMLImageElement).style.display='none'}}
        style={{ width:'100%',height:'100%',objectFit:'contain',position:'absolute',inset:0 }}
      />
      {/* SVG placeholder — network globe */}
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ width:'100%', height:'100%' }}>
        <defs>
          <radialGradient id="rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245,146,27,.2)"/>
            <stop offset="100%" stopColor="rgba(245,146,27,0)"/>
          </radialGradient>
        </defs>
        {/* outer circle */}
        <circle cx="100" cy="100" r="75" stroke="rgba(245,146,27,.2)" strokeWidth="1"/>
        <circle cx="100" cy="100" r="75" fill="url(#rg)"/>
        {/* latitude lines */}
        {[70,90,110,130].map(y=>(
          <ellipse key={y} cx="100" cy={y} rx={Math.sqrt(75*75-(y-100)*(y-100))} ry="10"
            stroke="rgba(245,146,27,.15)" strokeWidth=".8" fill="none"/>
        ))}
        {/* longitude lines */}
        <line x1="100" y1="25" x2="100" y2="175" stroke="rgba(245,146,27,.15)" strokeWidth=".8"/>
        <ellipse cx="100" cy="100" rx="30" ry="75" stroke="rgba(245,146,27,.15)" strokeWidth=".8" fill="none"/>
        <ellipse cx="100" cy="100" rx="55" ry="75" stroke="rgba(245,146,27,.15)" strokeWidth=".8" fill="none"/>
        {/* nodes at intersections */}
        {[
          [100,25],[100,175],[25,100],[175,100],
          [55,55],[145,55],[55,145],[145,145],
          [70,80],[130,80],[70,120],[130,120],
          [100,60],[100,140],[60,100],[140,100],
        ].map(([cx,cy],i)=>(
          <circle key={i} cx={cx} cy={cy} r="3" fill="rgba(245,146,27,.7)"/>
        ))}
        {/* connecting lines between some nodes */}
        {[
          [[100,25],[55,55]],[[100,25],[145,55]],
          [[25,100],[55,55]],[[25,100],[55,145]],
          [[175,100],[145,55]],[[175,100],[145,145]],
          [[100,175],[55,145]],[[100,175],[145,145]],
          [[70,80],[100,60]],[[130,80],[100,60]],
          [[70,120],[100,140]],[[130,120],[100,140]],
        ].map(([[x1,y1],[x2,y2]],i)=>(
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(245,146,27,.3)" strokeWidth=".8"/>
        ))}
        {/* center dot */}
        <circle cx="100" cy="100" r="5" fill="rgba(245,146,27,.9)"/>
        <circle cx="100" cy="100" r="9" fill="none" stroke="rgba(245,146,27,.3)" strokeWidth="1"/>
      </svg>
    </div>
  )
}

/* ── Step indicator ──────────────────────────────────────────────────────── */
function StepBar({ step }: { step: number }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:28 }}>
      {[1,2].map((s,i) => (
        <div key={s} style={{ display:'flex', alignItems:'center', flex:1 }}>
          <div style={{
            width:28, height:28, borderRadius:'50%', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700,
            background: step>=s ? 'linear-gradient(135deg,#F5921B,#E07A10)' : 'rgba(255,255,255,.06)',
            color: step>=s ? '#fff' : '#475569',
            border: step===s ? '2px solid rgba(245,146,27,.6)' : '1.5px solid rgba(255,255,255,.06)',
            boxShadow: step===s ? '0 0 12px rgba(245,146,27,.4)' : 'none',
            transition:'all .3s',
          }}>
            {step>s ? <CheckCircle size={14}/> : s}
          </div>
          {i===0 && (
            <div style={{
              flex:1, height:2, borderRadius:2, margin:'0 8px',
              background: step>1 ? 'linear-gradient(90deg,#F5921B,#E07A10)' : 'rgba(255,255,255,.06)',
              transition:'background .4s',
            }}/>
          )}
        </div>
      ))}
    </div>
  )
}

const PLANS = [
  { id:'starter',      label:'Starter',      price:'R$ 299/mês', desc:'Até 5 usuários · 1 sede' },
  { id:'professional', label:'Profissional',  price:'R$ 399/mês', desc:'Até 20 usuários · 3 sedes' },
  { id:'enterprise',   label:'Enterprise',   price:'R$ 458/mês', desc:'Ilimitado · multi-sede · suporte 24h' },
]

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')
}

export default function RegisterPage() {
  const navigate  = useNavigate()
  const [step, setStep]   = useState<1|2>(1)
  const [done, setDone]   = useState(false)
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  const [company, setCompany] = useState({
    name: '', slug: '', plan: 'starter',
  })
  const [account, setAccount] = useState({
    full_name: '', email: '', password: '', confirm: '',
  })

  const slugAuto = useRef(true)

  function setCompanyField(k: keyof typeof company, v: string) {
    if (k === 'name' && slugAuto.current) {
      setCompany(c => ({ ...c, name: v, slug: toSlug(v) }))
    } else {
      setCompany(c => ({ ...c, [k]: v }))
      if (k === 'slug') slugAuto.current = false
    }
  }

  function validateStep1() {
    if (!company.name.trim()) return 'Informe o nome da empresa'
    if (!company.slug.trim()) return 'Informe o ID da empresa'
    if (!/^[a-z0-9-]+$/.test(company.slug)) return 'ID deve conter apenas letras minúsculas, números e hífens'
    return ''
  }
  function validateStep2() {
    if (!account.email.trim()) return 'Informe o e-mail'
    if (account.password.length < 6) return 'Senha deve ter ao menos 6 caracteres'
    if (account.password !== account.confirm) return 'As senhas não coincidem'
    return ''
  }

  function nextStep(e: FormEvent) {
    e.preventDefault()
    const err = validateStep1()
    if (err) { setError(err); setShake(true); setTimeout(()=>setShake(false),450); return }
    setError(''); setStep(2)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err = validateStep2()
    if (err) { setError(err); setShake(true); setTimeout(()=>setShake(false),450); return }
    setError(''); setLoading(true)
    try {
      // 1. create tenant
      await api.post('/tenants', { name: company.name, slug: company.slug, plan: company.plan })
      // 2. create owner user
      await api.post(`/tenants/${company.slug}/users`, {
        email: account.email,
        password: account.password,
        full_name: account.full_name || undefined,
        role: 'owner',
      })
      setDone(true)
      // auto-login after 1.8s
      setTimeout(async () => {
        try {
          const { data } = await api.post('/auth/login', {
            email: account.email, password: account.password, tenant_slug: company.slug,
          })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          const me = await api.get('/auth/me')
          localStorage.setItem('user', JSON.stringify(me.data))
          navigate('/app')
        } catch { navigate('/login') }
      }, 1800)
    } catch (err: any) {
      const msg = err.response?.data?.detail
      setError(typeof msg==='string' ? msg : 'Erro ao criar conta. Tente novamente.')
      setShake(true); setTimeout(()=>setShake(false),450)
    } finally { setLoading(false) }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }}/>
      <div style={{ display:'flex', minHeight:'100vh', background:'#070B14', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

        {/* ── LEFT PANEL ─────────────────────────────────────────── */}
        <div style={{
          width:'45%', minHeight:'100vh', position:'relative',
          background:'linear-gradient(160deg,#0A0E1A 0%,#0D1020 100%)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          overflow:'hidden', padding:'40px 32px',
        }} className="ct-left-panel">
          <NetworkCanvas/>
          <div className="ct-glow" style={{
            position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)',
            width:360, height:360, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(245,146,27,.1) 0%, transparent 70%)',
            pointerEvents:'none',
          }}/>

          <div style={{ position:'relative', zIndex:2, textAlign:'center', width:'100%', maxWidth:360 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:40 }}>
              <img src="/logo-icon.png" alt="Cheetah" style={{ height:36 }}/>
              <span style={{ color:'#F1F5F9', fontWeight:800, fontSize:18, letterSpacing:-.3 }}>
                Cheetah Technology
              </span>
            </div>

            <HeroVisual/>

            <div style={{ marginTop:32 }}>
              <h2 style={{ color:'#F1F5F9', fontSize:22, fontWeight:800, letterSpacing:-.5, marginBottom:8 }}>
                Comece em <span style={{ color:'#F5921B' }}>minutos</span>
              </h2>
              <p style={{ color:'#475569', fontSize:13.5, lineHeight:1.6 }}>
                Configure sua empresa e tenha proteção completa desde o primeiro login
              </p>
            </div>

            <div style={{ marginTop:28, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                '✓  Sem cartão de crédito para começar',
                '✓  Setup em menos de 2 minutos',
                '✓  Cancelamento a qualquer momento',
              ].map(t => (
                <p key={t} style={{ color:'#475569', fontSize:13 }}>{t}</p>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────── */}
        <div style={{
          flex:1, display:'flex', alignItems:'center', justifyContent:'center',
          background:'#0B0F1A', padding:'40px 24px', position:'relative', overflow:'hidden',
        }}>
          <div style={{
            position:'absolute', bottom:'-10%', left:'-10%',
            width:400, height:400, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(245,146,27,.04) 0%, transparent 70%)',
            pointerEvents:'none',
          }}/>

          {done ? (
            /* ── Success screen ── */
            <div className="ct-card" style={{
              width:'100%', maxWidth:420, textAlign:'center',
              background:'rgba(255,255,255,.025)',
              border:'1px solid rgba(255,255,255,.07)',
              borderRadius:20, padding:'52px 36px',
              backdropFilter:'blur(20px)',
            }}>
              <div className="ct-success" style={{ marginBottom:20 }}>
                <div style={{
                  width:72, height:72, borderRadius:'50%', margin:'0 auto',
                  background:'rgba(34,197,94,.12)', border:'2px solid rgba(34,197,94,.35)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <CheckCircle size={36} style={{ color:'#22C55E' }}/>
                </div>
              </div>
              <h2 style={{ color:'#F1F5F9', fontSize:22, fontWeight:800, marginBottom:8 }}>
                Conta criada!
              </h2>
              <p style={{ color:'#475569', fontSize:14 }}>
                Entrando automaticamente em <span style={{ color:'#F5921B' }}>{company.slug}</span>...
              </p>
              <div style={{
                marginTop:24,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                color:'#475569', fontSize:13,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16"
                  style={{ animation:'ct-spin-slow 1s linear infinite' }}>
                  <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(245,146,27,.3)" strokeWidth="2"/>
                  <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="#F5921B" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Redirecionando para o painel...
              </div>
            </div>
          ) : (
            /* ── Form card ── */
            <div className={`ct-card${shake?' ct-shake':''}`} style={{
              width:'100%', maxWidth:440,
              background:'rgba(255,255,255,.025)',
              border:'1px solid rgba(255,255,255,.07)',
              borderRadius:20, padding:'36px',
              backdropFilter:'blur(20px)',
              boxShadow:'0 24px 64px rgba(0,0,0,.4)',
              position:'relative', overflow:'hidden',
            }}>
              {/* top flare */}
              <div className="ct-flare" style={{
                position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)',
                width:200, height:120,
                background:'radial-gradient(ellipse, rgba(245,146,27,.18) 0%, transparent 70%)',
                pointerEvents:'none',
              }}/>

              {/* heading */}
              <div style={{ textAlign:'center', marginBottom:28, position:'relative' }}>
                <img src="/logo-icon.png" alt="" style={{ height:36, marginBottom:10 }}/>
                <h1 style={{ color:'#F1F5F9', fontSize:22, fontWeight:800, letterSpacing:-.5, margin:0 }}>
                  Criar conta
                </h1>
                <p style={{ color:'#475569', fontSize:13, marginTop:6 }}>
                  {step===1 ? 'Dados da empresa' : 'Dados do administrador'}
                </p>
              </div>

              <StepBar step={step}/>

              {error && (
                <div style={{
                  marginBottom:16, padding:'11px 14px', borderRadius:10,
                  background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)',
                  color:'#FCA5A5', fontSize:13,
                }}>{error}</div>
              )}

              {/* ── STEP 1 ── */}
              {step===1 && (
                <form onSubmit={nextStep} className="ct-step-in">
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                    {/* Company name */}
                    <div className="fl-group">
                      <input className="fl-input" type="text" placeholder=" " required
                        value={company.name}
                        onChange={e=>setCompanyField('name', e.target.value)}/>
                      <label className="fl-label">Nome da Empresa</label>
                    </div>

                    {/* Slug */}
                    <div className="fl-group">
                      <input className="fl-input" type="text" placeholder=" " required
                        value={company.slug}
                        onChange={e=>{slugAuto.current=false; setCompanyField('slug', toSlug(e.target.value))}}/>
                      <label className="fl-label">ID da Empresa (slug)</label>
                      {company.slug && (
                        <p className="slug-preview">
                          URL de acesso: cheetah.technology/login · empresa: <span>{company.slug}</span>
                        </p>
                      )}
                    </div>

                    {/* Plan */}
                    <div>
                      <p style={{ color:'#475569', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
                        Plano
                      </p>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {PLANS.map(p=>(
                          <div key={p.id}
                            className={`plan-card${company.plan===p.id?' selected':''}`}
                            onClick={()=>setCompany(c=>({...c, plan:p.id}))}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div>
                                <p style={{ color:'#F1F5F9', fontWeight:700, fontSize:13.5 }}>{p.label}</p>
                                <p style={{ color:'#475569', fontSize:12, marginTop:2 }}>{p.desc}</p>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <p style={{ color:company.plan===p.id?'#F5921B':'#64748B', fontWeight:700, fontSize:13 }}>{p.price}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="ct-btn" style={{ marginTop:6 }}>
                      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                        Próximo <ChevronRight size={16}/>
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 2 ── */}
              {step===2 && (
                <form onSubmit={submit} className="ct-step-in">
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                    <div className="fl-group">
                      <input className="fl-input" type="text" placeholder=" "
                        value={account.full_name}
                        onChange={e=>setAccount(a=>({...a,full_name:e.target.value}))}/>
                      <label className="fl-label">Nome completo (opcional)</label>
                    </div>

                    <div className="fl-group">
                      <input className="fl-input" type="email" placeholder=" " required
                        value={account.email}
                        onChange={e=>setAccount(a=>({...a,email:e.target.value}))}/>
                      <label className="fl-label">E-mail do administrador</label>
                    </div>

                    <div className="fl-group">
                      <input className="fl-input" type={showPwd?'text':'password'} placeholder=" " required
                        value={account.password}
                        onChange={e=>setAccount(a=>({...a,password:e.target.value}))}
                        style={{ paddingRight:48 }}/>
                      <label className="fl-label">Senha</label>
                      <button type="button" onClick={()=>setShowPwd(v=>!v)} style={{
                        position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'#475569',
                        display:'flex', alignItems:'center',
                      }}>
                        {showPwd?<EyeOff size={16}/>:<Eye size={16}/>}
                      </button>
                    </div>

                    <div className="fl-group">
                      <input className="fl-input" type={showPwd2?'text':'password'} placeholder=" " required
                        value={account.confirm}
                        onChange={e=>setAccount(a=>({...a,confirm:e.target.value}))}
                        style={{ paddingRight:48 }}/>
                      <label className="fl-label">Confirmar senha</label>
                      <button type="button" onClick={()=>setShowPwd2(v=>!v)} style={{
                        position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'#475569',
                        display:'flex', alignItems:'center',
                      }}>
                        {showPwd2?<EyeOff size={16}/>:<Eye size={16}/>}
                      </button>
                    </div>

                    {/* terms */}
                    <p style={{ color:'#334155', fontSize:12, lineHeight:1.6 }}>
                      Ao criar sua conta você concorda com os{' '}
                      <span style={{ color:'#F5921B', cursor:'pointer' }}>Termos de Uso</span>
                      {' '}e{' '}
                      <span style={{ color:'#F5921B', cursor:'pointer' }}>Política de Privacidade</span>.
                    </p>

                    <div style={{ display:'flex', gap:10, marginTop:4 }}>
                      <button type="button" className="ct-btn-ghost" style={{ flex:'0 0 auto', width:52, padding:'13px 0' }}
                        onClick={()=>{setStep(1); setError('')}}>
                        <ChevronLeft size={16} style={{ display:'block', margin:'0 auto' }}/>
                      </button>
                      <button type="submit" disabled={loading} className="ct-btn" style={{ flex:1 }}>
                        {loading
                          ? <span style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                              <svg width="16" height="16" viewBox="0 0 16 16"
                                style={{ animation:'ct-spin-slow 1s linear infinite' }}>
                                <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2"/>
                                <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                              Criando conta...
                            </span>
                          : <span style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
                              Criar conta <Zap size={15}/>
                            </span>
                        }
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* login link */}
              <p style={{ textAlign:'center', color:'#475569', fontSize:13.5, marginTop:22 }}>
                Já tem conta?{' '}
                <Link to="/login" style={{ color:'#F5921B', fontWeight:700, textDecoration:'none' }}>
                  Entrar
                </Link>
              </p>
            </div>
          )}
        </div>

        <style>{`@media(max-width:768px){.ct-left-panel{display:none!important;}}`}</style>
      </div>
    </>
  )
}
