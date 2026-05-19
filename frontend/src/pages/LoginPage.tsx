import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Shield, Zap, Lock, ChevronRight } from 'lucide-react'
import api from '../api/client'

/* ── Injected CSS animations ─────────────────────────────────────────────── */
const STYLES = `
  @keyframes ct-card-in {
    from { opacity:0; transform:translateY(28px) scale(0.98); }
    to   { opacity:1; transform:translateY(0)   scale(1);    }
  }
  @keyframes ct-float {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%     { transform: translateY(-14px) rotate(1deg); }
  }
  @keyframes ct-pulse-glow {
    0%,100% { opacity:.35; transform:scale(1); }
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
  @keyframes ct-node-pulse {
    0%,100% { r:3; opacity:.7; }
    50%     { r:5; opacity:1;  }
  }
  @keyframes ct-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .ct-card     { animation: ct-card-in .55s cubic-bezier(.22,1,.36,1) both; }
  .ct-hero     { animation: ct-float 5s ease-in-out infinite; }
  .ct-glow     { animation: ct-pulse-glow 7s ease-in-out infinite; }
  .ct-flare    { animation: ct-flare 3s ease-in-out infinite; }
  .ct-shake    { animation: ct-shake .4s ease; }

  /* ── Floating label input ── */
  .fl-group    { position:relative; }
  .fl-input    {
    background: rgba(10,14,26,.85);
    border: 1.5px solid rgba(255,255,255,.07);
    border-radius: 12px;
    padding: 22px 44px 8px 16px;
    color: #F1F5F9;
    font-size: 14px;
    width: 100%;
    outline: none;
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
    position: absolute;
    left: 16px; top: 15px;
    color: #475569;
    font-size: 14px;
    pointer-events: none;
    transition: all .2s cubic-bezier(.22,1,.36,1);
    background: transparent;
  }
  .fl-input:focus ~ .fl-label,
  .fl-input:not(:placeholder-shown) ~ .fl-label {
    top: 7px; font-size: 10.5px; color: #F5921B; letter-spacing:.04em; font-weight:600;
  }

  /* ── CTA button ── */
  .ct-btn {
    background: linear-gradient(135deg, #F5921B 0%, #E07A10 100%);
    border: none; border-radius: 12px;
    color: #fff; font-weight: 700; font-size: 14px;
    padding: 14px 24px; width: 100%; cursor: pointer;
    transition: transform .15s, box-shadow .2s, opacity .2s;
    position: relative; overflow: hidden;
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

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(245,146,27,.3); border-radius:8px; }
`

/* ── Network canvas ──────────────────────────────────────────────────────── */
interface Node { x:number; y:number; vx:number; vy:number; }

