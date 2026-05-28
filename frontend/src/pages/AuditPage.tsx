import { useEffect, useState, useMemo } from 'react'
import {
  ScrollText, Search, X, Loader, Download,
  LogIn, LogOut, Shield, Globe, Monitor, FileSearch,
  Settings, Headphones, AlertTriangle, Info,
} from 'lucide-react'
import api from '../api/client'

const BORDER = '1px solid rgba(255,255,255,0.07)'
const CARD   = '#141929'
const TEXT   = '#F1F5F9'
const MUTED  = '#475569'
const SUB    = '#94A3B8'
const ACCENT = '#F5921B'
const BG     = '#0B0F1A'

interface LogEntry {
  id: string
  action: string
  resource: string | null
  ip_address: string | null
  created_at: string
}

function actionMeta(action: string): { color: string; bg: string; Icon: any; label: string } {
  const a = action.toLowerCase()
  if (a.includes('login') || a.includes('token'))
    return { color: '#10B981', bg: 'rgba(16,185,129,0.12)', Icon: LogIn,      label: 'Auth'      }
  if (a.includes('logout'))
    return { color: '#64748B', bg: 'rgba(100,116,139,0.12)', Icon: LogOut,     label: 'Auth'      }
  if (a.includes('dns') || a.includes('policy'))
    return { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  Icon: Globe,      label: 'DNS'       }
  if (a.includes('scan'))
    return { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  Icon: FileSearch, label: 'Scanner'   }
  if (a.includes('endpoint') || a.includes('agent'))
    return { color: '#14B8A6', bg: 'rgba(20,184,166,0.12)',  Icon: Monitor,    label: 'Endpoint'  }
  if (a.includes('support') || a.includes('ticket'))
    return { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  Icon: Headphones, label: 'Suporte'   }
  if (a.includes('delete') || a.includes('remov') || a.includes('threat'))
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   Icon: AlertTriangle, label: 'Crítico' }
  if (a.includes('password') || a.includes('senha') || a.includes('auth'))
    return { color: '#F5921B', bg: 'rgba(245,146,27,0.12)',  Icon: Shield,     label: 'Segurança' }
  if (a.includes('setting') || a.includes('update') || a.includes('profile'))
    return { color: '#64748B', bg: 'rgba(100,116,139,0.12)', Icon: Settings,   label: 'Config'    }
  return { color: '#64748B', bg: 'rgba(100,116,139,0.12)',   Icon: Info,       label: 'Sistema'   }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function AuditPage() {
  const [logs, setLogs]       = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [limit, setLimit]     = useState(100)

  useEffect(() => { load() }, [limit])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get<LogEntry[]>(`/audit/logs?limit=${limit}`)
      setLogs(r.data)
    } catch {} finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter(l =>
      l.action.toLowerCase().includes(q) ||
      (l.resource || '').toLowerCase().includes(q) ||
      (l.ip_address || '').includes(q)
    )
  }, [logs, search])

  function exportCSV() {
    const header = 'Data,Ação,Recurso,IP\n'
    const rows = filtered.map(l =>
      `"${new Date(l.created_at).toLocaleString('pt-BR')}","${l.action}","${l.resource || ''}","${l.ip_address || ''}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <ScrollText size={20} style={{ color: ACCENT }} /> Auditoria
          </h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            Histórico de todas as ações no sistema
          </p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: CARD, border: BORDER, color: SUB }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-xl"
          style={{ background: CARD, border: BORDER }}>
          <Search size={13} style={{ color: MUTED }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ação, recurso ou IP..."
            className="flex-1 text-sm bg-transparent outline-none" style={{ color: TEXT }} />
          {search && <button type="button" onClick={() => setSearch('')} style={{ color: MUTED }}><X size={12} /></button>}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: CARD, border: BORDER }}>
          {([50, 100, 200] as const).map(n => (
            <button key={n} type="button" onClick={() => setLimit(n)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={limit === n ? { background: ACCENT, color: '#fff' } : { color: MUTED }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Log table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm" style={{ color: MUTED }}>
            <Loader size={14} className="animate-spin" /> Carregando logs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText size={36} className="mx-auto mb-3 opacity-20" style={{ color: SUB }} />
            <p className="text-sm" style={{ color: MUTED }}>
              {search ? `Nenhum resultado para "${search}"` : 'Nenhum log encontrado'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="px-5 py-3 grid grid-cols-12 gap-3 text-xs font-semibold"
              style={{ color: MUTED, borderBottom: BORDER }}>
              <div className="col-span-1">Tipo</div>
              <div className="col-span-5">Ação</div>
              <div className="col-span-2">Recurso</div>
              <div className="col-span-2">IP</div>
              <div className="col-span-2 text-right">Quando</div>
            </div>

            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              {filtered.map(log => {
                const meta = actionMeta(log.action)
                return (
                  <div key={log.id} className="px-5 py-3 grid grid-cols-12 gap-3 items-center hover:bg-white/[0.02] transition-colors">
                    {/* Type icon */}
                    <div className="col-span-1">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: meta.bg }}>
                        <meta.Icon size={13} style={{ color: meta.color }} />
                      </div>
                    </div>

                    {/* Action */}
                    <div className="col-span-5 min-w-0">
                      <p className="text-sm truncate" style={{ color: TEXT }}>{log.action}</p>
                      <span className="text-xs" style={{ color: meta.color }}>{meta.label}</span>
                    </div>

                    {/* Resource */}
                    <div className="col-span-2 min-w-0">
                      <span className="text-xs font-mono truncate block" style={{ color: MUTED }}>
                        {log.resource || '—'}
                      </span>
                    </div>

                    {/* IP */}
                    <div className="col-span-2">
                      <span className="text-xs font-mono" style={{ color: MUTED }}>
                        {log.ip_address || '—'}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="col-span-2 text-right">
                      <span className="text-xs" style={{ color: MUTED }}>
                        {relativeTime(log.created_at)}
                      </span>
                      <p className="text-xs" style={{ color: MUTED, opacity: 0.5 }}>
                        {new Date(log.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
              <p className="text-xs" style={{ color: MUTED }}>
                {filtered.length === logs.length
                  ? `${logs.length} registro${logs.length !== 1 ? 's' : ''}`
                  : `${filtered.length} de ${logs.length} registros`}
              </p>
              {logs.length >= limit && (
                <button type="button"
                  onClick={() => setLimit(l => l + 100)}
                  className="text-xs underline transition-opacity hover:opacity-70"
                  style={{ color: ACCENT }}>
                  Carregar mais →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
