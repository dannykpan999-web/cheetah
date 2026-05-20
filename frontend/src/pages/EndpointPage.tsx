import { useEffect, useState, useCallback } from 'react'
import {
  Monitor, Shield, AlertTriangle, CheckCircle, Trash2,
  ChevronDown, ChevronRight, Cpu, Copy, RefreshCw, Loader, X, Terminal, Command,
} from 'lucide-react'
import api from '../api/client'

const BORDER = '1px solid rgba(255,255,255,0.07)'
const CARD   = '#141929'
const TEXT   = '#F1F5F9'
const SUB    = '#94A3B8'
const MUTED  = '#475569'
const ACCENT = '#F5921B'
const BG     = '#0B0F1A'

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
  agent_token: string
  alerts: Alert[]
  vulnerabilities: Vuln[]
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

function SevBadge({ severity }: { severity: string }) {
  const m: Record<string, [string, string]> = {
    critical: ['Crítico', '#7C3AED'],
    high:     ['Alto',    '#EF4444'],
    medium:   ['Médio',   '#F59E0B'],
    low:      ['Baixo',   '#10B981'],
  }
  const [label, color] = m[severity] ?? ['—', MUTED]
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
      style={{ background: color + '22', color }}>
      {label}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, [string, string]> = {
    active:          ['Online',      '#10B981'],
    disconnected:    ['Offline',     '#EF4444'],
    never_connected: ['Nunca visto', '#475569'],
  }
  const [label, color] = cfg[status] ?? cfg.never_connected
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color, boxShadow: status === 'active' ? `0 0 6px ${color}` : 'none' }} />
      {label}
    </span>
  )
}

function WindowsSvg({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" aria-label="Windows">
      <rect x="0.5" y="0.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
      <rect x="8.5" y="0.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
      <rect x="0.5" y="8.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
      <rect x="8.5" y="8.5" width="6" height="6" rx="0.5" fill="#0078D4"/>
    </svg>
  )
}