function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const N = 48
    const nodes: Node[] = []
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)
    for (let i = 0; i < N; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - .5) * .45,
        vy: (Math.random() - .5) * .45,
      })
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1
      })
      // edges
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d  = Math.sqrt(dx*dx + dy*dy)
          if (d < 115) {
            const alpha = (1 - d/115) * .22
            ctx.strokeStyle = `rgba(245,146,27,${alpha})`
            ctx.lineWidth = .8
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      // nodes
      nodes.forEach(n => {
        ctx.fillStyle = 'rgba(245,146,27,.55)'
        ctx.beginPath()
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI*2)
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
}


/* ── Main component ──────────────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate  = useNavigate()
  const [form, setForm]       = useState({ email:'', password:'', tenant_slug:'' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake]     = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const me = await api.get('/auth/me')
      localStorage.setItem('user', JSON.stringify(me.data))
      navigate('/app')
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Credenciais inválidas. Verifique os dados.'
      setError(typeof msg === 'string' ? msg : 'Erro ao fazer login.')
      setShake(true); setTimeout(() => setShake(false), 450)
    } finally { setLoading(false) }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div style={{ display:'flex', minHeight:'100vh', background:'#070B14', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

        {/* ── LEFT PANEL ─────────────────────────────────────────── */}
        <div style={{
          width:'45%', minHeight:'100vh', position:'relative',
          background:'#0A0E1A',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
        }} className="ct-left-panel">
          {/* network canvas */}
          <NetworkCanvas />

          {/* hero image — full panel */}
          <img
            src="/hero-login.png"
            alt=""
            onError={e => { (e.target as HTMLImageElement).style.display='none' }}
            style={{
              position:'absolute', inset:0, width:'100%', height:'100%',
              objectFit:'contain', objectPosition:'center 42%',
              pointerEvents:'none', zIndex:1,
            }}
          />

          {/* top fade for logo readability */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:'30%',
            background:'linear-gradient(to bottom, rgba(10,14,26,.95) 0%, transparent 100%)',
            pointerEvents:'none', zIndex:2,
          }}/>

          {/* bottom fade for text readability */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:'48%',
            background:'linear-gradient(to top, rgba(10,14,26,1) 0%, rgba(10,14,26,.8) 50%, transparent 100%)',
            pointerEvents:'none', zIndex:2,
          }}/>

          {/* content */}
          <div style={{ position:'relative', zIndex:3, display:'flex', flexDirection:'column', minHeight:'100vh', padding:'40px 36px' }}>
            {/* logo */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <img src="/logo-icon.png" alt="Cheetah" style={{ height:36 }} />
              <span style={{ color:'#F1F5F9', fontWeight:800, fontSize:18, letterSpacing:-.3 }}>
                Cheetah Technology
              </span>
            </div>

            <div style={{ flex:1 }}/>

            {/* tagline + bullets */}
            <div>
              <h2 style={{ color:'#F1F5F9', fontSize:26, fontWeight:800, letterSpacing:-.5, marginBottom:8 }}>
                Blindagem Digital para <span style={{ color:'#F5921B' }}>PMEs</span>
              </h2>
              <p style={{ color:'#94A3B8', fontSize:13.5, lineHeight:1.6, marginBottom:24 }}>
                DNS Security · Endpoint Protection · Document Scanner
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  [Shield,  'Proteção DNS com AdGuard Home'],
                  [Zap,     'Detecção de endpoints com Wazuh'],
                  [Lock,    'Scanner LGPD + DOCAS Bridge'],
                ].map(([Icon, text], i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10,
                    background:'rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.08)',
                    borderRadius:10, padding:'10px 14px',
                  }}>
                    {/* @ts-ignore */}
                    <Icon size={15} style={{ color:'#F5921B', flexShrink:0 }} />
                    <span style={{ color:'#94A3B8', fontSize:13 }}>{text as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────── */}
        <div style={{
          flex:1, display:'flex', alignItems:'center', justifyContent:'center',
          background:'#0B0F1A', padding:'40px 24px', position:'relative', overflow:'hidden',
        }}>
          {/* subtle bg glow */}
          <div style={{
            position:'absolute', top:'-10%', right:'-10%',
            width:400, height:400, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(245,146,27,.05) 0%, transparent 70%)',
            pointerEvents:'none',
          }}/>

          {/* card */}
          <div className={`ct-card${shake ? ' ct-shake' : ''}`} style={{
            width:'100%', maxWidth:420,
            background:'rgba(255,255,255,.025)',
            border:'1px solid rgba(255,255,255,.07)',
            borderRadius:20, padding:'40px 36px',
            backdropFilter:'blur(20px)',
            boxShadow:'0 24px 64px rgba(0,0,0,.4)',
            position:'relative', overflow:'hidden',
          }}>
            {/* top flare */}
            <div className="ct-flare" style={{
              position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)',
              width:200, height:120,
              background:'radial-gradient(ellipse, rgba(245,146,27,.22) 0%, transparent 70%)',
              pointerEvents:'none',
            }}/>

            {/* heading */}
            <div style={{ textAlign:'center', marginBottom:32, position:'relative' }}>
              <img src="/logo-icon.png" alt="" style={{ height:40, marginBottom:12 }} />
              <h1 style={{ color:'#F1F5F9', fontSize:24, fontWeight:800, letterSpacing:-.5, margin:0 }}>
                Bem-vindo de volta
              </h1>
              <p style={{ color:'#475569', fontSize:13.5, marginTop:6 }}>
                Acesse sua plataforma de segurança
              </p>
            </div>

            {/* error */}
            {error && (
              <div style={{
                marginBottom:20, padding:'11px 14px', borderRadius:10,
                background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)',
                color:'#FCA5A5', fontSize:13,
              }}>{error}</div>
            )}

            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Empresa */}
              <div className="fl-group">
                <input className="fl-input" type="text" placeholder=" " required
                  value={form.tenant_slug} onChange={set('tenant_slug')} autoComplete="organization" />
                <label className="fl-label">ID da Empresa</label>
              </div>

              {/* Email */}
              <div className="fl-group">
                <input className="fl-input" type="email" placeholder=" " required
                  value={form.email} onChange={set('email')} autoComplete="email" />
                <label className="fl-label">E-mail</label>
              </div>

              {/* Password */}
              <div className="fl-group" style={{ position:'relative' }}>
                <input className="fl-input" type={showPwd ? 'text' : 'password'} placeholder=" " required
                  value={form.password} onChange={set('password')} autoComplete="current-password"
                  style={{ paddingRight:48 }} />
                <label className="fl-label">Senha</label>
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{
                    position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', color:'#475569',
                    display:'flex', alignItems:'center',
                  }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* CTA */}
              <button type="submit" disabled={loading} className="ct-btn" style={{ marginTop:6 }}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation:'ct-spin-slow 1s linear infinite' }}>
                        <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2"/>
                        <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Entrando...
                    </span>
                  : <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                      Entrar na plataforma <ChevronRight size={16} />
                    </span>
                }
              </button>
            </form>

            {/* divider */}
            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'24px 0 20px' }}>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,.07)' }}/>
              <span style={{ color:'#334155', fontSize:12 }}>ou</span>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,.07)' }}/>
            </div>

            {/* register link */}
            <p style={{ textAlign:'center', color:'#475569', fontSize:13.5 }}>
              Ainda não tem conta?{' '}
              <Link to="/register" style={{ color:'#F5921B', fontWeight:700, textDecoration:'none' }}>
                Criar conta gratuita
              </Link>
            </p>

            {/* demo credentials */}
            <div style={{
              marginTop:24, padding:'12px 14px', borderRadius:10,
              background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)',
            }}>
              <p style={{ color:'#334155', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                Contas demo
              </p>
              {[
                ['🏥', 'clinica-bemestar', 'admin@clinicabemestar.com.br', 'admin123'],
                ['🔧', 'oficina-santos', 'jose@oficinasantos.com.br', 'admin123'],
              ].map(([ic, slug, email, pwd]) => (
                <button key={slug} type="button"
                  onClick={() => setForm({ tenant_slug: slug, email, password: pwd })}
                  style={{
                    display:'block', width:'100%', textAlign:'left', marginBottom:4,
                    background:'none', border:'none', cursor:'pointer',
                    color:'#475569', fontSize:12, padding:'2px 0',
                    transition:'color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color='#94A3B8')}
                  onMouseLeave={e => (e.currentTarget.style.color='#475569')}
                >
                  {ic} <b style={{ color:'#64748B' }}>{slug}</b> · {email}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── hide left panel on small screens ── */}
        <style>{`@media(max-width:768px){.ct-left-panel{display:none!important;}}`}</style>
      </div>
    </>
  )
}
