import { useEffect, useState, FormEvent, useMemo } from 'react'
import {
  Globe, Plus, Trash2, Shield, AlertCircle, CheckCircle,
  Activity, Search, ChevronUp, ChevronDown, ChevronsUpDown,
  BarChart2, Ban, X, Loader, Bug, Crosshair, Volume2, Building2, Pencil, Circle,
  Monitor,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const BORDER = '1px solid rgba(255,255,255,0.07)'
const CARD   = '#141929'
const TEXT   = '#F1F5F9'
const SUB    = '#94A3B8'
const MUTED  = '#475569'
const ACCENT = '#F5921B'
const BG     = '#0B0F1A'

interface Policy {
  id: string
  domain: string
  policy_type: string
  category: string
  created_at: string
}

interface DevicePolicy {
  id: string
  endpoint_id: string
  domain: string
  policy_type: string
  category: string
  created_at: string
}

interface Device {
  id: string
  hostname: string
  os_type: string | null
  ip_address: string | null
  status: string
  rule_count: number
}

interface DnsStats {
  total_queries: number
  blocked_today: number
  allowed_today: number
  top_blocked: { domain: string; count: number }[]
}

type SortKey = 'domain' | 'category' | 'created_at'
type SortDir = 'asc' | 'desc'

interface CatDef { value: string; label: string; color: string; Icon: LucideIcon }

const CATEGORIES: CatDef[] = [
  { value: 'malware',   label: 'Malware',       color: '#EF4444', Icon: Bug       },
  { value: 'phishing',  label: 'Phishing',      color: '#F97316', Icon: Crosshair },
  { value: 'adware',    label: 'Adware',        color: '#F59E0B', Icon: Volume2   },
  { value: 'corporate', label: 'Corporativo',   color: '#3B82F6', Icon: Building2 },
  { value: 'custom',    label: 'Personalizado', color: '#8B5CF6', Icon: Pencil    },
]

function catMeta(value: string): CatDef {
  return CATEGORIES.find(c => c.value === value) ?? { value, label: value, color: MUTED, Icon: Circle }
}

function CategoryBadge({ value }: { value: string }) {
  const { label, color, Icon } = catMeta(value)
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: color + '18', color }}>
      <Icon size={11} /> {label}
    </span>
  )
}

function PolicyBadge({ type }: { type: string }) {
  return type === 'blacklist'
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
        <Ban size={10} /> Bloquear
      </span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
        <CheckCircle size={10} /> Liberar
      </span>
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} style={{ color: MUTED, opacity: 0.5 }} />
  return sortDir === 'asc'
    ? <ChevronUp size={12} style={{ color: ACCENT }} />
    : <ChevronDown size={12} style={{ color: ACCENT }} />
}