function OsIcon({ os, size = 18 }: { os: string; size?: number }) {
  if (os === 'windows') return <WindowsSvg size={size} />
  if (os === 'macos')   return <Command size={size} color="#94A3B8" aria-label="macOS" />
  return <Terminal size={size} color={ACCENT} aria-label="Linux" />
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{score}</span>
    </div>
  )
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export default function EndpointPage() {
  const [tab, setTab] = useState<'agents' | 'alerts' | 'vulns' | 'add'>('agents')
  const [stats, setStats]   = useState<Stats | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [vulns, setVulns]   = useState<Vuln[]>([])
  const [loading, setLoading] = useState(true)

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [agentDetail, setAgentDetail]     = useState<AgentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [sevFilter, setSevFilter] = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)

  const [os, setOs]                     = useState<'linux' | 'windows' | 'macos'>('linux')
  const [onboarding, setOnboarding]     = useState<Onboarding | null>(null)
  const [onboardLoading, setOnboardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)

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
    try { await api.delete(`/endpoints/agents/${id}`); setAgents(p => p.filter(a => a.id !== id)); loadStats() }
    catch {} finally { setDeleting(null) }
  }

  const resolveAlert = async (alertId: string) => {
    setResolving(alertId)
    try {
      await api.patch(`/endpoints/alerts/${alertId}/resolve`)
      setAlerts(p => p.map(a => a.id === alertId ? { ...a, resolved: true } : a))
      loadStats()
    } catch {} finally { setResolving(null) }
  }

  const generateOnboarding = async () => {
    setOnboardLoading(true); setOnboarding(null)
    try {
      const r = await api.get<Onboarding>(`/endpoints/onboarding/${os}`)
      setOnboarding(r.data); loadAgents(); loadStats()
    } catch {} finally { setOnboardLoading(false) }
  }

  const copyCmd = () => {
    if (!onboarding) return
    navigator.clipboard.writeText(onboarding.command)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const filteredVulns = sevFilter ? vulns.filter(v => v.severity === sevFilter) : vulns

  const TABS = [
    { key: 'agents', label: 'Dispositivos',        count: stats?.total         },
    { key: 'alerts', label: 'Alertas',              count: stats?.alerts        },
    { key: 'vulns',  label: 'Vulnerabilidades',     count: stats?.vulnerabilities },
    { key: 'add',    label: '+ Adicionar Dispositivo', count: null             },
  ] as const

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-4 md:space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
          <Monitor size={20} style={{ color: ACCENT }} /> Proteção de Endpoint
        </h1>
        <p className="text-sm mt-0.5" style={{ color: MUTED }}>
          Wazuh Agent · FIM · Vulnerabilidades · SCA · Multi-Plataforma
        </p>
      </div>

      {/* KPI cards */}
      {loading
        ? <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}><Loader size={14} className="animate-spin" /> Carregando...</div>
        : (
          <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total',       value: stats?.total                  ?? 0, color: ACCENT    },
              { label: 'Online',      value: stats?.online                 ?? 0, color: '#10B981' },
              { label: 'Offline',     value: stats?.offline                ?? 0, color: '#EF4444' },
              { label: 'Alertas',     value: stats?.alerts                 ?? 0, color: '#F59E0B' },
              { label: 'Críticos',    value: stats?.critical_alerts        ?? 0, color: '#7C3AED' },
              { label: 'CVEs',        value: stats?.vulnerabilities        ?? 0, color: '#3B82F6' },
              { label: 'CVE Crit.',   value: stats?.critical_vulnerabilities ?? 0, color: '#EF4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-3 md:p-4 text-center" style={{ background: CARD, border: BORDER }}>
                <p className="text-xl md:text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{label}</p>
              </div>
            ))}
          </div>
        )
      }

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: CARD, border: BORDER }}>
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all"
            style={tab === key ? { background: ACCENT, color: '#fff' } : { color: SUB }}>
            {label}
            {count != null && count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: tab === key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', color: tab === key ? '#fff' : MUTED }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Dispositivos ── */}
      {tab === 'agents' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: BORDER }}>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Dispositivos Monitorados</p>
            <button onClick={() => { loadAgents(); loadStats() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
              style={{ background: 'rgba(245,146,27,0.1)', color: ACCENT }}>
              <RefreshCw size={12} /> Sincronizar
            </button>
          </div>

          {agents.length === 0 ? (
            <div className="p-10 text-center" style={{ color: MUTED }}>
              <Cpu size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-3">Nenhum dispositivo registrado.</p>
              <button onClick={() => setTab('add')} className="text-xs underline" style={{ color: ACCENT }}>
                Adicionar primeiro dispositivo →
              </button>
            </div>
          ) : agents.map(agent => (
            <div key={agent.id}>
              {/* Row */}
              <div className="px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                onClick={() => expandAgent(agent.id)}
                style={{ borderBottom: BORDER }}>
                <span style={{ color: MUTED, flexShrink: 0 }}>
                  {expandedAgent === agent.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className="text-lg w-6 text-center flex-shrink-0"><OsIcon os={agent.os_type} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{agent.hostname}</p>
                  <p className="text-xs truncate" style={{ color: MUTED }}>{agent.os_version || agent.os_type}</p>
                </div>
                <span className="hidden md:block text-xs font-mono flex-shrink-0" style={{ color: MUTED }}>{agent.ip_address || '—'}</span>
                <div className="flex-shrink-0"><StatusDot status={agent.status} /></div>
                <div className="hidden sm:block flex-shrink-0"><ScoreBar score={agent.sca_score} /></div>
                {agent.alert_count > 0 && (
                  <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ background: '#EF44441A', color: '#EF4444' }}>
                    <AlertTriangle size={10} /> {agent.alert_count}
                  </span>
                )}
                {agent.critical_vulns > 0 && (
                  <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ background: '#7C3AED1A', color: '#7C3AED' }}>
                    <Shield size={10} /> {agent.critical_vulns}
                  </span>
                )}
                <span className="hidden lg:block text-xs flex-shrink-0" style={{ color: MUTED }}>
                  {timeAgo(agent.last_heartbeat)}
                </span>
                <button onClick={e => { e.stopPropagation(); deleteAgent(agent.id, agent.hostname) }}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 flex-shrink-0"
                  style={{ color: MUTED }}>
                  {deleting === agent.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>

              {/* Expanded */}
              {expandedAgent === agent.id && (
                <div className="px-5 py-4" style={{ background: BG, borderBottom: BORDER }}>
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
                      <Loader size={14} className="animate-spin" /> Carregando detalhes...
                    </div>
                  ) : agentDetail ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: SUB }}>
                          ALERTAS ({agentDetail.alerts.length})
                        </p>
                        {agentDetail.alerts.length === 0
                          ? <p className="text-xs" style={{ color: MUTED }}>Sem alertas.</p>
                          : agentDetail.alerts.map(a => (
                            <div key={a.id} className="flex items-start gap-2 mb-2.5">
                              <SevBadge severity={a.severity} />
                              <p className="text-xs leading-relaxed" style={{ color: SUB }}>{a.description}</p>
                            </div>
                          ))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: SUB }}>
                          VULNERABILIDADES ({agentDetail.vulnerabilities.length})
                        </p>
                        {agentDetail.vulnerabilities.length === 0
                          ? <p className="text-xs" style={{ color: MUTED }}>Sem CVEs.</p>
                          : agentDetail.vulnerabilities.map(v => (
                            <div key={v.id} className="flex items-start gap-2 mb-2.5">
                              <SevBadge severity={v.severity} />
                              <div>
                                <p className="text-xs font-mono font-semibold" style={{ color: TEXT }}>{v.cve_id}</p>
                                <p className="text-xs" style={{ color: MUTED }}>{v.package} {v.version}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold mb-1 tracking-wide" style={{ color: SUB }}>TOKEN DO AGENTE</p>
                        <p className="text-xs font-mono px-3 py-2 rounded-lg break-all" style={{ background: CARD, color: MUTED }}>
                          {agentDetail.agent_token}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Alertas ── */}
      {tab === 'alerts' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: BORDER }}>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Feed de Alertas</p>
            <button onClick={loadAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
              style={{ background: 'rgba(245,146,27,0.1)', color: ACCENT }}>
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="p-10 text-center" style={{ color: MUTED }}>
              <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum alerta.</p>
            </div>
          ) : alerts.map(a => (
            <div key={a.id} className="px-5 py-3.5 flex items-start gap-3"
              style={{ borderBottom: BORDER, opacity: a.resolved ? 0.45 : 1 }}>
              <SevBadge severity={a.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed" style={{ color: TEXT }}>{a.description}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {a.hostname && <span className="text-xs" style={{ color: MUTED }}>{a.hostname}</span>}
                  <span className="text-xs" style={{ color: MUTED }}>·</span>
                  <span className="text-xs" style={{ color: MUTED }}>{timeAgo(a.created_at)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}>{a.category}</span>
                </div>
              </div>
              {a.resolved
                ? <span className="flex-shrink-0 text-xs font-medium" style={{ color: '#10B981' }}>✓ Resolvido</span>
                : (
                  <button onClick={() => resolveAlert(a.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                    {resolving === a.id ? <Loader size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                    Resolver
                  </button>
                )}
            </div>
          ))}
        </div>
      )}

      {/* ── Vulnerabilidades ── */}
      {tab === 'vulns' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
          <div className="px-5 py-4 flex flex-wrap items-center gap-2" style={{ borderBottom: BORDER }}>
            <p className="text-sm font-semibold flex-1" style={{ color: TEXT }}>Vulnerabilidades (CVEs)</p>
            {(['', 'critical', 'high', 'medium', 'low'] as const).map(s => (
              <button key={s} onClick={() => setSevFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={sevFilter === s ? { background: ACCENT, color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: MUTED }}>
                {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {filteredVulns.length === 0 ? (
            <div className="p-10 text-center" style={{ color: MUTED }}>
              <Shield size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma vulnerabilidade encontrada.</p>
            </div>
          ) : filteredVulns.map(v => (
            <div key={v.id} className="px-5 py-3.5 flex items-start gap-3" style={{ borderBottom: BORDER }}>
              <SevBadge severity={v.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono font-semibold" style={{ color: TEXT }}>{v.cve_id}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{v.package} {v.version}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: SUB }}>{v.description}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {v.hostname && <span className="text-xs" style={{ color: MUTED }}>{v.hostname}</span>}
                  <span className="text-xs" style={{ color: MUTED }}>·</span>
                  <span className="text-xs" style={{ color: MUTED }}>{timeAgo(v.detected_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Adicionar Dispositivo ── */}
      {tab === 'add' && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
            <p className="text-sm font-semibold mb-4" style={{ color: TEXT }}>Selecione o Sistema Operacional</p>
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
                    <OsIcon os={key} size={28} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: TEXT }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>{sub}</p>
                </button>
              ))}
            </div>
            <button onClick={generateOnboarding} disabled={onboardLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background: ACCENT, color: '#fff', opacity: onboardLoading ? 0.7 : 1 }}>
              {onboardLoading
                ? <span className="flex items-center justify-center gap-2"><Loader size={14} className="animate-spin" /> Gerando...</span>
                : 'Gerar Comando de Instalação'}
            </button>
          </div>

          {onboarding && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: '#10B981' }}>✓ Agente Registrado</p>
                <button onClick={() => setOnboarding(null)} style={{ color: MUTED }}><X size={14} /></button>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: SUB }}>INSTRUÇÕES</p>
                {onboarding.instructions.map((inst, i) => (
                  <p key={i} className="text-xs mb-1.5 leading-relaxed" style={{ color: SUB }}>{inst}</p>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold tracking-wide" style={{ color: SUB }}>COMANDO</p>
                  <button onClick={copyCmd}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                             color: copied ? '#10B981' : MUTED }}>
                    {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="text-xs font-mono p-3 rounded-xl overflow-x-auto leading-relaxed"
                  style={{ background: BG, color: '#10B981', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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

    </div>
  )
}
