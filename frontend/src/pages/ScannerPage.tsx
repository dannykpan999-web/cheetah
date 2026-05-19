import { useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react'
import {
  FileSearch, Upload, Shield, AlertTriangle, CheckCircle, Trash2, X,
  FileText, Loader, Lock, ShieldCheck, Eye, ChevronDown, ChevronUp,
  AlertCircle, Archive,
} from 'lucide-react'
import api from '../api/client'

const BORDER  = '1px solid rgba(255,255,255,0.07)'
const CARD    = '#141929'
const BG      = '#0B0F1A'
const TEXT    = '#F1F5F9'
const SUB     = '#94A3B8'
const MUTED   = '#475569'
const ACCENT  = '#F5921B'
const GREEN   = '#10B981'
const RED     = '#EF4444'
const BLUE    = '#3B82F6'
const PURPLE  = '#7C3AED'
const YELLOW  = '#F59E0B'
const ORANGE  = '#F97316'

interface ScanResult {
  id: string
  file_name: string
  file_size: number
  file_hash: string
  mime_type: string
  scan_status: 'clean' | 'threat_found' | 'error' | 'pending'
  threats: string[]
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  scan_engine: string
  quarantined: boolean
  pii_detected: boolean
  pii_findings: string[]
  timestamp_token: string
  scanned_at: string
}

interface Stats {
  total_scanned: number
  threats_found: number
  clean_files: number
  quarantined: number
  pii_alerts: number
}

type Tab = 'history' | 'quarantine'

function formatBytes(n: number) {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

function RiskBadge({ level }: { level: string }) {
  const m: Record<string, [string, string]> = {
    low:      ['Baixo',    GREEN],
    medium:   ['Médio',    YELLOW],
    high:     ['Alto',     RED],
    critical: ['Crítico',  PURPLE],
  }
  const [label, color] = m[level] ?? m.low
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '1A', color, border: `1px solid ${color}33` }}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'clean')
    return <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: GREEN }}><CheckCircle size={12} /> Limpo</span>
  if (status === 'threat_found')
    return <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: RED }}><AlertTriangle size={12} /> Ameaça</span>
  if (status === 'pending')
    return <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: BLUE }}><Loader size={12} className="animate-spin" /> Analisando</span>
  return <span className="text-xs" style={{ color: MUTED }}>Erro</span>
}

function DocasSeal({ token }: { token: string }) {
  const short = token ? token.slice(0, 20) + '…' : ''
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-3"
      style={{ background: 'rgba(245,146,27,0.08)', border: '1px solid rgba(245,146,27,0.25)' }}>
      <ShieldCheck size={14} style={{ color: ACCENT, flexShrink: 0 }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: ACCENT }}>Confie Aqui · DOCAS Evidence Bridge</p>
        <p className="text-xs font-mono mt-0.5" style={{ color: MUTED }}>Token RFC-3161: {short}</p>
      </div>
    </div>
  )
}

function PiiBanner({ findings }: { findings: string[] }) {
  if (findings.length === 0) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-xl mt-2"
      style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
      <AlertCircle size={13} style={{ color: ORANGE, flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: ORANGE }}>Alerta LGPD — Dados Pessoais Detectados</p>
        <p className="text-xs mt-0.5" style={{ color: SUB }}>
          Tipos encontrados: <span style={{ color: TEXT }}>{findings.join(', ')}</span>
        </p>
      </div>
    </div>
  )
}

