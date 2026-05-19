import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Globe, FileSearch, Monitor, ChevronRight,
  CheckCircle, Zap, Lock, Server, Code2, LayoutDashboard,
  Github, Linkedin, Twitter, Menu, X, ArrowRight,
  AlertTriangle, Wifi, HardDrive, Activity, Bell, Users,
  Play, ChevronDown, Star
} from 'lucide-react'

/* ─── canvas particles ─────────────────────────────────────── */
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf: number
    let particles: { x:number; y:number; vx:number; vy:number; r:number; a:number }[] = []
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    const init = () => {
      resize()
      particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.4, a: Math.random()
      }))
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245,146,27,${p.a * 0.6})`; ctx.fill()
      })
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d < 110) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(245,146,27,${(1 - d/110) * 0.14})`; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    init(); draw(); window.addEventListener('resize', init)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />
}

/* ─── scroll reveal ─────────────────────────────────────────── */
function useVisible(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useVisible()
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`
    }}>{children}</div>
  )
}

/* ─── badge ─────────────────────────────────────────────────── */
function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
      style={{ background: 'rgba(245,146,27,0.12)', color: '#F5921B', border: '1px solid rgba(245,146,27,0.25)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{text}
    </span>
  )
}

/* ─── accordion item ─────────────────────────────────────────── */
function AccordionItem({ num, title, desc }: { num: string; title: string; desc: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden transition-all cursor-pointer"
      style={{ background: open ? 'rgba(245,146,27,0.06)' : 'rgba(255,255,255,0.03)',
               border: open ? '1px solid rgba(245,146,27,0.2)' : '1px solid rgba(255,255,255,0.07)' }}
      onClick={() => setOpen(v => !v)}>
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: open ? '#F5921B' : 'rgba(255,255,255,0.15)' }}>{num}</span>
          <span className="font-semibold text-base" style={{ color: open ? '#F1F5F9' : '#94A3B8' }}>{title}</span>
        </div>
        <ChevronDown size={18} style={{ color: '#475569', transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </div>
      {open && (
        <div className="px-6 pb-5 pl-16">
          <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{desc}</p>
        </div>
      )}
    </div>
  )
}

const IMAGES = {
  hero:         'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1920&q=80',
  modules:      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80',
  architecture: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1920&q=80',
  pricing:      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=1920&q=80',
  cta:          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1920&q=80',
}

/* ══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const BRAND = '#F5921B'
  const DARK  = '#0A0F1E'
  const MID   = '#0F1A35'

  /* ── NAV ─────────────────────────────────────────────────── */
  const Nav = () => (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? 'rgba(10,15,30,0.95)' : 'transparent',
               backdropFilter: scrolled ? 'blur(16px)' : 'none',
               borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5">
          <img src="/logo-icon.png" alt="" style={{ height: 30 }} />
          <span className="text-white font-bold text-base hidden sm:block">Cheetah Technology</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Plataforma','Módulos','Preços','Docs'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              className="text-gray-400 hover:text-white text-sm transition-colors">{item}</a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-gray-400 hover:text-white text-sm transition-colors">Entrar</button>
          <button onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: BRAND, color: '#fff' }}>
            Começar Grátis →
          </button>
        </div>
        <button className="md:hidden text-white p-1" onClick={() => setMenuOpen(v => !v)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden px-5 pb-5 pt-2 space-y-3" style={{ background: 'rgba(10,15,30,0.98)' }}>
          {['Plataforma','Módulos','Preços','Docs'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              className="block text-gray-300 text-sm py-1" onClick={() => setMenuOpen(false)}>{item}</a>
          ))}
          <button onClick={() => navigate('/login')} className="w-full py-3 rounded-xl text-white text-sm font-semibold mt-2"
            style={{ background: BRAND }}>Começar Grátis →</button>
        </div>
      )}
    </nav>
  )

  /* ── HERO ────────────────────────────────────────────────── */
  const Hero = () => (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden text-center">
      {/* bg */}
      <img src={IMAGES.hero} alt="" aria-hidden
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.18) saturate(0.5)' }} />
      <div className="absolute inset-0" style={{
        background: `linear-gradient(180deg, ${DARK} 0%, rgba(10,15,30,0.6) 40%, rgba(10,15,30,0.85) 100%)`
      }} />

      {/* orange radial glow orb — Sentra/Customy style */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-10%' }}>
        <div style={{
          width: 700, height: 700,
          background: 'radial-gradient(circle, rgba(245,146,27,0.18) 0%, rgba(245,146,27,0.06) 40%, transparent 68%)',
          borderRadius: '50%', filter: 'blur(1px)'
        }} />
      </div>

      {/* subtle grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(245,146,27,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(245,146,27,0.6) 1px, transparent 1px)',
        backgroundSize: '64px 64px'
      }} />

      <ParticleCanvas />

      <div className="relative z-10 max-w-5xl mx-auto px-5 md:px-8 pt-28 pb-10 w-full">

        {/* badge */}
        <div className="mb-6">
          <Badge text="Plataforma SaaS Multi-Tenant · V1 Live" />
        </div>

        {/* giant headline — Customy/Sentra centered style */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          Cibersegurança<br />
          <span style={{ color: BRAND }}>para quem</span><br />
          importa.
        </h1>

        <p className="text-gray-400 text-base md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
          DNS inteligente, scanner de documentos e proteção de endpoint —<br className="hidden md:block" />
          tudo num dashboard único. Feito para PMEs brasileiras.
        </p>

        {/* dual CTA — Cyber Overwatch style */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <button onClick={() => navigate('/login')}
            className="px-8 py-4 rounded-2xl text-white font-bold text-base transition-all hover:scale-105 flex items-center gap-2 justify-center"
            style={{ background: BRAND, boxShadow: `0 0 40px rgba(245,146,27,0.35)` }}>
            Acessar Plataforma <ArrowRight size={18} />
          </button>
          <button className="px-8 py-4 rounded-2xl text-white font-semibold text-base transition-all hover:bg-white/10 flex items-center gap-2 justify-center"
            style={{ border: '1px solid rgba(255,255,255,0.18)' }}>
            <Play size={16} fill="white" /> Ver Demo
          </button>
        </div>

        {/* inline stats — Secura style */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mb-16">
          {[
            { value: '500+', label: 'PMEs Protegidas' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '1M+', label: 'Ameaças Bloqueadas' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl md:text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* dashboard screenshot — Customy style */}
        <div className="rounded-2xl overflow-hidden shadow-2xl mx-auto max-w-4xl"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#111827' }}>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: '#EF4444' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#F59E0B' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#10B981' }} />
            </div>
            <div className="flex-1 mx-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md text-xs text-gray-400 max-w-xs mx-auto"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Lock size={10} style={{ color: '#10B981' }} /> app.cheetah.technology
              </div>
            </div>
          </div>
          {/* dashboard UI preview */}
          <div className="flex" style={{ background: '#0B0F1A', minHeight: 420 }}>
            {/* sidebar */}
            <div className="hidden sm:flex w-44 flex-col shrink-0"
              style={{ background: '#0B0F1A', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                <img src="/logo-icon.png" alt="" style={{ height: 20 }} />
                <div>
                  <p className="font-bold leading-none" style={{ color: '#F1F5F9', fontSize: 11 }}>Cheetah</p>
                  <p className="font-medium" style={{ color: '#F5921B', fontSize: 9 }}>Technology</p>
                </div>
              </div>
              <p className="px-4 font-semibold mb-1.5 tracking-widest uppercase" style={{ color: '#475569', fontSize: 8 }}>GERAL</p>
              {[
                { icon: LayoutDashboard, label: 'Dashboard', active: true },
                { icon: Globe,           label: 'DNS',        active: false },
                { icon: FileSearch,      label: 'Scanner',    active: false },
                { icon: Monitor,         label: 'Endpoint',   active: false },
              ].map(({ icon: Icon, label, active }) => (
                <div key={label} className="flex items-center gap-2 mx-2 mb-0.5 px-3 py-2 rounded-lg"
                  style={{ background: active ? 'rgba(245,146,27,0.12)' : 'transparent',
                           color: active ? '#F1F5F9' : '#475569',
                           border: active ? '1px solid rgba(245,146,27,0.25)' : '1px solid transparent',
                           fontSize: 11 }}>
                  <Icon size={12} style={{ color: active ? '#F5921B' : '#475569', flexShrink: 0 }} /> {label}
                </div>
              ))}
              <div className="flex-1" />
              <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-white"
                    style={{ background: 'linear-gradient(135deg,#F5921B,#D96820)', fontSize: 8, flexShrink: 0 }}>DC</div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: '#F1F5F9', fontSize: 9 }}>Dr. Carlos Lima</p>
                    <p style={{ color: '#475569', fontSize: 8 }}>Proprietário</p>
                  </div>
                </div>
              </div>
            </div>
            {/* main content */}
            <div className="flex-1 p-4 overflow-hidden">
              {/* page header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold" style={{ color: '#F1F5F9', fontSize: 13 }}>Security Dashboard</p>
                  <p style={{ color: '#475569', fontSize: 10 }}>Bem-vindo, Dr. — seu sistema está sendo monitorado</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold"
                    style={{ background: '#F5921B', color: '#fff', fontSize: 9 }}>⚡ Executar Scan</div>
                  <div className="px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', fontSize: 9, border: '1px solid rgba(255,255,255,0.08)' }}>Exportar</div>
                </div>
              </div>
              {/* KPI row */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { icon: Globe,         label: 'DNS Bloqueados',       sub: 'domínios maliciosos', value: '0', color: '#EF4444', bars: [3,4,6,3,5,4,2] },
                  { icon: FileSearch,    label: 'Arquivos Analisados',   sub: 'total histórico',     value: '5', color: '#3B82F6', bars: [2,4,3,6,5,7,6] },
                  { icon: AlertTriangle, label: 'Ameaças Detectadas',    sub: 'arquivos maliciosos', value: '1', color: '#F59E0B', bars: [1,2,3,2,4,3,2] },
                  { icon: Activity,      label: 'Consultas DNS',         sub: 'total hoje',          value: '0', color: '#10B981', bars: [4,5,3,6,4,5,4] },
                ].map(({ icon: Icon, label, sub, value, color, bars }) => (
                  <div key={label} className="rounded-xl p-3 flex flex-col justify-between"
                    style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)', minHeight: 72 }}>
                    <div className="flex items-start justify-between">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}1A` }}>
                        <Icon size={12} style={{ color }} />
                      </div>
                      <div className="flex items-end gap-px" style={{ height: 20 }}>
                        {bars.map((h: number, i: number) => (
                          <div key={i} className="w-1 rounded-sm"
                            style={{ height: h * 2.5, background: i === bars.length - 1 ? color : `${color}50` }} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-1">
                      <p className="font-black leading-none" style={{ color, fontSize: 16 }}>{value}</p>
                      <p style={{ color: '#94A3B8', fontSize: 8, marginTop: 2 }}>{label}</p>
                      <p style={{ color: '#475569', fontSize: 7 }}>{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* middle row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {/* Security Score */}
                <div className="rounded-xl p-3" style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="font-semibold" style={{ color: '#F1F5F9', fontSize: 10 }}>Pontuação de Segurança</p>
                  <p style={{ color: '#475569', fontSize: 8, marginBottom: 6 }}>Baseado nos módulos ativos</p>
                  <div className="flex items-center gap-3">
                    <svg width="52" height="52" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle cx="26" cy="26" r="20" fill="none" stroke="#10B981" strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 20 * 0.87} ${2 * Math.PI * 20}`}
                        strokeDashoffset={2 * Math.PI * 20 * 0.25} strokeLinecap="round"
                        transform="rotate(-90 26 26)" />
                      <text x="26" y="23" textAnchor="middle" fill="white" style={{ fontSize: 11, fontWeight: 900 }}>B</text>
                      <text x="26" y="32" textAnchor="middle" fill="#475569" style={{ fontSize: 6.5 }}>87/100</text>
                    </svg>
                    <div className="space-y-1.5">
                      {[
                        { label: 'DNS Security', ok: true },
                        { label: 'Scanner', ok: true },
                        { label: 'Endpoint', ok: false },
                      ].map(({ label, ok }) => (
                        <div key={label} className="flex items-center gap-1" style={{ fontSize: 8.5 }}>
                          <span style={{ color: ok ? '#10B981' : '#F59E0B' }}>{ok ? '✓' : '⚠'}</span>
                          <span style={{ color: ok ? '#94A3B8' : '#F59E0B' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Risk by Category */}
                <div className="rounded-xl p-3" style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold" style={{ color: '#F1F5F9', fontSize: 10 }}>Risco por Categoria</p>
                    <span className="font-black" style={{ color: '#EF4444', fontSize: 13 }}>9</span>
                  </div>
                  {[
                    { label: 'Crítico', count: 1, pct: 11, color: '#EF4444' },
                    { label: 'Alto',    count: 2, pct: 22, color: '#F59E0B' },
                    { label: 'Médio',   count: 2, pct: 22, color: '#3B82F6' },
                    { label: 'Baixo',   count: 4, pct: 44, color: '#10B981' },
                  ].map(({ label, count, pct, color }) => (
                    <div key={label} className="mb-1.5">
                      <div className="flex justify-between mb-0.5" style={{ fontSize: 8, color: '#94A3B8' }}>
                        <span className="flex items-center gap-1">
                          <span className="rounded-full inline-block" style={{ width: 6, height: 6, background: color }} />
                          {label}
                        </span>
                        <span>{count} · {pct}%</span>
                      </div>
                      <div className="rounded-full" style={{ background: 'rgba(255,255,255,0.06)', height: 4 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Threat Classification */}
                <div className="rounded-xl p-3" style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="font-semibold mb-2" style={{ color: '#F1F5F9', fontSize: 10 }}>Classificação de Ameaças</p>
                  <div className="flex items-center gap-2">
                    <svg width="52" height="52" viewBox="0 0 52 52">
                      <circle cx="26" cy="26" r="18" fill="none" stroke="#1E2A3A" strokeWidth="8" />
                      {[
                        { pct: 0.11, color: '#EF4444', offset: 0 },
                        { pct: 0.44, color: '#10B981', offset: 0.11 },
                        { pct: 0.34, color: '#3B82F6', offset: 0.55 },
                        { pct: 0.11, color: '#8B5CF6', offset: 0.89 },
                      ].map(({ pct, color, offset }) => (
                        <circle key={color} cx="26" cy="26" r="18" fill="none" stroke={color} strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 18 * pct} ${2 * Math.PI * 18}`}
                          strokeDashoffset={-(2 * Math.PI * 18 * offset)}
                          transform="rotate(-90 26 26)" />
                      ))}
                      <text x="26" y="24" textAnchor="middle" fill="white" style={{ fontSize: 9, fontWeight: 900 }}>9</text>
                      <text x="26" y="32" textAnchor="middle" fill="#475569" style={{ fontSize: 6 }}>total</text>
                    </svg>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Malware',   count: 1, color: '#EF4444' },
                        { label: 'DNS Block', count: 0, color: '#3B82F6' },
                        { label: 'Limpos',    count: 4, color: '#10B981' },
                        { label: 'Outros',    count: 1, color: '#8B5CF6' },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="flex items-center gap-1.5" style={{ fontSize: 8.5 }}>
                          <div className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: color }} />
                          <span style={{ color: '#94A3B8' }}>{label}</span>
                          <span className="ml-auto font-bold" style={{ color: '#F1F5F9' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* bottom row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 rounded-xl p-3" style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="font-semibold mb-2" style={{ color: '#F1F5F9', fontSize: 10 }}>Últimas Análises de Arquivos</p>
                  <div className="grid grid-cols-4 pb-1 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Arquivo','Status','Risco','Data'].map(h => (
                      <p key={h} style={{ color: '#475569', fontSize: 7, fontWeight: 600 }}>{h}</p>
                    ))}
                  </div>
                  {[
                    { name: '123.md',                    status: 'Limpo',  sC: '#10B981', risk: 'Baixo',  rC: '#10B981', date: '17/05' },
                    { name: 'planilha_pacientes_jan.xlsx', status: 'Limpo', sC: '#10B981', risk: 'Baixo',  rC: '#10B981', date: '16/05' },
                    { name: 'update_sistema.exe',         status: 'Ameaça', sC: '#EF4444', risk: 'Crítico', rC: '#7C3AED', date: '16/05' },
                  ].map(({ name, status, sC, risk, rC, date }) => (
                    <div key={name} className="grid grid-cols-4 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="truncate font-mono" style={{ color: '#94A3B8', fontSize: 7 }}>{name}</span>
                      <span style={{ color: sC, fontSize: 7, fontWeight: 600 }}>{status}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${rC}20`, color: rC, fontSize: 7 }}>{risk}</span>
                      <span style={{ color: '#475569', fontSize: 7 }}>{date}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3" style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="font-semibold mb-2" style={{ color: '#F1F5F9', fontSize: 10 }}>Top DNS Bloqueados</p>
                  <div className="flex flex-col items-center justify-center" style={{ height: 60 }}>
                    <Globe size={20} style={{ color: '#2D3A4A' }} />
                    <p style={{ color: '#475569', fontSize: 8, marginTop: 4, textAlign: 'center' }}>Nenhum domínio<br />bloqueado ainda</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-white/40" />
        </div>
      </div>
    </section>
  )

  /* ── TRUST BAR ───────────────────────────────────────────── */
  const TrustBar = () => (
    <section style={{ background: DARK, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-5 flex flex-wrap items-center justify-center md:justify-between gap-5">
        {[
          { icon: Lock,        text: 'TLS 1.3 em todas as comunicações' },
          { icon: Server,      text: 'PostgreSQL Row-Level Security' },
          { icon: Shield,      text: 'Bases LGPD desde a V1' },
          { icon: Zap,         text: 'Deploy Docker em minutos' },
          { icon: CheckCircle, text: 'Multi-tenant com isolamento real' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-gray-400 text-xs">
            <Icon size={13} style={{ color: BRAND }} /><span>{text}</span>
          </div>
        ))}
      </div>
    </section>
  )

  /* ── HOW IT WORKS — Secura/numbered style ───────────────── */
  const HowItWorks = () => (
    <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: DARK }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(245,146,27,0.8) 0%, transparent 60%)'
      }} />
      <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8">
        <Reveal className="text-center mb-16 md:mb-20">
          <Badge text="Simples por design" />
          <h2 className="text-3xl md:text-5xl font-black text-white mt-4 mb-4">
            Em 3 passos sua<br />
            <span style={{ color: BRAND }}>empresa está protegida</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            Sem equipe de TI, sem hardware, sem complicação. Configure uma vez e esqueça.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* connecting line — desktop only */}
          <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,146,27,0.3), rgba(245,146,27,0.3), transparent)' }} />
          {[
            {
              num: '01', icon: Wifi, color: '#3B82F6',
              title: 'Conecte',
              desc: 'Configure em minutos via roteador ou agente leve para Windows, macOS e Linux. Zero hardware extra, zero infraestrutura nova.'
            },
            {
              num: '02', icon: Activity, color: BRAND,
              title: 'Analise',
              desc: 'O Cheetah monitora DNS, analisa arquivos por padrões maliciosos e vigia cada dispositivo 24 horas por dia, 7 dias por semana.'
            },
            {
              num: '03', icon: Shield, color: '#10B981',
              title: 'Proteja',
              desc: 'Ameaças bloqueadas antes de causar dano. Alertas em tempo real, relatórios automáticos e score de segurança atualizado.'
            },
          ].map(({ num, icon: Icon, color, title, desc }, i) => (
            <Reveal key={title} delay={i * 130}>
              <div className="rounded-2xl p-7 text-center flex flex-col items-center transition-all hover:-translate-y-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                    <Icon size={26} style={{ color }} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: DARK, border: `2px solid ${color}`, color }}>
                    {num.slice(1)}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )

  /* ── MODULES ─────────────────────────────────────────────── */
  const Modules = () => (
    <section id="módulos" className="py-24 md:py-32 relative overflow-hidden">
      <img src={IMAGES.modules} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.1) saturate(0.3)' }} />
      <div className="absolute inset-0" style={{ background: 'rgba(10,15,30,0.94)' }} />
      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8">
        <Reveal className="text-center mb-16 md:mb-20">
          <Badge text="Três módulos. Um dashboard." />
          <h2 className="text-3xl md:text-5xl font-black text-white mt-4 mb-4">
            Segurança completa,<br /><span style={{ color: BRAND }}>sem complexidade</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
            Cheetah Scanner, AdGuard DNS e Wazuh Endpoint orquestrados em um único produto coeso.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {[
            {
              icon: Globe, num: '01', title: 'Segurança DNS', color: '#3B82F6',
              desc: 'Bloqueio de domínios maliciosos, phishing e ransomware no nível do DNS — antes de qualquer conexão ser feita.',
              features: ['DoH e DoT habilitados', 'Blacklist/whitelist por empresa', 'Feeds RPZ diariamente', 'Ativação via roteador']
            },
            {
              icon: FileSearch, num: '02', title: 'Scanner de Documentos', color: BRAND,
              desc: 'Detecta vírus, ransomware e macros maliciosas dentro de PDFs, DOCX, ZIP e outros formatos comuns.',
              features: ['Magic bytes + YARA', 'Quarentena automática', 'API REST OpenAPI', 'Relatórios em PDF']
            },
            {
              icon: Monitor, num: '03', title: 'Proteção de Endpoint', color: '#10B981',
              desc: 'Monitoramento de integridade de arquivos, vulnerabilidades e configuração de segurança em cada dispositivo.',
              features: ['Windows/macOS/Linux', 'FIM em tempo real', 'Detecção de CVEs', 'SCA automático']
            },
          ].map(({ icon: Icon, num, title, desc, features, color }, i) => (
            <Reveal key={title} delay={i * 100}>
              <div className="rounded-2xl h-full p-7 flex flex-col transition-all hover:-translate-y-1 hover:shadow-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Icon size={22} style={{ color }} />
                  </div>
                  <span className="text-4xl font-black" style={{ color: `${color}20` }}>{num}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">{desc}</p>
                <ul className="space-y-2">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle size={13} style={{ color, flexShrink: 0 }} />{f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )

  /* ── STATS BENTO — Customy style ─────────────────────────── */
  const StatsBento = () => (
    <section className="py-16 md:py-24" style={{ background: DARK }}>
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="rounded-3xl p-8 md:p-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center"
            style={{ background: 'rgba(245,146,27,0.04)', border: '1px solid rgba(245,146,27,0.15)' }}>
            {[
              { value: '500+',   label: 'PMEs Protegidas',       color: BRAND },
              { value: '1M+',    label: 'Ameaças Bloqueadas',     color: '#EF4444' },
              { value: '99.9%',  label: 'Uptime Garantido',       color: '#10B981' },
              { value: '< 5min', label: 'Tempo de Configuração',  color: '#3B82F6' },
            ].map(({ value, label, color }) => (
              <div key={label}>
                <p className="text-3xl md:text-4xl font-black mb-1" style={{ color }}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )

  /* ── FEATURES ACCORDION — Cyber Overwatch style ─────────── */
  const FeaturesAccordion = () => (
    <section id="plataforma" className="py-24 md:py-32 relative overflow-hidden">
      <img src={IMAGES.architecture} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.12) saturate(0.4)' }} />
      <div className="absolute inset-0" style={{
        background: `linear-gradient(135deg, rgba(10,15,30,0.96) 0%, rgba(15,26,53,0.92) 100%)`
      }} />
      <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8">
        <div className="grid lg:grid-cols-2 gap-12 md:gap-16 items-start">
          <Reveal>
            <Badge text="Por que Cheetah" />
            <h2 className="text-3xl md:text-5xl font-black text-white mt-4 mb-6">
              Construída para<br /><span style={{ color: BRAND }}>escala desde o dia 1</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-8">
              Multi-tenancy com isolamento rigoroso. PostgreSQL com Row-Level Security garante que uma empresa nunca vê dados de outra.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Shield,       label: 'Isolamento Multi-Tenant',  desc: 'RLS no banco' },
                { icon: Server,       label: 'Docker-native',            desc: 'Compose + k3s' },
                { icon: HardDrive,    label: 'PostgreSQL',               desc: 'Row-Level Security' },
                { icon: Code2,        label: 'OpenAPI REST',             desc: '/docs automático' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl p-4 flex items-start gap-3 transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${BRAND}15` }}>
                    <Icon size={15} style={{ color: BRAND }} />
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">{label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Accordion — Cyber Overwatch style */}
          <Reveal delay={150}>
            <div className="space-y-3">
              {[
                { num: '01', title: 'Detecção em Tempo Real',
                  desc: 'O Cheetah analisa cada arquivo, consulta DNS e evento de sistema no momento em que ocorre — sem batch, sem delay.' },
                { num: '02', title: 'Resposta Automática',
                  desc: 'Ameaças são bloqueadas automaticamente. Você recebe o alerta depois que o problema já foi contido.' },
                { num: '03', title: 'Custo Acessível para PMEs',
                  desc: 'Preços projetados para pequenas e médias empresas, sem contratos anuais obrigatórios ou taxas escondidas.' },
                { num: '04', title: 'Conformidade LGPD',
                  desc: 'Arquitetura desenhada com LGPD desde o início. Logs de auditoria, isolamento de dados e políticas de retenção.' },
                { num: '05', title: 'Zero Infraestrutura',
                  desc: 'Sem servidores para gerenciar, sem VPNs para configurar. Agente leve de 20 MB, ativação em menos de 5 minutos.' },
              ].map(props => <AccordionItem key={props.num} {...props} />)}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )

  /* ── TESTIMONIAL ─────────────────────────────────────────── */
  const Testimonial = () => (
    <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: DARK }}>
      <div className="absolute inset-0 opacity-20" style={{
        background: 'radial-gradient(ellipse at 50% 100%, rgba(245,146,27,0.12) 0%, transparent 60%)'
      }} />
      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <div className="flex items-center justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="#F5921B" style={{ color: '#F5921B' }} />)}
          </div>
          <blockquote className="text-2xl md:text-3xl font-bold text-white leading-snug mb-10">
            "O Cheetah transformou como gerenciamos a segurança da clínica.
            Em menos de 10 minutos estava funcionando e já bloqueou o primeiro
            domínio suspeito."
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white"
              style={{ background: 'linear-gradient(135deg, #F5921B, #D96820)' }}>DC</div>
            <div className="text-left">
              <p className="text-white font-semibold">Dr. Carlos Lima</p>
              <p className="text-gray-500 text-sm">Proprietário · Clínica Bem Estar · Usuário desde Mai/2026</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )

  /* ── PRICING ─────────────────────────────────────────────── */
  const Pricing = () => (
    <section id="preços" className="py-24 md:py-32 relative overflow-hidden">
      <img src={IMAGES.pricing} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.07) saturate(0.2)' }} />
      <div className="absolute inset-0" style={{ background: 'rgba(10,15,30,0.97)' }} />
      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8">
        <Reveal className="text-center mb-14 md:mb-16">
          <Badge text="Planos" />
          <h2 className="text-3xl md:text-5xl font-black text-white mt-4 mb-4">
            Segurança enterprise.<br /><span style={{ color: BRAND }}>Preço de PME.</span>
          </h2>
          <p className="text-gray-400 text-base md:text-lg">Sem hardware. Sem contrato anual. Cancele quando quiser.</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto">
          {[
            {
              name: 'Starter', price: 'R$ 299', period: '/mês',
              desc: 'Para negócios com até 10 dispositivos.',
              features: ['Segurança DNS', 'Scanner de Documentos', 'Até 10 dispositivos', 'Dashboard PT-BR', 'Suporte por e-mail'],
              cta: 'Começar grátis', highlight: false
            },
            {
              name: 'Professional', price: 'R$ 399', period: '/mês',
              desc: 'Para equipes com até 30 dispositivos.',
              features: ['Tudo do Starter', 'Proteção de Endpoint', 'Até 30 dispositivos', 'Relatórios PDF', 'Suporte prioritário', 'API REST completa'],
              cta: 'Começar grátis', highlight: true
            },
            {
              name: 'Business', price: 'R$ 458', period: '/mês',
              desc: 'Capacidade máxima de 50 dispositivos.',
              features: ['Tudo do Professional', 'Até 50 dispositivos', 'Webhooks e integrações', 'Audit trail 12 meses', 'SLA 24h para bugs críticos'],
              cta: 'Falar com vendas', highlight: false
            },
          ].map(({ name, price, period, desc, features, cta, highlight }, i) => (
            <Reveal key={name} delay={i * 80}>
              <div className="rounded-2xl p-7 h-full flex flex-col relative transition-all hover:-translate-y-1"
                style={{
                  background: highlight ? `linear-gradient(135deg, ${MID}, #1a3a6e)` : 'rgba(255,255,255,0.04)',
                  border: highlight ? `2px solid ${BRAND}` : '1px solid rgba(255,255,255,0.08)',
                }}>
                {highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: BRAND }}>Mais popular</div>
                )}
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">{name}</p>
                <div className="mb-2">
                  <span className="text-4xl font-black text-white">{price}</span>
                  <span className="text-gray-400 text-sm">{period}</span>
                </div>
                <p className="text-gray-400 text-sm mb-6">{desc}</p>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle size={13} style={{ color: highlight ? '#10B981' : BRAND, flexShrink: 0 }} />{f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                  style={{ background: highlight ? BRAND : 'rgba(255,255,255,0.08)', color: 'white' }}>{cta}</button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )

  /* ── CTA ─────────────────────────────────────────────────── */
  const CTA = () => (
    <section className="py-28 md:py-36 relative overflow-hidden">
      <img src={IMAGES.cta} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.15) saturate(0.4)' }} />
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, rgba(10,15,30,0.95) 0%, rgba(10,15,30,0.88) 100%)'
      }} />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(245,146,27,0.35) 0%, transparent 50%)'
      }} />
      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <Badge text="Comece hoje" />
          <h2 className="text-4xl md:text-6xl font-black text-white mt-6 mb-4">
            Pronto para proteger<br /><span style={{ color: BRAND }}>seu negócio?</span>
          </h2>
          <p className="text-gray-400 text-lg md:text-xl mb-12">Deploy em minutos. Sem hardware. Sem equipe de TI.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/login')}
              className="px-10 py-5 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105"
              style={{ background: BRAND, boxShadow: `0 0 50px rgba(245,146,27,0.4)` }}>
              Começar Teste Grátis
            </button>
            <button className="px-10 py-5 rounded-2xl text-white font-semibold text-lg transition-all hover:bg-white/10 flex items-center gap-2 justify-center"
              style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
              Falar com vendas <ChevronRight size={18} />
            </button>
          </div>
          <p className="text-gray-600 text-sm mt-8">Sem cartão de crédito · Cancele quando quiser · Suporte em português</p>
        </Reveal>
      </div>
    </section>
  )

  /* ── FOOTER ──────────────────────────────────────────────── */
  const Footer = () => (
    <footer style={{ background: '#05080f', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo-icon.png" alt="" style={{ height: 26 }} />
              <span className="text-white font-bold text-sm">Cheetah Technology</span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed mb-4">Segurança enterprise.<br />Orçamento de PME.</p>
            <div className="flex gap-3">
              {[Github, Linkedin, Twitter].map((Icon, i) => (
                <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Icon size={14} />
                </div>
              ))}
            </div>
          </div>
          {[
            { title: 'Plataforma',     links: ['DNS Security','Scanner de Docs','Proteção Endpoint','Dashboard','API REST'] },
            { title: 'Desenvolvedores', links: ['Documentação','OpenAPI /docs','Webhooks','SDKs','Status'] },
            { title: 'Empresa',        links: ['Sobre','Blog','Parceiros','Carreiras','Contato'] },
            { title: 'Legal',          links: ['Privacidade','Termos de Uso','LGPD','Cookies','SLA'] },
          ].map(({ title, links }) => (
            <div key={title}>
              <p className="text-white text-xs font-bold uppercase tracking-widest mb-4">{title}</p>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link}><a href="#" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-gray-600 text-xs">© 2026 Cheetah Technology · Todos os direitos reservados</p>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>🇧🇷 PT-BR</span><span>·</span><span>🇺🇸 EN-US</span>
          </div>
        </div>
      </div>
    </footer>
  )

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div style={{ scrollBehavior: 'smooth', background: DARK }}>
      <Nav />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Modules />
      <StatsBento />
      <FeaturesAccordion />
      <Testimonial />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