export default function DnsPage() {
  // ── Global rules state ──
  const [policies, setPolicies]       = useState<Policy[]>([])
  const [stats, setStats]             = useState<DnsStats | null>(null)
  const [adguard, setAdguard]         = useState<{ running: boolean } | null>(null)
  const [loading, setLoading]         = useState(false)
  const [form, setForm]               = useState({ domain: '', policy_type: 'blacklist', category: 'malware' })
  const [adding, setAdding]           = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [filter, setFilter]           = useState<'all' | 'blacklist' | 'whitelist'>('all')
  const [search, setSearch]           = useState('')
  const [sortKey, setSortKey]         = useState<SortKey | null>(null)
  const [sortDir, setSortDir]         = useState<SortDir>('asc')
  const [confirmId, setConfirmId]     = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)

  // ── Per-device state ──
  const [mainTab, setMainTab]             = useState<'global' | 'device'>('global')
  const [devices, setDevices]             = useState<Device[]>([])
  const [selDevice, setSelDevice]         = useState<Device | null>(null)
  const [devicePolicies, setDevicePolicies] = useState<DevicePolicy[]>([])
  const [devLoading, setDevLoading]       = useState(false)
  const [devShowForm, setDevShowForm]     = useState(false)
  const [devForm, setDevForm]             = useState({ domain: '', policy_type: 'blacklist', category: 'custom' })
  const [devAdding, setDevAdding]         = useState(false)
  const [devConfirmId, setDevConfirmId]   = useState<string | null>(null)
  const [devDeleting, setDevDeleting]     = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    load()
    loadDevices()
    api.get<{ running: boolean }>('/dns/adguard/status')
      .then(r => setAdguard(r.data))
      .catch(() => setAdguard({ running: false }))
    api.get<DnsStats>('/dns/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [])

  // ── Global rules functions ──
  async function load() {
    setLoading(true)
    try {
      const r = await api.get<Policy[]>('/dns/policies')
      setPolicies(r.data)
    } catch { /* keep existing */ } finally { setLoading(false) }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      await api.post('/dns/policies', form)
      await load()
      setForm(f => ({ ...f, domain: '' }))
      setShowForm(false)
      const label = form.policy_type === 'blacklist' ? 'bloqueado' : 'liberado'
      toast('success', 'Política Adicionada', `${form.domain} ${label} com sucesso.`)
    } catch {
      toast('error', 'Falha ao Adicionar', 'Não foi possível salvar a política DNS.')
    } finally { setAdding(false) }
  }

  async function remove(id: string) {
    setDeleting(true)
    const target = policies.find(p => p.id === id)
    try {
      await api.delete(`/dns/policies/${id}`)
      setPolicies(p => p.filter(x => x.id !== id))
      setConfirmId(null)
      toast('info', 'Política Removida', `${target?.domain ?? 'Domínio'} removido das políticas DNS.`)
    } catch {
      toast('error', 'Falha ao Remover', 'Não foi possível excluir a política.')
    } finally { setDeleting(false) }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Per-device functions ──
  async function loadDevices() {
    try {
      const r = await api.get<Device[]>('/dns/devices')
      setDevices(r.data)
    } catch {}
  }

  async function loadDevicePolicies(endpointId: string) {
    setDevLoading(true)
    try {
      const r = await api.get<DevicePolicy[]>(`/dns/device-policies?endpoint_id=${endpointId}`)
      setDevicePolicies(r.data)
    } catch {} finally { setDevLoading(false) }
  }

  function selectDevice(dev: Device) {
    setSelDevice(dev)
    setDevShowForm(false)
    setDevConfirmId(null)
    loadDevicePolicies(dev.id)
  }

  async function addDevicePolicy(e: FormEvent) {
    e.preventDefault()
    if (!selDevice) return
    setDevAdding(true)
    try {
      await api.post('/dns/device-policies', { ...devForm, endpoint_id: selDevice.id })
      await loadDevicePolicies(selDevice.id)
      setDevices(d => d.map(x => x.id === selDevice.id ? { ...x, rule_count: x.rule_count + 1 } : x))
      setSelDevice(s => s ? { ...s, rule_count: s.rule_count + 1 } : s)
      setDevForm(f => ({ ...f, domain: '' }))
      setDevShowForm(false)
      const label = devForm.policy_type === 'blacklist' ? 'bloqueado' : 'liberado'
      toast('success', 'Regra Adicionada', `${devForm.domain} ${label} para ${selDevice.hostname}.`)
    } catch {
      toast('error', 'Falha', 'Não foi possível salvar a regra.')
    } finally { setDevAdding(false) }
  }

  async function removeDevicePolicy(id: string) {
    setDevDeleting(true)
    const target = devicePolicies.find(p => p.id === id)
    try {
      await api.delete(`/dns/device-policies/${id}`)
      setDevicePolicies(p => p.filter(x => x.id !== id))
      setDevices(d => d.map(x => x.id === selDevice?.id ? { ...x, rule_count: Math.max(0, x.rule_count - 1) } : x))
      setSelDevice(s => s ? { ...s, rule_count: Math.max(0, s.rule_count - 1) } : s)
      setDevConfirmId(null)
      toast('info', 'Regra Removida', `${target?.domain ?? 'Domínio'} removido do dispositivo.`)
    } catch {
      toast('error', 'Falha ao Remover', 'Não foi possível excluir a regra.')
    } finally { setDevDeleting(false) }
  }

  // ── Derived ──
  const processed = useMemo(() => {
    let list = [...policies]
    if (filter !== 'all') list = list.filter(p => p.policy_type === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.domain.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    }
    if (sortKey) {
      list.sort((a, b) => {
        const va = a[sortKey] ?? ''; const vb = b[sortKey] ?? ''
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      })
    }
    return list
  }, [policies, filter, search, sortKey, sortDir])

  const blackCount = policies.filter(p => p.policy_type === 'blacklist').length
  const whiteCount = policies.filter(p => p.policy_type === 'whitelist').length
  const isActive   = adguard !== null && adguard.running === true

  const TABS = [
    { key: 'all'       as const, label: 'Todas',    count: policies.length },
    { key: 'blacklist' as const, label: 'Blacklist', count: blackCount      },
    { key: 'whitelist' as const, label: 'Whitelist', count: whiteCount      },
  ]

  const statCards = [
    { label: 'Consultas Hoje', value: stats?.total_queries ?? 0, color: '#3B82F6', icon: Activity    },
    { label: 'Bloqueados',     value: stats?.blocked_today ?? 0, color: '#EF4444', icon: Ban         },
    { label: 'Permitidos',     value: stats?.allowed_today ?? 0, color: '#10B981', icon: CheckCircle },
    { label: 'Regras Ativas',  value: policies.length,           color: ACCENT,    icon: Shield      },
  ]

  const SORT_COLS: { key: SortKey; label: string }[] = [
    { key: 'domain',     label: 'Domínio'      },
    { key: 'category',   label: 'Categoria'    },
    { key: 'created_at', label: 'Adicionado em' },
  ]

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <Globe size={20} style={{ color: ACCENT }} /> Segurança DNS
          </h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            Gerencie blacklists e whitelists de domínios
          </p>
        </div>
        {mainTab === 'global' && (
          <button
            onClick={() => showForm ? (setShowForm(false), setForm(f => ({ ...f, domain: '' }))) : setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: ACCENT, color: '#fff' }}>
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Cancelar' : 'Nova Política'}
          </button>
        )}
      </div>

      {/* ── Main tab switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: CARD, border: BORDER, width: 'fit-content' }}>
        {([
          { key: 'global' as const, label: 'Regras Globais', icon: Shield  },
          { key: 'device' as const, label: 'Por Dispositivo', icon: Monitor },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setMainTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={mainTab === key ? { background: ACCENT, color: '#fff' } : { color: MUTED }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════ GLOBAL RULES TAB ══════════════ */}
      {mainTab === 'global' && (
        <>
          {/* AdGuard status */}
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: adguard === null ? 'rgba(71,85,105,0.07)' : isActive ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)',
              border:     adguard === null ? '1px solid rgba(71,85,105,0.2)' : isActive ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(245,158,11,0.18)',
            }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: adguard === null ? 'rgba(71,85,105,0.12)' : isActive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}>
              {adguard === null
                ? <Loader size={15} className="animate-spin" style={{ color: MUTED }} />
                : isActive ? <CheckCircle size={16} style={{ color: '#10B981' }} /> : <AlertCircle size={16} style={{ color: '#F59E0B' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: TEXT }}>
                AdGuard Home:{' '}
                {adguard === null ? 'Verificando...' : isActive ? 'Ativo' : 'Inicializando'}
              </p>
              <p className="text-xs" style={{ color: MUTED }}>
                {isActive ? 'Filtragem DNS em operação · DoH e DoT habilitados' : 'O resolver DNS estará disponível em breve'}
              </p>
            </div>
            {isActive && (
              <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Online
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: CARD, border: BORDER }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: color + '18' }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums" style={{ color }}>
                    {value.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs leading-tight" style={{ color: MUTED }}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top blocked */}
          {stats && stats.top_blocked.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}>
                <BarChart2 size={14} style={{ color: ACCENT }} /> Top Domínios Bloqueados
              </p>
              <div className="space-y-2">
                {stats.top_blocked.map(({ domain, count }, i) => {
                  const max = stats.top_blocked[0]?.count || 1
                  const pct = Math.round((count / max) * 100)
                  return (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-xs w-4 text-right tabular-nums" style={{ color: MUTED }}>{i + 1}</span>
                      <span className="text-xs font-mono flex-1 truncate" style={{ color: SUB }}>{domain}</span>
                      <div className="w-24 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#EF4444' }} />
                      </div>
                      <span className="text-xs tabular-nums w-10 text-right" style={{ color: MUTED }}>
                        {count.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add policy form */}
          {showForm && (
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: CARD, border: '1px solid rgba(245,146,27,0.25)' }}>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>Nova Política DNS</p>
              <form onSubmit={add} className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <input type="text" required placeholder="dominio.com.br" value={form.domain}
                    onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                    className="flex-1 min-w-48 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: BG, border: BORDER, color: TEXT }} />
                  <div className="flex rounded-xl overflow-hidden" style={{ border: BORDER }}>
                    {([
                      { value: 'blacklist', label: 'Bloquear', color: '#EF4444' },
                      { value: 'whitelist', label: 'Liberar',  color: '#10B981' },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setForm(f => ({ ...f, policy_type: opt.value }))}
                        className="px-4 py-2.5 text-sm font-medium transition-all"
                        style={form.policy_type === opt.value
                          ? { background: opt.color + '20', color: opt.color, borderBottom: `2px solid ${opt.color}` }
                          : { background: BG, color: MUTED }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs mb-2" style={{ color: MUTED }}>Categoria</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.value} type="button"
                        onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={form.category === cat.value
                          ? { background: cat.color + '20', color: cat.color, border: `1px solid ${cat.color}50` }
                          : { background: BG, color: MUTED, border: BORDER }}>
                        <cat.Icon size={11} /> {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={adding}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: ACCENT, color: '#fff' }}>
                  {adding ? <><Loader size={14} className="animate-spin" /> Adicionando...</> : <><Plus size={15} /> Adicionar Política</>}
                </button>
              </form>
            </div>
          )}

          {/* Policy list */}
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: BORDER }}>
              <div className="flex items-center gap-2 flex-1 min-w-40 px-3 py-2 rounded-xl"
                style={{ background: BG, border: BORDER }}>
                <Search size={13} style={{ color: MUTED }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar domínio..." className="flex-1 text-xs bg-transparent outline-none"
                  style={{ color: TEXT }} />
                {search && <button type="button" onClick={() => setSearch('')} style={{ color: MUTED }}><X size={12} /></button>}
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: BG, border: BORDER }}>
                {TABS.map(({ key, label, count }) => (
                  <button key={key} type="button" onClick={() => setFilter(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={filter === key ? { background: ACCENT, color: '#fff' } : { color: MUTED }}>
                    {label}
                    <span className="px-1.5 py-0.5 rounded-full text-xs"
                      style={{
                        background: filter === key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                        color:      filter === key ? '#fff' : MUTED,
                      }}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-12 flex items-center justify-center gap-2 text-sm" style={{ color: MUTED }}>
                  <Loader size={14} className="animate-spin" /> Carregando...
                </div>
              ) : processed.length === 0 ? (
                <div className="py-14 text-center">
                  <Shield size={36} className="mx-auto mb-3 opacity-20" style={{ color: SUB }} />
                  <p className="text-sm font-medium" style={{ color: MUTED }}>
                    {search ? `Nenhum resultado para "${search}"` : 'Nenhuma política cadastrada'}
                  </p>
                  {!search && (
                    <button type="button" onClick={() => setShowForm(true)}
                      className="mt-3 text-xs underline transition-opacity hover:opacity-70"
                      style={{ color: ACCENT }}>
                      Adicionar primeira política →
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      {SORT_COLS.map(({ key, label }) => (
                        <th key={key}
                          className="px-5 py-3 text-left text-xs font-semibold cursor-pointer select-none hover:opacity-80"
                          style={{ color: sortKey === key ? ACCENT : MUTED }}
                          onClick={() => toggleSort(key)}>
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                          </span>
                        </th>
                      ))}
                      <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>Tipo</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {processed.map((p, i) => (
                      <tr key={p.id} className="group transition-colors hover:bg-white/[0.025]"
                        style={{ borderBottom: i < processed.length - 1 ? BORDER : 'none' }}>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-sm" style={{ color: TEXT }}>{p.domain}</span>
                        </td>
                        <td className="px-5 py-3.5"><CategoryBadge value={p.category} /></td>
                        <td className="px-5 py-3.5 text-xs tabular-nums" style={{ color: MUTED }}>
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3.5"><PolicyBadge type={p.policy_type} /></td>
                        <td className="px-5 py-3.5 text-right">
                          {confirmId === p.id ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="text-xs" style={{ color: MUTED }}>Remover?</span>
                              <button type="button" disabled={deleting} onClick={() => remove(p.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-60"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                                {deleting ? <Loader size={10} className="animate-spin" /> : 'Sim'}
                              </button>
                              <button type="button" disabled={deleting} onClick={() => setConfirmId(null)}
                                className="px-2 py-1 rounded-lg text-xs disabled:opacity-60"
                                style={{ color: MUTED, background: 'rgba(255,255,255,0.05)' }}>
                                Não
                              </button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setConfirmId(p.id)}
                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10"
                              style={{ color: MUTED }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {processed.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
                <p className="text-xs" style={{ color: MUTED }}>
                  {processed.length === policies.length
                    ? `${policies.length} política${policies.length !== 1 ? 's' : ''}`
                    : `${processed.length} de ${policies.length} políticas`}
                </p>
                <p className="text-xs" style={{ color: MUTED }}>
                  {blackCount} bloqueadas · {whiteCount} liberadas
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ PER-DEVICE TAB ══════════════ */}
      {mainTab === 'device' && (
        <div className="space-y-4">

          {/* Info banner */}
          <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <Monitor size={16} style={{ color: '#3B82F6', marginTop: 1, flexShrink: 0 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>Regras por Dispositivo</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                Crie regras DNS individuais por dispositivo. As regras globais continuam se aplicando a todos.
                Dispositivos identificados pelo IP registrado pelo agente.
              </p>
            </div>
          </div>

          {/* Device cards */}
          {devices.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: CARD, border: BORDER }}>
              <Monitor size={40} className="mx-auto mb-3 opacity-20" style={{ color: SUB }} />
              <p className="text-sm font-medium" style={{ color: MUTED }}>Nenhum dispositivo registrado</p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>
                Instale o agente em um dispositivo para criar regras individuais
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {devices.map(dev => (
                  <button key={dev.id} type="button" onClick={() => selectDevice(dev)}
                    className="text-left p-4 rounded-2xl transition-all"
                    style={{
                      background: CARD,
                      border: selDevice?.id === dev.id
                        ? `1px solid ${ACCENT}70`
                        : BORDER,
                      boxShadow: selDevice?.id === dev.id
                        ? `0 0 0 1px ${ACCENT}25, 0 4px 20px ${ACCENT}10`
                        : 'none',
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor size={15} style={{ color: selDevice?.id === dev.id ? ACCENT : MUTED, flexShrink: 0 }} />
                        <span className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                          {dev.hostname}
                        </span>
                      </div>
                      {dev.rule_count > 0 && (
                        <span className="ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: ACCENT + '20', color: ACCENT }}>
                          {dev.rule_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: dev.status === 'active' ? '#10B981' : '#475569' }} />
                      <span className="text-xs truncate" style={{ color: MUTED }}>
                        {dev.ip_address || 'IP desconhecido'}
                      </span>
                      {dev.os_type && (
                        <span className="text-xs capitalize flex-shrink-0" style={{ color: MUTED }}>
                          · {dev.os_type}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected device rule panel */}
              {selDevice && (
                <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>

                  {/* Panel header */}
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: BORDER }}>
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT }}>
                        <Monitor size={14} style={{ color: ACCENT }} />
                        {selDevice.hostname}
                        {selDevice.ip_address && (
                          <span className="text-xs font-mono font-normal" style={{ color: MUTED }}>
                            · {selDevice.ip_address}
                          </span>
                        )}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                        Regras específicas para este dispositivo · regras globais também se aplicam
                      </p>
                    </div>
                    <button
                      onClick={() => { setDevShowForm(f => !f); setDevForm(f => ({ ...f, domain: '' })) }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{ background: ACCENT, color: '#fff' }}>
                      {devShowForm ? <X size={12} /> : <Plus size={12} />}
                      {devShowForm ? 'Cancelar' : 'Nova Regra'}
                    </button>
                  </div>

                  {/* Add rule form */}
                  {devShowForm && (
                    <div className="px-5 py-4 space-y-3" style={{ borderBottom: BORDER, background: BG + 'cc' }}>
                      <form onSubmit={addDevicePolicy} className="space-y-3">
                        <div className="flex gap-2 flex-wrap">
                          <input type="text" required placeholder="dominio.com.br"
                            value={devForm.domain}
                            onChange={e => setDevForm(f => ({ ...f, domain: e.target.value }))}
                            className="flex-1 min-w-40 px-3 py-2 rounded-xl text-sm outline-none"
                            style={{ background: CARD, border: BORDER, color: TEXT }} />
                          <div className="flex rounded-xl overflow-hidden" style={{ border: BORDER }}>
                            {([
                              { value: 'blacklist', label: 'Bloquear', color: '#EF4444' },
                              { value: 'whitelist', label: 'Liberar',  color: '#10B981' },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button"
                                onClick={() => setDevForm(f => ({ ...f, policy_type: opt.value }))}
                                className="px-3 py-2 text-xs font-medium transition-all"
                                style={devForm.policy_type === opt.value
                                  ? { background: opt.color + '20', color: opt.color, borderBottom: `2px solid ${opt.color}` }
                                  : { background: BG, color: MUTED }}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map(cat => (
                            <button key={cat.value} type="button"
                              onClick={() => setDevForm(f => ({ ...f, category: cat.value }))}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                              style={devForm.category === cat.value
                                ? { background: cat.color + '20', color: cat.color, border: `1px solid ${cat.color}50` }
                                : { background: CARD, color: MUTED, border: BORDER }}>
                              <cat.Icon size={10} /> {cat.label}
                            </button>
                          ))}
                        </div>
                        <button type="submit" disabled={devAdding}
                          className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                          style={{ background: ACCENT, color: '#fff' }}>
                          {devAdding
                            ? <><Loader size={12} className="animate-spin" /> Adicionando...</>
                            : <><Plus size={12} /> Adicionar Regra</>}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Rules table */}
                  {devLoading ? (
                    <div className="py-10 flex items-center justify-center gap-2 text-sm" style={{ color: MUTED }}>
                      <Loader size={14} className="animate-spin" /> Carregando...
                    </div>
                  ) : devicePolicies.length === 0 ? (
                    <div className="py-12 text-center">
                      <Shield size={30} className="mx-auto mb-3 opacity-20" style={{ color: SUB }} />
                      <p className="text-sm" style={{ color: MUTED }}>Nenhuma regra específica para este dispositivo</p>
                      <button type="button" onClick={() => setDevShowForm(true)}
                        className="mt-3 text-xs underline transition-opacity hover:opacity-70"
                        style={{ color: ACCENT }}>
                        Adicionar primeira regra →
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px]">
                        <thead>
                          <tr style={{ borderBottom: BORDER }}>
                            <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>Domínio</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>Categoria</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>Tipo</th>
                            <th className="px-5 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {devicePolicies.map((p, i) => (
                            <tr key={p.id} className="group transition-colors hover:bg-white/[0.025]"
                              style={{ borderBottom: i < devicePolicies.length - 1 ? BORDER : 'none' }}>
                              <td className="px-5 py-3.5">
                                <span className="font-mono text-sm" style={{ color: TEXT }}>{p.domain}</span>
                              </td>
                              <td className="px-5 py-3.5"><CategoryBadge value={p.category} /></td>
                              <td className="px-5 py-3.5"><PolicyBadge type={p.policy_type} /></td>
                              <td className="px-5 py-3.5 text-right">
                                {devConfirmId === p.id ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="text-xs" style={{ color: MUTED }}>Remover?</span>
                                    <button type="button" disabled={devDeleting}
                                      onClick={() => removeDevicePolicy(p.id)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-60"
                                      style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                                      {devDeleting ? <Loader size={10} className="animate-spin" /> : 'Sim'}
                                    </button>
                                    <button type="button" disabled={devDeleting}
                                      onClick={() => setDevConfirmId(null)}
                                      className="px-2 py-1 rounded-lg text-xs disabled:opacity-60"
                                      style={{ color: MUTED, background: 'rgba(255,255,255,0.05)' }}>
                                      Não
                                    </button>
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => setDevConfirmId(p.id)}
                                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10"
                                    style={{ color: MUTED }}>
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {devicePolicies.length > 0 && (
                    <div className="px-5 py-3" style={{ borderTop: BORDER }}>
                      <p className="text-xs" style={{ color: MUTED }}>
                        {devicePolicies.length} regra{devicePolicies.length !== 1 ? 's' : ''} para {selDevice.hostname}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  )
}