export default function ScannerPage() {
  const [results,    setResults]    = useState<ScanResult[]>([])
  const [quarantine, setQuarantine] = useState<ScanResult[]>([])
  const [stats,      setStats]      = useState<Stats>({ total_scanned: 0, threats_found: 0, clean_files: 0, quarantined: 0, pii_alerts: 0 })
  const [scanning,   setScanning]   = useState(false)
  const [dragging,   setDragging]   = useState(false)
  const [current,    setCurrent]    = useState<ScanResult | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab,        setTab]        = useState<Tab>('history')
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState(false)
  const [search,     setSearch]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [r, q, s] = await Promise.all([
        api.get<ScanResult[]>('/scanner/results'),
        api.get<ScanResult[]>('/scanner/quarantine'),
        api.get<Stats>('/scanner/stats'),
      ])
      setResults(r.data)
      setQuarantine(q.data)
      setStats(s.data)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  async function scanFile(file: File) {
    setScanning(true)
    setCurrent({
      id: 'pending', file_name: file.name, file_size: file.size,
      file_hash: '', mime_type: '', scan_status: 'pending', threats: [],
      risk_level: 'low', scan_engine: 'Cheetah Scanner v1.0',
      quarantined: false, pii_detected: false, pii_findings: [],
      timestamp_token: '', scanned_at: new Date().toISOString(),
    })
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await api.post<ScanResult>('/scanner/upload', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } })
      setCurrent(data)
      await load()
    } catch { setCurrent(null) } finally { setScanning(false) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && !scanning) scanFile(file)
  }

  async function remove(id: string) {
    setDeleting(true)
    try {
      await api.delete(`/scanner/results/${id}`)
      if (current?.id === id) setCurrent(null)
      setConfirmId(null)
      await load()
    } catch {} finally { setDeleting(false) }
  }

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase()
    return results.filter(r => !q || r.file_name.toLowerCase().includes(q) || r.risk_level.includes(q))
  }, [results, search])

  const activeList = tab === 'quarantine' ? quarantine : filteredResults

  const statusStyle = (s: string) =>
    s === 'pending'      ? { background: 'rgba(59,130,246,0.08)',  border: '1px solid rgba(59,130,246,0.2)' }
    : s === 'clean'      ? { background: 'rgba(16,185,129,0.08)',  border: '1px solid rgba(16,185,129,0.2)' }
    :                      { background: 'rgba(239,68,68,0.08)',   border: '1px solid rgba(239,68,68,0.2)' }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <FileSearch size={20} style={{ color: ACCENT }} /> Scanner de Documentos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            Cheetah Scanner v1.0 + ClamAV · Detecção de ameaças e conformidade LGPD
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(245,146,27,0.1)', border: '1px solid rgba(245,146,27,0.25)', color: ACCENT }}>
          <ShieldCheck size={12} /> DOCAS Bridge Ativo
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        {[
          { label: 'Total Analisados',    value: stats.total_scanned, color: BLUE   },
          { label: 'Ameaças Detectadas',  value: stats.threats_found, color: RED    },
          { label: 'Arquivos Limpos',     value: stats.clean_files,   color: GREEN  },
          { label: 'Em Quarentena',       value: stats.quarantined,   color: PURPLE },
          { label: 'Alertas LGPD',        value: stats.pii_alerts,    color: ORANGE },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 text-center" style={{ background: CARD, border: BORDER }}>
            <p className="text-xl md:text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-1 leading-tight" style={{ color: MUTED }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !scanning && fileRef.current?.click()}
        className="rounded-2xl p-10 text-center cursor-pointer transition-all select-none"
        style={dragging
          ? { background: 'rgba(245,146,27,0.08)', border: '2px dashed rgba(245,146,27,0.5)' }
          : { background: CARD, border: '2px dashed rgba(255,255,255,0.08)' }}>
        <input ref={fileRef} type="file" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) scanFile(f); e.target.value = '' }} />
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: scanning ? 'rgba(245,146,27,0.12)' : 'rgba(255,255,255,0.04)', border: BORDER }}>
          {scanning
            ? <Loader size={24} className="animate-spin" style={{ color: ACCENT }} />
            : <Upload size={24} style={{ color: MUTED }} />}
        </div>
        <p className="font-semibold text-sm" style={{ color: TEXT }}>
          {scanning ? 'Analisando arquivo...' : 'Arraste um arquivo ou clique para selecionar'}
        </p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          PDF, DOC, XLS, EXE, ZIP, scripts · Máx. 50 MB · Timestamp RFC-3161 automático
        </p>
      </div>

      {/* Current result */}
      {current && (
        <div className="p-5 rounded-2xl" style={statusStyle(current.scan_status)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: current.scan_status === 'pending' ? 'rgba(59,130,246,0.15)'
                  : current.scan_status === 'clean' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                {current.scan_status === 'pending'
                  ? <Loader size={18} className="animate-spin" style={{ color: BLUE }} />
                  : current.scan_status === 'clean'
                  ? <CheckCircle size={18} style={{ color: GREEN }} />
                  : <AlertTriangle size={18} style={{ color: RED }} />}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: TEXT }}>{current.file_name}</p>
                <p className="text-xs" style={{ color: MUTED }}>{formatBytes(current.file_size)}</p>
              </div>
            </div>
            <button onClick={() => setCurrent(null)} style={{ color: MUTED }}><X size={16} /></button>
          </div>

          {current.scan_status !== 'pending' && (
            <div className="mt-4">
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <StatusBadge status={current.scan_status} />
                <RiskBadge level={current.risk_level} />
                <span className="text-xs" style={{ color: MUTED }}>Motor: {current.scan_engine}</span>
              </div>

              {/* Threats */}
              {current.threats.length > 0 ? (
                <div className="space-y-2">
                  {current.threats.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
                      <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {t}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-medium" style={{ color: GREEN }}>Nenhuma ameaça detectada. Arquivo seguro.</p>
              )}

              {/* PII LGPD alert */}
              <PiiBanner findings={current.pii_findings} />

              {/* DOCAS seal for clean files */}
              {current.scan_status === 'clean' && !current.pii_detected && current.timestamp_token && (
                <DocasSeal token={current.timestamp_token} />
              )}

              {current.file_hash && (
                <p className="mt-3 text-xs font-mono break-all" style={{ color: MUTED }}>
                  SHA256: {current.file_hash}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-xl overflow-hidden" style={{ border: BORDER }}>
          {(['history', 'quarantine'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              style={tab === t
                ? { background: ACCENT, color: '#000' }
                : { background: CARD, color: MUTED }}>
              {t === 'history' ? <FileText size={12} /> : <Archive size={12} />}
              {t === 'history' ? 'Histórico' : `Quarentena (${stats.quarantined})`}
            </button>
          ))}
        </div>
        {tab === 'history' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-0 max-w-64"
            style={{ background: CARD, border: BORDER }}>
            <Eye size={13} style={{ color: MUTED, flexShrink: 0 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar por nome ou risco…"
              className="bg-transparent outline-none text-xs w-full"
              style={{ color: TEXT }}
            />
            {search && <button onClick={() => setSearch('')} style={{ color: MUTED }}><X size={12} /></button>}
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
          <h2 className="text-sm font-semibold" style={{ color: TEXT }}>
            {tab === 'history' ? 'Histórico de Análises' : 'Arquivos em Quarentena'}
          </h2>
          <Shield size={14} style={{ color: MUTED }} />
        </div>

        {activeList.length === 0 ? (
          <div className="text-center py-12">
            {tab === 'quarantine'
              ? <Lock size={32} className="mx-auto mb-2" style={{ color: MUTED }} />
              : <FileText size={32} className="mx-auto mb-2" style={{ color: MUTED }} />}
            <p className="text-sm" style={{ color: MUTED }}>
              {tab === 'quarantine' ? 'Nenhum arquivo em quarentena' : 'Nenhum arquivo analisado'}
            </p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              {tab === 'quarantine' ? 'Arquivos com ameaças aparecem aqui' : 'Arraste um arquivo acima para começar'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead>
                <tr style={{ borderBottom: BORDER }}>
                  {['Arquivo', 'Tamanho', 'Status', 'Risco', 'LGPD', 'Analisado em', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeList.map((r, i) => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: i < activeList.length - 1 || expandedId === r.id ? BORDER : 'none' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={13} style={{ color: MUTED, flexShrink: 0 }} />
                          <span className="text-xs font-mono truncate max-w-44" style={{ color: SUB }}>{r.file_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: MUTED }}>{formatBytes(r.file_size)}</td>
                      <td className="px-5 py-3"><StatusBadge status={r.scan_status} /></td>
                      <td className="px-5 py-3"><RiskBadge level={r.risk_level} /></td>
                      <td className="px-5 py-3">
                        {r.pii_detected
                          ? <span className="text-xs font-semibold flex items-center gap-1" style={{ color: ORANGE }}>
                              <AlertCircle size={11} /> PII
                            </span>
                          : <span className="text-xs" style={{ color: MUTED }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: MUTED }}>
                        {new Date(r.scanned_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {expandedId === r.id
                            ? <ChevronUp size={13} style={{ color: MUTED }} />
                            : <ChevronDown size={13} style={{ color: MUTED }} />}
                          {confirmId === r.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={e => { e.stopPropagation(); remove(r.id) }}
                                disabled={deleting}
                                className="text-xs font-semibold px-2 py-0.5 rounded"
                                style={{ background: 'rgba(239,68,68,0.15)', color: RED }}>
                                {deleting ? <Loader size={10} className="animate-spin" /> : 'Sim'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmId(null) }}
                                className="text-xs px-2 py-0.5 rounded"
                                style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}>
                                Não
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmId(r.id) }}
                              className="transition-colors hover:text-red-500"
                              style={{ color: MUTED }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === r.id && (
                      <tr style={{ borderBottom: i < activeList.length - 1 ? BORDER : 'none' }}>
                        <td colSpan={7} className="px-6 py-4" style={{ background: BG }}>
                          <p className="text-xs font-mono mb-1" style={{ color: MUTED }}>
                            SHA256: {r.file_hash || 'n/a'}
                          </p>
                          <p className="text-xs mb-2" style={{ color: MUTED }}>
                            MIME: {r.mime_type || 'n/a'} · Motor: {r.scan_engine}
                          </p>

                          {/* Threats */}
                          {r.threats.length > 0 ? (
                            <div className="space-y-1.5 mb-2">
                              {r.threats.map((t, j) => (
                                <div key={j} className="flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg"
                                  style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5' }}>
                                  <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" /> {t}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs font-medium mb-2" style={{ color: GREEN }}>Nenhuma ameaça detectada</p>
                          )}

                          {/* PII findings */}
                          <PiiBanner findings={r.pii_findings} />

                          {/* DOCAS seal */}
                          {r.scan_status === 'clean' && !r.pii_detected && r.timestamp_token && (
                            <DocasSeal token={r.timestamp_token} />
                          )}

                          {/* Timestamp token for all files */}
                          {r.timestamp_token && (
                            <p className="text-xs font-mono mt-2 break-all" style={{ color: MUTED }}>
                              RFC-3161: {r.timestamp_token.slice(0, 64)}…
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {activeList.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
            <span className="text-xs" style={{ color: MUTED }}>
              {activeList.length} {activeList.length === 1 ? 'arquivo' : 'arquivos'}
            </span>
            <span className="text-xs flex items-center gap-1" style={{ color: MUTED }}>
              <ShieldCheck size={11} style={{ color: ACCENT }} />
              Cada análise recebe timestamp RFC-3161 via DOCAS Bridge
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
