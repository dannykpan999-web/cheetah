import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Monitor, Shield, AlertTriangle, CheckCircle, Trash2,
  ChevronDown, ChevronRight, Cpu, Copy, RefreshCw, Loader, X,
  Terminal, Command, Search, Clock, Activity, Zap, TrendingUp,
  ShieldAlert, ShieldCheck, AlertCircle, Download,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const BORDER  = '1px solid rgba(255,255,255,0.07)'
const CARD    = '#141929'
const BG      = '#0B0F1A'
const TEXT    = '#F1F5F9'
const SUB     = '#94A3B8'
const MUTED   = '#475569'
const ACCENT  = '#F5921B'
const GREEN   = '#10B981'
const RED     = '#EF4444'
const YELLOW  = '#F59E0B'
const BLUE    = '#3B82F6'
const PURPLE  = '#7C3AED'
const TEAL    = '#14B8A6'

interface Stats {
  total: number; online: number; offline: number
  alerts: number; critical_alerts: number
  vulnerabilities: number; critical_vulnerabilities: number
}
interface Agent {
  id: string; agent_id: string; hostname: string
  os_type: string; os_version: string; ip_address: string
  status: string; sca_score: number
  alert_count: number; vuln_count: number; critical_vulns: number
  last_heartbeat: string | null; registered_at: string | null
}
interface AgentDetail extends Agent {
  agent_token: string; alerts: Alert[]; vulnerabilities: Vuln[]
}
interface Alert {
  id: string; rule_id: string; severity: string; category: string
  description: string; resolved: boolean
  hostname?: string; endpoint_id?: string; created_at: string
}
interface Vuln {
  id: string; cve_id: string; severity: string
  package: string; version: string; description: string
  hostname?: string; endpoint_id?: string; detected_at: string
}
interface Onboarding {
  agent_id: string; agent_token: string; os_type: string
  command: string; instructions: string[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60); if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function WindowsSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15">
      <rect x="0.5" y="0.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
      <rect x="8.5" y="0.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
      <rect x="0.5" y="8.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
      <rect x="8.5" y="8.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
    </svg>
  )
}

function OsIcon({ os, size = 16 }: { os: string; size?: number }) {
  if (os === 'windows') return <WindowsSvg size={size} />
  if (os === 'macos')   return <Command size={size} color="#94A3B8" />
  return <Terminal size={size} color={ACCENT} />
}

function SevBadge({ severity }: { severity: string }) {
  const m: Record<string, [string, string]> = {
    critical: ['Crítico', PURPLE], high: ['Alto', RED],
    medium:   ['Médio',   YELLOW], low:  ['Baixo', GREEN],
  }
  const [label, color] = m[severity] ?? ['—', MUTED]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '22', color, border: `1px solid ${color}33` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, [string, string]> = {
    active:          ['Online',      GREEN],
    disconnected:    ['Offline',     RED],
    never_connected: ['Nunca visto', MUTED],
  }
  const [label, color] = cfg[status] ?? cfg.never_connected
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color, boxShadow: status === 'active' ? `0 0 6px ${color}` : 'none' }} />
      {label}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? GREEN : score >= 60 ? YELLOW : RED
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-6" style={{ color }}>{score}</span>
    </div>
  )
}

function ScoreRing({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const cx = size / 2, r = size / 2 - 6
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
    </svg>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function EndpointPage() {
  const [tab, setTab]           = useState<'agents' | 'alerts' | 'vulns' | 'add'>('agents')
  const [stats, setStats]       = useState<Stats | null>(null)
  const [agents, setAgents]     = useState<Agent[]>([])
  const [alerts, setAlerts]     = useState<Alert[]>([])
  const [vulns, setVulns]       = useState<Vuln[]>([])
  const [loading, setLoading]   = useState(true)

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [agentDetail, setAgentDetail]     = useState<AgentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [alertFilter, setAlertFilter] = useState<'all' | 'active' | 'resolved'>('all')
  const [alertSearch, setAlertSearch] = useState('')
  const [sevFilter, setSevFilter]     = useState('')
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [resolving, setResolving]     = useState<string | null>(null)

  const [os, setOs]                     = useState<'linux' | 'windows' | 'macos'>('linux')
  const [onboarding, setOnboarding]     = useState<Onboarding | null>(null)
  const [onboardLoading, setOnboardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [installerLoading, setInstallerLoading] = useState(false)

  const { toast } = useToast()

  const loadStats  = useCallback(async () => { try { const r = await api.get<Stats>('/endpoints/stats'); setStats(r.data) } catch {} }, [])
  const loadAgents = useCallback(async () => { try { const r = await api.get<Agent[]>('/endpoints/agents'); setAgents(r.data) } catch {} }, [])
  const loadAlerts = useCallback(async () => { try { const r = await api.get<Alert[]>('/endpoints/alerts'); setAlerts(r.data) } catch {} }, [])
  const loadVulns  = useCallback(async () => { try { const r = await api.get<Vuln[]>('/endpoints/vulnerabilities'); setVulns(r.data) } catch {} }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadStats(), loadAgents(), loadAlerts(), loadVulns()]).finally(() => setLoading(false))
  }, [loadStats, loadAgents, loadAlerts, loadVulns])

  const expandAgent = async (id: string) => {
    if (expandedAgent === id) { setExpandedAgent(null); setAgentDetail(null); return }
    setExpandedAgent(id); setAgentDetail(null); setDetailLoading(true)
    try { const r = await api.get<AgentDetail>(`/endpoints/agents/${id}`); setAgentDetail(r.data) }
    catch {} finally { setDetailLoading(false) }
  }

  const deleteAgent = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}"?`)) return
    setDeleting(id)
    try {
      await api.delete(`/endpoints/agents/${id}`)
      setAgents(p => p.filter(a => a.id !== id)); loadStats()
      toast('info', 'Dispositivo Removido', `"${name}" foi removido da plataforma.`)
    } catch {
      toast('error', 'Erro ao Remover', 'Não foi possível remover o dispositivo.')
    } finally { setDeleting(null) }
  }

  const resolveAlert = async (alertId: string) => {
    setResolving(alertId)
    try {
      await api.patch(`/endpoints/alerts/${alertId}/resolve`)
      setAlerts(p => p.map(a => a.id === alertId ? { ...a, resolved: true } : a))
      loadStats()
      toast('success', 'Alerta Resolvido', 'O alerta foi marcado como resolvido.')
    } catch {
      toast('error', 'Erro', 'Não foi possível resolver o alerta.')
    } finally { setResolving(null) }
  }

  const generateOnboarding = async () => {
    setOnboardLoading(true); setOnboarding(null)
    try {
      const r = await api.get<Onboarding>(`/endpoints/onboarding/${os}`)
      setOnboarding(r.data); loadAgents(); loadStats()
      toast('success', 'Agente Registrado', `Comando de instalação gerado para ${os}.`)
    } catch {
      toast('error', 'Falha ao Gerar', 'Não foi possível gerar o comando de instalação.')
    } finally { setOnboardLoading(false) }
  }

  const copyCmd = () => {
    if (!onboarding) return
    navigator.clipboard.writeText(onboarding.command)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const downloadInstaller = async () => {
    setInstallerLoading(true)
    try {
      const ext = os === 'windows' ? 'bat' : 'sh'
      const r = await api.get(`/endpoints/installer/${os}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data as BlobPart]))
      const a = document.createElement('a')
      a.href = url; a.download = `cheetah_installer_${os}.${ext}`; a.click()
      URL.revokeObjectURL(url)
      await Promise.all([loadAgents(), loadStats()])
      toast('success', 'Instalador Baixado', `cheetah_installer_${os}.${ext} — execute como administrador.`)
    } catch {
      toast('error', 'Falha no Download', 'Não foi possível gerar o instalador.')
    } finally { setInstallerLoading(false) }
  }

  // Security posture score computed from agents + stats
  const posture = useMemo(() => {
    if (!stats) return { score: 0, label: 'Calculando', color: MUTED }
    const online = agents.filter(a => a.status === 'active')
    const avgSca = online.length > 0
      ? Math.round(online.reduce((s, a) => s + (a.sca_score || 0), 0) / online.length)
      : agents.length > 0 ? 40 : 100
    const penalty = (stats.critical_alerts * 8) + (stats.offline > 0 ? Math.round((stats.offline / Math.max(stats.total, 1)) * 15) : 0)
    const score = Math.max(5, Math.min(100, avgSca - penalty))
    if (score >= 80) return { score, label: 'Baixo Risco',     color: GREEN  }
    if (score >= 60) return { score, label: 'Risco Médio',     color: YELLOW }
    if (score >= 40) return { score, label: 'Risco Alto',      color: '#F97316' }
    return              { score, label: 'Risco Crítico',   color: RED    }
  }, [stats, agents])

  const filteredAlerts = useMemo(() => {
    let list = alerts
    if (alertFilter === 'active')   list = list.filter(a => !a.resolved)
    if (alertFilter === 'resolved') list = list.filter(a =>  a.resolved)
    if (alertSearch) {
      const q = alertSearch.toLowerCase()
      list = list.filter(a => a.description.toLowerCase().includes(q) || (a.hostname || '').toLowerCase().includes(q))
    }
    return list
  }, [alerts, alertFilter, alertSearch])

  const filteredVulns = sevFilter ? vulns.filter(v => v.severity === sevFilter) : vulns

  const TABS = [
    { key: 'agents', label: 'Dispositivos',         count: stats?.total           },
    { key: 'alerts', label: 'Alertas',               count: stats?.alerts          },
    { key: 'vulns',  label: 'Vulnerabilidades',      count: stats?.vulnerabilities },
    { key: 'add',    label: '+ Adicionar',           count: null                   },
  ] as const

  const rowBorderColor = (a: Agent) => {
    if (a.status === 'active' && a.critical_vulns === 0 && a.alert_count === 0) return GREEN
    if (a.status === 'active' && (a.critical_vulns > 0 || a.alert_count > 0)) return YELLOW
    if (a.status === 'disconnected') return RED
    return MUTED
  }

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <Monitor size={20} style={{ color: ACCENT }} /> Proteção de Endpoint
          </h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            Wazuh Agent · FIM · Vulnerabilidades · SCA · Multi-Plataforma
          </p>
        </div>
        <button onClick={() => Promise.all([loadStats(), loadAgents(), loadAlerts(), loadVulns()])}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
          style={{ background: 'rgba(245,146,27,0.1)', color: ACCENT, border: '1px solid rgba(245,146,27,0.2)' }}>
          <RefreshCw size={12} /> Sincronizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: MUTED }}>
          <Loader size={16} className="animate-spin" /> Carregando dados...
        </div>
      ) : (
        <>
          {/* ── Security Posture Banner ── */}
          <div className="rounded-2xl p-5 flex flex-col md:flex-row items-center gap-5"
            style={{ background: CARD, border: `1px solid ${posture.color}22` }}>

            {/* Score ring */}
            <div className="relative flex-shrink-0">
              <ScoreRing score={posture.score} color={posture.color} size={88} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums leading-none" style={{ color: posture.color }}>
                  {posture.score}
                </span>
                <span className="text-xs" style={{ color: MUTED }}>/ 100</span>
              </div>
            </div>

            {/* Score label + status */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                <span className="text-sm font-bold" style={{ color: posture.color }}>{posture.label}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: posture.color + '18', color: posture.color, border: `1px solid ${posture.color}33` }}>
                  Postura de Segurança
                </span>
              </div>
              <p className="text-xs" style={{ color: MUTED }}>
                Baseado na pontuação SCA média dos agentes ativos, alertas críticos e dispositivos offline.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-3 flex-shrink-0">
              {[
                { label: 'Ameaças Ativas', value: stats?.critical_alerts ?? 0, color: RED,    icon: ShieldAlert   },
                { label: 'Offline',         value: stats?.offline ?? 0,          color: YELLOW, icon: AlertCircle   },
                { label: 'CVE Crítico',     value: stats?.critical_vulnerabilities ?? 0, color: PURPLE, icon: Zap },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="flex flex-col items-center px-4 py-3 rounded-xl"
                  style={{ background: color + '0D', border: `1px solid ${color}22` }}>
                  <Icon size={14} style={{ color, marginBottom: 4 }} />
                  <span className="text-lg font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
                  <span className="text-xs mt-1 whitespace-nowrap" style={{ color: MUTED }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
            {[
              { label: 'Total',       value: stats?.total                   ?? 0, color: ACCENT,  icon: Cpu      },
              { label: 'Online',      value: stats?.online                  ?? 0, color: GREEN,   icon: Activity },
              { label: 'Offline',     value: stats?.offline                 ?? 0, color: RED,     icon: AlertCircle },
              { label: 'Alertas',     value: stats?.alerts                  ?? 0, color: YELLOW,  icon: AlertTriangle },
              { label: 'Críticos',    value: stats?.critical_alerts         ?? 0, color: PURPLE,  icon: ShieldAlert },
              { label: 'CVEs',        value: stats?.vulnerabilities         ?? 0, color: BLUE,    icon: Shield   },
              { label: 'CVE Crit.',   value: stats?.critical_vulnerabilities ?? 0, color: RED,    icon: Zap      },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-3 md:p-4 flex flex-col items-center gap-1"
                style={{ background: CARD, border: BORDER }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1"
                  style={{ background: color + '18' }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <p className="text-xl font-bold tabular-nums leading-none" style={{ color }}>{value}</p>
                <p className="text-xs text-center leading-tight" style={{ color: MUTED }}>{label}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {TABS.map(({ key, label, count }) => (
              <button key={key} onClick={() => setTab(key as typeof tab)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs md:text-sm font-medium transition-all relative"
                style={tab === key ? { color: ACCENT } : { color: MUTED }}>
                {label}
                {count != null && count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs tabular-nums"
                    style={{
                      background: tab === key ? 'rgba(245,146,27,0.15)' : 'rgba(255,255,255,0.07)',
                      color: tab === key ? ACCENT : MUTED,
                    }}>
                    {count}
                  </span>
                )}
                {tab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ background: ACCENT }} />
                )}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════
              TAB: Dispositivos
          ══════════════════════════════════════════════════ */}
          {tab === 'agents' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: BORDER }}>
                <p className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT }}>
                  <ShieldCheck size={14} style={{ color: ACCENT }} /> Dispositivos Monitorados
                </p>
                <span className="text-xs" style={{ color: MUTED }}>{agents.length} dispositivo{agents.length !== 1 ? 's' : ''}</span>
              </div>

              {agents.length === 0 ? (
                <div className="py-14 text-center">
                  <Cpu size={36} className="mx-auto mb-3 opacity-20" style={{ color: SUB }} />
                  <p className="text-sm mb-3" style={{ color: MUTED }}>Nenhum dispositivo registrado.</p>
                  <button onClick={() => setTab('add')} className="text-xs underline" style={{ color: ACCENT }}>
                    Adicionar primeiro dispositivo →
                  </button>
                </div>
              ) : (
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      {['', 'Dispositivo', 'Endereço IP', 'Status', 'Pontuação SCA', 'Alertas', 'CVEs', 'Último contato', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent, i) => (
                      <>
                        <tr key={agent.id}
                          onClick={() => expandAgent(agent.id)}
                          className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                          style={{
                            borderBottom: BORDER,
                            boxShadow: `inset 3px 0 0 ${rowBorderColor(agent)}`,
                          }}>
                          <td className="px-4 py-3.5 w-8">
                            <span style={{ color: MUTED }}>
                              {expandedAgent === agent.id
                                ? <ChevronDown size={13} />
                                : <ChevronRight size={13} />}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.05)', border: BORDER }}>
                                <OsIcon os={agent.os_type} size={14} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: TEXT }}>{agent.hostname}</p>
                                <p className="text-xs" style={{ color: MUTED }}>{agent.os_version || agent.os_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs font-mono" style={{ color: SUB }}>{agent.ip_address || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusPill status={agent.status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <ScoreBar score={agent.sca_score} />
                          </td>
                          <td className="px-4 py-3.5">
                            {agent.alert_count > 0
                              ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: YELLOW }}>
                                  <AlertTriangle size={11} /> {agent.alert_count}
                                </span>
                              : <span className="text-xs" style={{ color: MUTED }}>—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            {agent.critical_vulns > 0
                              ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: RED }}>
                                  <Shield size={11} /> {agent.critical_vulns}
                                </span>
                              : <span className="text-xs" style={{ color: MUTED }}>—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                              <Clock size={10} /> {timeAgo(agent.last_heartbeat)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button onClick={e => { e.stopPropagation(); deleteAgent(agent.id, agent.hostname) }}
                              className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                              style={{ color: MUTED }}>
                              {deleting === agent.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </td>
                        </tr>

                        {expandedAgent === agent.id && (
                          <tr key={`${agent.id}-detail`} style={{ borderBottom: BORDER }}>
                            <td colSpan={9} className="px-5 py-4" style={{ background: BG }}>
                              {detailLoading ? (
                                <div className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
                                  <Loader size={12} className="animate-spin" /> Carregando...
                                </div>
                              ) : agentDetail ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: SUB }}>
                                      ALERTAS ({agentDetail.alerts.length})
                                    </p>
                                    {agentDetail.alerts.length === 0
                                      ? <p className="text-xs" style={{ color: MUTED }}>Nenhum alerta.</p>
                                      : agentDetail.alerts.slice(0, 4).map(a => (
                                        <div key={a.id} className="flex items-start gap-2 mb-2">
                                          <SevBadge severity={a.severity} />
                                          <p className="text-xs leading-relaxed" style={{ color: SUB }}>{a.description}</p>
                                        </div>
                                      ))}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: SUB }}>
                                      VULNERABILIDADES ({agentDetail.vulnerabilities.length})
                                    </p>
                                    {agentDetail.vulnerabilities.length === 0
                                      ? <p className="text-xs" style={{ color: MUTED }}>Sem CVEs.</p>
                                      : agentDetail.vulnerabilities.slice(0, 4).map(v => (
                                        <div key={v.id} className="flex items-start gap-2 mb-2">
                                          <SevBadge severity={v.severity} />
                                          <div>
                                            <p className="text-xs font-mono font-semibold" style={{ color: TEXT }}>{v.cve_id}</p>
                                            <p className="text-xs" style={{ color: MUTED }}>{v.package} {v.version}</p>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: SUB }}>TOKEN DO AGENTE</p>
                                    <p className="text-xs font-mono px-3 py-2 rounded-lg break-all" style={{ background: CARD, color: MUTED }}>
                                      {agentDetail.agent_token}
                                    </p>
                                    <p className="text-xs mt-2" style={{ color: MUTED }}>
                                      Registrado {timeAgo(agent.registered_at)}
                                    </p>
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB: Alertas — IndustryOS-style table
          ══════════════════════════════════════════════════ */}
          {tab === 'alerts' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
              {/* Toolbar */}
              <div className="px-5 py-3.5 flex flex-wrap items-center gap-3" style={{ borderBottom: BORDER }}>
                {/* Sub-tabs */}
                <div className="flex gap-1">
                  {[
                    { key: 'all',      label: 'Todos',     count: alerts.length },
                    { key: 'active',   label: 'Ativos',    count: alerts.filter(a => !a.resolved).length },
                    { key: 'resolved', label: 'Resolvidos', count: alerts.filter(a => a.resolved).length },
                  ].map(({ key, label, count }) => (
                    <button key={key} onClick={() => setAlertFilter(key as typeof alertFilter)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={alertFilter === key
                        ? { background: ACCENT, color: '#000' }
                        : { background: 'rgba(255,255,255,0.04)', color: MUTED }}>
                      {label}
                      <span className="px-1.5 py-0.5 rounded-full text-xs"
                        style={{
                          background: alertFilter === key ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)',
                          color: alertFilter === key ? '#000' : MUTED,
                        }}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-40 max-w-64 px-3 py-2 rounded-xl"
                  style={{ background: BG, border: BORDER }}>
                  <Search size={12} style={{ color: MUTED }} />
                  <input value={alertSearch} onChange={e => setAlertSearch(e.target.value)}
                    placeholder="Buscar alerta..."
                    className="flex-1 text-xs bg-transparent outline-none" style={{ color: TEXT }} />
                  {alertSearch && <button onClick={() => setAlertSearch('')} style={{ color: MUTED }}><X size={11} /></button>}
                </div>
                <button onClick={loadAlerts}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(245,146,27,0.1)', color: ACCENT }}>
                  <RefreshCw size={11} /> Atualizar
                </button>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle size={32} className="mx-auto mb-3 opacity-20" style={{ color: GREEN }} />
                  <p className="text-sm" style={{ color: MUTED }}>Nenhum alerta encontrado.</p>
                </div>
              ) : (
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      {['Detalhes do Alerta', 'Dispositivo', 'Quando', 'Severidade', 'Status', 'Ação'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((a, i) => (
                      <tr key={a.id}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{
                          borderBottom: i < filteredAlerts.length - 1 ? BORDER : 'none',
                          opacity: a.resolved ? 0.5 : 1,
                          boxShadow: !a.resolved && a.severity === 'critical' ? `inset 3px 0 0 ${PURPLE}` :
                                     !a.resolved && a.severity === 'high' ? `inset 3px 0 0 ${RED}` :
                                     !a.resolved && a.severity === 'medium' ? `inset 3px 0 0 ${YELLOW}` : 'none',
                        }}>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="text-sm font-medium truncate" style={{ color: TEXT }}>
                            {a.description.length > 60 ? a.description.slice(0, 60) + '…' : a.description}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: MUTED }}>{a.category}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {a.hostname
                            ? <span className="text-xs font-medium" style={{ color: SUB }}>{a.hostname}</span>
                            : <span className="text-xs" style={{ color: MUTED }}>—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                            <Clock size={10} /> {timeAgo(a.created_at)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <SevBadge severity={a.severity} />
                        </td>
                        <td className="px-5 py-3.5">
                          {a.resolved
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: GREEN }}>
                                <CheckCircle size={11} /> Resolvido
                              </span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(239,68,68,0.1)', color: RED }}>
                                Ativo
                              </span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {!a.resolved && (
                            <button onClick={() => resolveAlert(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                              style={{ background: 'rgba(16,185,129,0.1)', color: GREEN, border: '1px solid rgba(16,185,129,0.2)' }}>
                              {resolving === a.id ? <Loader size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              Resolver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {filteredAlerts.length > 0 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
                  <span className="text-xs" style={{ color: MUTED }}>{filteredAlerts.length} alerta{filteredAlerts.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs" style={{ color: MUTED }}>
                    {alerts.filter(a => !a.resolved).length} ativos · {alerts.filter(a => a.resolved).length} resolvidos
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB: Vulnerabilidades
          ══════════════════════════════════════════════════ */}
          {tab === 'vulns' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
              <div className="px-5 py-3.5 flex flex-wrap items-center gap-2" style={{ borderBottom: BORDER }}>
                <p className="text-sm font-semibold flex-1" style={{ color: TEXT }}>
                  Vulnerabilidades Detectadas (CVEs)
                </p>
                <div className="flex gap-1">
                  {[
                    { v: '',         label: 'Todos',   color: MUTED   },
                    { v: 'critical', label: 'Crítico', color: PURPLE  },
                    { v: 'high',     label: 'Alto',    color: RED     },
                    { v: 'medium',   label: 'Médio',   color: YELLOW  },
                    { v: 'low',      label: 'Baixo',   color: GREEN   },
                  ].map(({ v, label, color }) => (
                    <button key={v} onClick={() => setSevFilter(v)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={sevFilter === v
                        ? { background: color + '22', color, border: `1px solid ${color}33` }
                        : { background: 'rgba(255,255,255,0.04)', color: MUTED }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredVulns.length === 0 ? (
                <div className="py-12 text-center">
                  <Shield size={32} className="mx-auto mb-3 opacity-20" style={{ color: GREEN }} />
                  <p className="text-sm" style={{ color: MUTED }}>Nenhuma vulnerabilidade encontrada.</p>
                </div>
              ) : (
                <table className="w-full min-w-[580px]">
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      {['CVE ID', 'Pacote / Versão', 'Severidade', 'Dispositivo', 'Detectado em'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVulns.map((v, i) => (
                      <tr key={v.id}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{
                          borderBottom: i < filteredVulns.length - 1 ? BORDER : 'none',
                          boxShadow: v.severity === 'critical' ? `inset 3px 0 0 ${PURPLE}` :
                                     v.severity === 'high'     ? `inset 3px 0 0 ${RED}`    :
                                     v.severity === 'medium'   ? `inset 3px 0 0 ${YELLOW}` : 'none',
                        }}>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-mono font-semibold" style={{ color: TEXT }}>{v.cve_id}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-medium" style={{ color: SUB }}>{v.package}</p>
                          <p className="text-xs" style={{ color: MUTED }}>{v.version}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <SevBadge severity={v.severity} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs" style={{ color: MUTED }}>{v.hostname || '—'}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                            <Clock size={10} /> {timeAgo(v.detected_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {filteredVulns.length > 0 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
                  <span className="text-xs" style={{ color: MUTED }}>{filteredVulns.length} vulnerabilidade{filteredVulns.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs" style={{ color: MUTED }}>
                    {vulns.filter(v => v.severity === 'critical').length} críticas · {vulns.filter(v => v.severity === 'high').length} altas
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB: Adicionar Dispositivo
          ══════════════════════════════════════════════════ */}
          {tab === 'add' && (
            <div className="max-w-xl space-y-4">
              <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
                <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>Novo Dispositivo</p>
                <p className="text-xs mb-5" style={{ color: MUTED }}>
                  Selecione o sistema operacional e gere o comando de instalação do agente Wazuh.
                </p>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {([
                    { key: 'linux',   label: 'Linux',   sub: 'apt · yum · dnf' },
                    { key: 'windows', label: 'Windows', sub: 'PowerShell (Admin)' },
                    { key: 'macos',   label: 'macOS',   sub: 'Terminal' },
                  ] as const).map(({ key, label, sub }) => (
                    <button key={key} onClick={() => { setOs(key); setOnboarding(null) }}
                      className="rounded-xl p-4 text-center transition-all"
                      style={os === key
                        ? { background: 'rgba(245,146,27,0.1)', border: `1px solid ${ACCENT}` }
                        : { background: BG, border: BORDER }}>
                      <div className="flex justify-center mb-2.5">
                        <OsIcon os={key} size={26} />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: TEXT }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: MUTED }}>{sub}</p>
                    </button>
                  ))}
                </div>

                <button onClick={generateOnboarding} disabled={onboardLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: ACCENT, color: '#fff', opacity: onboardLoading ? 0.7 : 1 }}>
                  {onboardLoading
                    ? <><Loader size={14} className="animate-spin" /> Gerando...</>
                    : 'Gerar Comando de Instalação'}
                </button>

                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <span className="text-xs" style={{ color: MUTED }}>ou</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>

                <button onClick={downloadInstaller} disabled={installerLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: `rgba(20,184,166,0.12)`, color: TEAL, border: `1px solid rgba(20,184,166,0.25)`, opacity: installerLoading ? 0.7 : 1 }}>
                  {installerLoading
                    ? <><Loader size={14} className="animate-spin" /> Preparando instalador...</>
                    : <><Download size={14} /> Baixar Instalador {os === 'windows' ? '(.bat)' : '(.sh)'}</>}
                </button>
              </div>

              {onboarding && (
                <div className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: '1px solid rgba(16,185,129,0.25)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: GREEN }}>
                      <CheckCircle size={14} /> Agente Registrado
                    </p>
                    <button onClick={() => setOnboarding(null)} style={{ color: MUTED }}><X size={14} /></button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: SUB }}>INSTRUÇÕES</p>
                    {onboarding.instructions.map((inst, i) => (
                      <p key={i} className="text-xs mb-1.5 leading-relaxed" style={{ color: SUB }}>{inst}</p>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold tracking-wider" style={{ color: SUB }}>COMANDO</p>
                      <button onClick={copyCmd}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                          color: copied ? GREEN : MUTED,
                        }}>
                        {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="text-xs font-mono p-3 rounded-xl overflow-x-auto leading-relaxed"
                      style={{ background: BG, color: GREEN, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {onboarding.command}
                    </pre>
                  </div>
                  <p className="text-xs" style={{ color: MUTED }}>
                    Agent ID: <code className="font-mono" style={{ color: SUB }}>{onboarding.agent_id}</code>
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
