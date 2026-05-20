import { useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react'
import {
  FileSearch, Upload, Shield, AlertTriangle, CheckCircle, Trash2, X,
  FileText, Loader, Lock, ShieldCheck, ChevronDown, ChevronUp,
  AlertCircle, Archive, Download, ShieldOff, Filter, Search,
  TrendingUp, Clock, Terminal,
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
const TEAL    = '#14B8A6'

interface ScanResult {
  id: string; file_name: string; file_size: number; file_hash: string
  mime_type: string; scan_status: 'clean' | 'threat_found' | 'error' | 'pending'
  threats: string[]; risk_level: 'low' | 'medium' | 'high' | 'critical'
  scan_engine: string; quarantined: boolean; pii_detected: boolean
  pii_findings: string[]; timestamp_token: string; scanned_at: string
}
interface Stats {
  total_scanned: number; threats_found: number; clean_files: number
  quarantined: number; pii_alerts: number
}
type Tab = 'history' | 'quarantine'

const SCAN_STAGES = [
  { id: 'upload',   label: 'UPLOAD'   },
  { id: 'clamav',   label: 'CLAMAV'   },
  { id: 'ai',       label: 'AI SCAN'  },
  { id: 'docas',    label: 'RFC-3161' },
  { id: 'complete', label: 'COMPLETE' },
]
const STAGE_LOGS: string[][] = [
  ['[SYSTEM] Iniciando upload seguro...', '[HASH] Calculando SHA-256 do arquivo'],
  ['[ENGINE] ClamAV daemon conectado', '[SCAN] Verificando 8.7M assinaturas...'],
  ['[AI] Carregando modelo de detecção', '[AI] Analisando entropia e padrões PII (LGPD)'],
  ['[DOCAS] Gerando token RFC-3161', '[DOCAS] Evidence Bridge: carimbo aplicado'],
  ['[SYSTEM] Análise concluída', '[REPORT] Relatório gerado'],
]

function formatBytes(n: number) {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}
function riskColor(level: string) {
  return ({ low: GREEN, medium: YELLOW, high: ORANGE, critical: PURPLE } as Record<string,string>)[level] ?? GREEN
}

function RiskBadge({ level }: { level: string }) {
  const m: Record<string,[string,string]> = {
    low: ['Baixo', GREEN], medium: ['Médio', YELLOW],
    high: ['Alto', ORANGE], critical: ['Crítico', PURPLE],
  }
  const [label, color] = m[level] ?? m.low
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color+'1A', color, border: `1px solid ${color}33` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{label}
    </span>
  )
}

function StatusPill({ status, quarantined }: { status: string; quarantined?: boolean }) {
  if (quarantined)
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: PURPLE+'1A', color: PURPLE, border: `1px solid ${PURPLE}33` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PURPLE }} />Quarentena</span>
  if (status === 'clean')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: GREEN+'1A', color: GREEN, border: `1px solid ${GREEN}33` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />Limpo</span>
  if (status === 'threat_found')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: RED+'1A', color: RED, border: `1px solid ${RED}33` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: RED }} />Ameaça</span>
  if (status === 'pending')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: BLUE+'1A', color: BLUE, border: `1px solid ${BLUE}33` }}>
      <Loader size={10} className="animate-spin" />Analisando</span>
  return <span className="text-xs" style={{ color: MUTED }}>Erro</span>
}

// Fortexa-style risk arc gauge
function RiskArc({ threats, total }: { threats: number; total: number }) {
  const pct = total > 0 ? Math.round((threats / total) * 100) : 0
  const r = 32, circ = 2 * Math.PI * r, arcLen = circ * 0.75
  const filled = arcLen * pct / 100
  const color = pct > 50 ? RED : pct > 20 ? YELLOW : GREEN
  return (
    <div style={{ position: 'relative', width: 84, height: 84 }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <g transform="rotate(135 42 42)">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.06)"
            strokeWidth="7" strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={color}
            strokeWidth="7" strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 4px ${color}99)` }} />
        </g>
      </svg>
      <div style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
        <p className="text-base font-bold leading-none" style={{ color }}>{pct}%</p>
        <p style={{ fontSize: '9px', color: MUTED, marginTop: 2 }}>RISCO</p>
      </div>
    </div>
  )
}

// SentinelOS-style live scan panel
function ScanProgressPanel({ fileName, stage, logs, pct }: {
  fileName: string; stage: number; logs: string[]; pct: number
}) {
  const logEnd = useRef<HTMLDivElement>(null)
  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${TEAL}33` }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ background: '#0A1018', borderBottom: `1px solid ${TEAL}22` }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: TEAL }} />
          <span className="text-xs font-bold tracking-widest" style={{ color: TEAL }}>SCANNING</span>
          <span className="text-xs font-mono truncate max-w-60" style={{ color: SUB }}>{fileName}</span>
        </div>
        <span className="text-xs" style={{ color: MUTED }}>Cheetah Scanner v1.0</span>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5">
        {/* Left: ring + stages */}
        <div className="flex flex-col items-center gap-4">
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={TEAL} strokeWidth="8"
                strokeDasharray={`${2*Math.PI*50}`}
                strokeDashoffset={2*Math.PI*50*(1 - pct/100)}
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 6px ${TEAL}88)` }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span className="text-2xl font-bold" style={{ color: TEAL }}>{pct}%</span>
              <span style={{ fontSize: '10px', color: MUTED }}>PROGRESSO</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            {SCAN_STAGES.map((s, i) => {
              const done = i < stage, active = i === stage
              const col = done ? GREEN : active ? TEAL : MUTED
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: done ? GREEN+'22' : active ? TEAL+'22' : 'rgba(255,255,255,0.04)', border: `1px solid ${col}` }}>
                    {done
                      ? <CheckCircle size={10} style={{ color: GREEN }} />
                      : active
                      ? <Loader size={10} className="animate-spin" style={{ color: TEAL }} />
                      : <span className="w-1 h-1 rounded-full" style={{ background: MUTED }} />}
                  </div>
                  <span className="text-xs font-mono" style={{ color: col, fontWeight: active ? 700 : 400 }}>{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: console */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#06080F', border: BORDER }}>
          <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: BORDER }}>
            <Terminal size={12} style={{ color: TEAL }} />
            <span className="text-xs font-semibold tracking-wider" style={{ color: TEAL }}>LIVE ACTIVITY CONSOLE</span>
          </div>
          <div className="px-4 py-3 h-40 overflow-y-auto space-y-0.5 font-mono text-xs">
            {logs.map((line, i) => {
              const isAI    = line.startsWith('[AI]')
              const isScan  = line.startsWith('[SCAN]') || line.startsWith('[ENGINE]')
              const isDocas = line.startsWith('[DOCAS]')
              const isHash  = line.startsWith('[HASH]')
              const col = isAI ? BLUE : isScan ? GREEN : isDocas ? ACCENT : isHash ? YELLOW : SUB
              const bracket = line.indexOf(']')
              const tag  = line.slice(0, bracket + 1)
              const rest = line.slice(bracket + 2)
              return (
                <div key={i} className="flex gap-2 leading-5">
                  <span style={{ color: MUTED, minWidth: 20 }}>{String(i + 1).padStart(2,'0')}</span>
                  <span style={{ color: col }}>{tag}</span>
                  <span style={{ color: SUB+'CC' }}>{rest}</span>
                </div>
              )
            })}
            <div ref={logEnd} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DocasSeal({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-3"
      style={{ background: 'rgba(245,146,27,0.08)', border: '1px solid rgba(245,146,27,0.25)' }}>
      <ShieldCheck size={14} style={{ color: ACCENT, flexShrink: 0 }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: ACCENT }}>DOCAS Evidence Bridge · RFC-3161</p>
        <p className="text-xs font-mono mt-0.5" style={{ color: MUTED }}>{token.slice(0, 24)}…</p>
      </div>
    </div>
  )
}

function PiiBanner({ findings }: { findings: string[] }) {
  if (!findings.length) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-xl mt-2"
      style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
      <AlertCircle size={13} style={{ color: ORANGE, flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: ORANGE }}>Alerta LGPD — Dados Pessoais Detectados</p>
        <p className="text-xs mt-0.5" style={{ color: SUB }}>
          Tipos: <span style={{ color: TEXT }}>{findings.join(', ')}</span>
        </p>
      </div>
    </div>
  )
}

export default function ScannerPage() {
  const [results,      setResults]      = useState<ScanResult[]>([])
  const [quarantine,   setQuarantine]   = useState<ScanResult[]>([])
  const [stats,        setStats]        = useState<Stats>({ total_scanned:0, threats_found:0, clean_files:0, quarantined:0, pii_alerts:0 })
  const [scanning,     setScanning]     = useState(false)
  const [dragging,     setDragging]     = useState(false)
  const [current,      setCurrent]      = useState<ScanResult | null>(null)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [tab,          setTab]          = useState<Tab>('history')
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [search,       setSearch]       = useState('')
  const [filterRisk,   setFilterRisk]   = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate,   setFilterDate]   = useState('all')
  const [releasingId,  setReleasingId]  = useState<string | null>(null)
  const [dlPdfId,      setDlPdfId]      = useState<string | null>(null)
  const [scanStage,    setScanStage]    = useState(0)
  const [scanLogs,     setScanLogs]     = useState<string[]>([])
  const [scanPct,      setScanPct]      = useState(0)
  const [scanFileName, setScanFileName] = useState('')
  const fileRef   = useRef<HTMLInputElement>(null)
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (scanning) {
      setScanStage(0); setScanPct(0); setScanLogs([...STAGE_LOGS[0]])
      let s = 0
      stageTimer.current = setInterval(() => {
        s = Math.min(s + 1, 4)
        setScanStage(s)
        setScanPct(s * 25)
        setScanLogs(prev => [...prev, ...(STAGE_LOGS[s] ?? [])])
      }, 2000)
    } else {
      if (stageTimer.current) clearInterval(stageTimer.current)
      setScanPct(100)
    }
    return () => { if (stageTimer.current) clearInterval(stageTimer.current) }
  }, [scanning])

  const load = useCallback(async () => {
    try {
      const [r, q, s] = await Promise.all([
        api.get<ScanResult[]>('/scanner/results'),
        api.get<ScanResult[]>('/scanner/quarantine'),
        api.get<Stats>('/scanner/stats'),
      ])
      setResults(r.data); setQuarantine(q.data); setStats(s.data)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  async function scanFile(file: File) {
    setScanning(true); setScanFileName(file.name)
    setCurrent({ id:'pending', file_name:file.name, file_size:file.size, file_hash:'', mime_type:'',
      scan_status:'pending', threats:[], risk_level:'low', scan_engine:'Cheetah Scanner v1.0',
      quarantined:false, pii_detected:false, pii_findings:[], timestamp_token:'', scanned_at:new Date().toISOString() })
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await api.post<ScanResult>('/scanner/upload', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } })
      setCurrent(data); await load()
    } catch { setCurrent(null) } finally { setScanning(false) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f && !scanning) scanFile(f)
  }

  async function remove(id: string) {
    setDeleting(true)
    try {
      await api.delete(`/scanner/results/${id}`)
      if (current?.id === id) setCurrent(null); setConfirmId(null); await load()
    } catch {} finally { setDeleting(false) }
  }

  async function downloadCSV() {
    try {
      const r = await api.get('/scanner/results/export', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type:'text/csv' }))
      const a = document.createElement('a'); a.href=url; a.download='cheetah_scans.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  async function downloadPDF(id: string, fileName: string) {
    setDlPdfId(id)
    try {
      const r = await api.get(`/scanner/results/${id}/report`, { responseType:'blob' })
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type:'application/pdf' }))
      const a = document.createElement('a'); a.href=url
      a.download=`cheetah_report_${fileName.replace(/[^a-zA-Z0-9._-]/g,'_')}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch {} finally { setDlPdfId(null) }
  }

  async function releaseQuarantine(id: string) {
    setReleasingId(id)
    try { await api.post(`/scanner/quarantine/${id}/release`); await load() }
    catch {} finally { setReleasingId(null) }
  }

  const filteredResults = useMemo(() => {
    const q = search.toLowerCase()
    const now = Date.now()
    const cutoff = filterDate==='today' ? new Date().setHours(0,0,0,0)
      : filterDate==='week' ? now - 7*86400000 : filterDate==='month' ? now - 30*86400000 : 0
    return results.filter(r => {
      if (filterRisk  !=='all' && r.risk_level  !==filterRisk)  return false
      if (filterStatus!=='all' && r.scan_status !==filterStatus) return false
      if (cutoff && new Date(r.scanned_at).getTime() < cutoff)  return false
      if (q && !r.file_name.toLowerCase().includes(q))          return false
      return true
    })
  }, [results, search, filterRisk, filterStatus, filterDate])

  const activeList = tab === 'quarantine' ? quarantine : filteredResults

  function Chip({ active, onClick, children }: { active:boolean; onClick:()=>void; children:React.ReactNode }) {
    return (
      <button onClick={onClick}
        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
        style={active
          ? { background: ACCENT, color: '#000' }
          : { background: 'rgba(255,255,255,0.04)', color: MUTED, border: BORDER }}>
        {children}
      </button>
    )
  }

  const statusStyle = (s: string) =>
    s==='clean'   ? { background:'rgba(16,185,129,0.08)',  border:'1px solid rgba(16,185,129,0.2)' }
    : s==='pending' ? { background:'rgba(59,130,246,0.08)',  border:'1px solid rgba(59,130,246,0.2)' }
    :                 { background:'rgba(239,68,68,0.08)',   border:'1px solid rgba(239,68,68,0.2)' }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: MUTED }}>
            <Shield size={10} /><span>Scanner</span>
            <span style={{ color: MUTED }}>›</span>
            <span style={{ color: SUB }}>Detecções</span>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <FileSearch size={20} style={{ color: ACCENT }} />Scanner de Documentos
          </h1>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>ClamAV · AI · LGPD · DOCAS RFC-3161</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background:'rgba(245,146,27,0.1)', border:'1px solid rgba(245,146,27,0.25)', color:ACCENT }}>
            <ShieldCheck size={12} />DOCAS Ativo
          </div>
          <button onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background:CARD, color:SUB, border:BORDER }}>
            <Download size={12} />Exportar CSV
          </button>
        </div>
      </div>

      {/* ── KPI cards (IndustryOS) + Risk Arc (Fortexa) ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {([
          { label:'Total Analisados',   value:stats.total_scanned, color:BLUE,   Icon:FileSearch },
          { label:'Ameaças Detectadas', value:stats.threats_found, color:RED,    Icon:AlertTriangle },
          { label:'Arquivos Limpos',    value:stats.clean_files,   color:GREEN,  Icon:CheckCircle },
          { label:'Em Quarentena',      value:stats.quarantined,   color:PURPLE, Icon:Archive },
          { label:'Alertas LGPD',       value:stats.pii_alerts,    color:ORANGE, Icon:AlertCircle },
        ] as { label:string; value:number; color:string; Icon:React.ElementType }[]).map(({ label, value, color, Icon }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background:CARD, border:BORDER }}>
            <div className="flex items-start justify-between mb-2">
              <Icon size={14} style={{ color }} />
              <TrendingUp size={11} style={{ color:MUTED }} />
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-1 leading-tight" style={{ color:MUTED }}>{label}</p>
          </div>
        ))}
        {/* Risk arc card */}
        <div className="rounded-2xl p-3 flex flex-col items-center justify-center gap-1"
          style={{ background:CARD, border:BORDER }}>
          <RiskArc threats={stats.threats_found} total={stats.total_scanned} />
          <p className="text-xs text-center" style={{ color:MUTED }}>Taxa de Ameaças</p>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !scanning && fileRef.current?.click()}
        className="rounded-2xl p-8 text-center cursor-pointer transition-all select-none"
        style={dragging
          ? { background:'rgba(245,146,27,0.08)', border:'2px dashed rgba(245,146,27,0.5)' }
          : scanning
          ? { background:'rgba(20,184,166,0.05)', border:`2px dashed ${TEAL}55` }
          : { background:CARD, border:'2px dashed rgba(255,255,255,0.08)' }}>
        <input ref={fileRef} type="file" className="hidden"
          onChange={e => { const f=e.target.files?.[0]; if (f) scanFile(f); e.target.value='' }} />
        <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: scanning ? TEAL+'15' : 'rgba(255,255,255,0.04)', border:BORDER }}>
          {scanning
            ? <Loader size={22} className="animate-spin" style={{ color:TEAL }} />
            : <Upload size={22} style={{ color:MUTED }} />}
        </div>
        <p className="font-semibold text-sm" style={{ color: scanning ? TEAL : TEXT }}>
          {scanning ? `Analisando ${scanFileName}…` : 'Arraste um arquivo ou clique para selecionar'}
        </p>
        <p className="text-xs mt-1" style={{ color:MUTED }}>
          PDF, DOC, XLS, EXE, ZIP, scripts · Máx. 50 MB · Timestamp RFC-3161 automático
        </p>
      </div>

      {/* ── SentinelOS scan progress panel ── */}
      {scanning && (
        <ScanProgressPanel fileName={scanFileName} stage={scanStage} logs={scanLogs} pct={scanPct} />
      )}

      {/* ── Completed scan result ── */}
      {!scanning && current && current.id !== 'pending' && (
        <div className="p-5 rounded-2xl" style={statusStyle(current.scan_status)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: current.scan_status==='clean' ? GREEN+'15' : RED+'15' }}>
                {current.scan_status==='clean'
                  ? <CheckCircle size={18} style={{ color:GREEN }} />
                  : <AlertTriangle size={18} style={{ color:RED }} />}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color:TEXT }}>{current.file_name}</p>
                <p className="text-xs" style={{ color:MUTED }}>{formatBytes(current.file_size)}</p>
              </div>
            </div>
            <button onClick={() => setCurrent(null)} style={{ color:MUTED }}><X size={16} /></button>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <StatusPill status={current.scan_status} quarantined={current.quarantined} />
              <RiskBadge level={current.risk_level} />
              <span className="text-xs" style={{ color:MUTED }}>Motor: {current.scan_engine}</span>
            </div>
            {current.threats.length > 0
              ? <div className="space-y-1.5">{current.threats.map((t,i) => (
                  <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded-xl"
                    style={{ background:'rgba(239,68,68,0.1)', color:'#FCA5A5' }}>
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />{t}
                  </div>))}</div>
              : <p className="text-xs font-medium" style={{ color:GREEN }}>Nenhuma ameaça detectada. Arquivo seguro.</p>}
            <PiiBanner findings={current.pii_findings} />
            {current.scan_status==='clean' && !current.pii_detected && current.timestamp_token && (
              <DocasSeal token={current.timestamp_token} />
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => downloadPDF(current.id, current.file_name)}
                disabled={dlPdfId===current.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background:'rgba(59,130,246,0.1)', color:BLUE, border:'1px solid rgba(59,130,246,0.25)' }}>
                {dlPdfId===current.id ? <Loader size={11} className="animate-spin" /> : <Download size={11} />}
                Baixar Relatório PDF
              </button>
            </div>
            {current.file_hash && (
              <p className="mt-2 text-xs font-mono break-all" style={{ color:MUTED }}>SHA256: {current.file_hash}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Detections table (IndustryOS + PD style) ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background:CARD, border:BORDER }}>

        {/* Table header */}
        <div className="px-5 py-4" style={{ borderBottom:BORDER }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color:TEXT }}>
                {tab==='history' ? 'Detecções' : 'Quarentena'}
                <span className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background:'rgba(255,255,255,0.06)', color:MUTED }}>
                  {activeList.length} arquivo{activeList.length!==1?'s':''}
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color:MUTED }}>
                Monitoramento em tempo real · LGPD · DOCAS RFC-3161
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Underline tabs */}
              <div className="flex items-center">
                {([
                  { id:'history',    label:'Histórico',                      Icon:FileText },
                  { id:'quarantine', label:`Quarentena (${stats.quarantined})`, Icon:Archive  },
                ] as { id:Tab; label:string; Icon:React.ElementType }[]).map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setTab(id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
                    style={tab===id
                      ? { color:ACCENT, borderBottom:`2px solid ${ACCENT}` }
                      : { color:MUTED, borderBottom:'2px solid transparent' }}>
                    <Icon size={12} />{label}
                  </button>
                ))}
              </div>

              {/* Search (PD style) */}
              {tab==='history' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background:'rgba(255,255,255,0.04)', border:BORDER }}>
                  <Search size={12} style={{ color:MUTED }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar arquivo…"
                    className="bg-transparent outline-none text-xs w-36"
                    style={{ color:TEXT }} />
                  {search && <button onClick={() => setSearch('')} style={{ color:MUTED }}><X size={11} /></button>}
                </div>
              )}
            </div>
          </div>

          {/* Filter chips */}
          {tab==='history' && (
            <div className="flex flex-wrap gap-2 items-center mt-3 pt-3" style={{ borderTop:BORDER }}>
              <Filter size={11} style={{ color:MUTED }} />
              <span className="text-xs" style={{ color:MUTED }}>Risco:</span>
              {[{v:'all',l:'Todos'},{v:'low',l:'Baixo'},{v:'medium',l:'Médio'},{v:'high',l:'Alto'},{v:'critical',l:'Crítico'}]
                .map(({v,l}) => <Chip key={v} active={filterRisk===v} onClick={() => setFilterRisk(v)}>{l}</Chip>)}
              <div className="w-px h-4" style={{ background:'rgba(255,255,255,0.08)' }} />
              <span className="text-xs" style={{ color:MUTED }}>Status:</span>
              {[{v:'all',l:'Todos'},{v:'clean',l:'Limpo'},{v:'threat_found',l:'Ameaça'}]
                .map(({v,l}) => <Chip key={v} active={filterStatus===v} onClick={() => setFilterStatus(v)}>{l}</Chip>)}
              <div className="w-px h-4" style={{ background:'rgba(255,255,255,0.08)' }} />
              <Clock size={11} style={{ color:MUTED }} />
              {[{v:'all',l:'Sempre'},{v:'today',l:'Hoje'},{v:'week',l:'7d'},{v:'month',l:'30d'}]
                .map(({v,l}) => <Chip key={v} active={filterDate===v} onClick={() => setFilterDate(v)}>{l}</Chip>)}
            </div>
          )}
        </div>

        {/* Table body */}
        {activeList.length === 0 ? (
          <div className="text-center py-14">
            {tab==='quarantine'
              ? <Lock size={32} className="mx-auto mb-3" style={{ color:MUTED }} />
              : <FileSearch size={32} className="mx-auto mb-3" style={{ color:MUTED }} />}
            <p className="text-sm font-medium" style={{ color:SUB }}>
              {tab==='quarantine' ? 'Nenhum arquivo em quarentena' : 'Nenhuma detecção encontrada'}
            </p>
            <p className="text-xs mt-1" style={{ color:MUTED }}>
              {tab==='quarantine' ? 'Arquivos com ameaças aparecem aqui' : 'Arraste um arquivo acima para começar'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px]">
              <thead>
                <tr style={{ borderBottom:BORDER }}>
                  {[
                    ['Detalhes do Arquivo', ''],
                    ['Detecções', ''],
                    ['Analisado', 'w-28'],
                    ['Risco', 'w-24'],
                    ['Status', 'w-28'],
                    ['Ações', 'w-24'],
                  ].map(([h, w]) => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold ${w}`}
                      style={{ color:MUTED }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeList.map((r, i) => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId===r.id ? null : r.id)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{
                        borderBottom: i < activeList.length-1 || expandedId===r.id ? BORDER : 'none',
                        boxShadow: `inset 3px 0 0 ${riskColor(r.risk_level)}`,
                      }}>

                      {/* File details (IndustryOS: name + subtitle) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background:riskColor(r.risk_level)+'15', border:`1px solid ${riskColor(r.risk_level)}25` }}>
                            <FileText size={13} style={{ color:riskColor(r.risk_level) }} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold truncate max-w-[160px]" style={{ color:TEXT }}>
                              {r.file_name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color:MUTED }}>
                              {formatBytes(r.file_size)} · {r.mime_type || 'unknown'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Detections (PD style) */}
                      <td className="px-4 py-3">
                        {r.threats.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {r.threats.slice(0,2).map((t,j) => (
                              <span key={j} className="text-xs truncate max-w-[200px]"
                                style={{ color:RED+'CC' }}>• {t}</span>
                            ))}
                            {r.threats.length > 2 && (
                              <span className="text-xs" style={{ color:MUTED }}>+{r.threats.length-2} mais</span>
                            )}
                          </div>
                        ) : r.pii_detected ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color:ORANGE }}>
                            <AlertCircle size={11} />PII · {r.pii_findings.slice(0,2).join(', ')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs" style={{ color:GREEN }}>
                            <CheckCircle size={11} />Nenhuma detecção
                          </span>
                        )}
                      </td>

                      {/* Timestamp (IndustryOS: relative + date) */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium" style={{ color:SUB }}>{timeAgo(r.scanned_at)}</p>
                        <p className="text-xs mt-0.5" style={{ color:MUTED }}>
                          {new Date(r.scanned_at).toLocaleDateString('pt-BR')}
                        </p>
                      </td>

                      <td className="px-4 py-3"><RiskBadge level={r.risk_level} /></td>
                      <td className="px-4 py-3"><StatusPill status={r.scan_status} quarantined={r.quarantined} /></td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {expandedId===r.id
                            ? <ChevronUp size={13} style={{ color:MUTED }} />
                            : <ChevronDown size={13} style={{ color:MUTED }} />}
                          {confirmId===r.id ? (
                            <span className="flex items-center gap-1">
                              <button onClick={e => { e.stopPropagation(); remove(r.id) }}
                                disabled={deleting}
                                className="text-xs font-semibold px-2 py-0.5 rounded"
                                style={{ background:'rgba(239,68,68,0.15)', color:RED }}>
                                {deleting ? <Loader size={10} className="animate-spin" /> : 'Sim'}
                              </button>
                              <button onClick={e => { e.stopPropagation(); setConfirmId(null) }}
                                className="text-xs px-2 py-0.5 rounded"
                                style={{ background:'rgba(255,255,255,0.05)', color:MUTED }}>Não</button>
                            </span>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setConfirmId(r.id) }}
                              className="transition-colors hover:text-red-400"
                              style={{ color:MUTED }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId===r.id && (
                      <tr style={{ borderBottom: i < activeList.length-1 ? BORDER : 'none' }}>
                        <td colSpan={6} className="px-5 py-4" style={{ background:BG }}>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color:SUB }}>Informações</p>
                              <div className="space-y-1 text-xs">
                                <p style={{ color:MUTED }}><span style={{ color:SUB }}>SHA256: </span>
                                  <span className="font-mono">{r.file_hash ? r.file_hash.slice(0,32)+'…' : 'n/a'}</span></p>
                                <p style={{ color:MUTED }}><span style={{ color:SUB }}>MIME: </span>{r.mime_type||'n/a'}</p>
                                <p style={{ color:MUTED }}><span style={{ color:SUB }}>Motor: </span>{r.scan_engine}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color:SUB }}>Detecções</p>
                              {r.threats.length > 0
                                ? <div className="space-y-1.5">{r.threats.map((t,j) => (
                                    <div key={j} className="flex items-start gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                                      style={{ background:'rgba(239,68,68,0.08)', color:'#FCA5A5' }}>
                                      <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />{t}
                                    </div>))}</div>
                                : <p className="text-xs" style={{ color:GREEN }}>Nenhuma ameaça detectada</p>}
                              <PiiBanner findings={r.pii_findings} />
                            </div>

                            <div>
                              <p className="text-xs font-semibold mb-2" style={{ color:SUB }}>Evidência & Ações</p>
                              {r.scan_status==='clean' && !r.pii_detected && r.timestamp_token && (
                                <DocasSeal token={r.timestamp_token} />
                              )}
                              <div className="flex flex-wrap gap-2 mt-3">
                                <button
                                  onClick={e => { e.stopPropagation(); downloadPDF(r.id, r.file_name) }}
                                  disabled={dlPdfId===r.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                  style={{ background:'rgba(59,130,246,0.1)', color:BLUE, border:'1px solid rgba(59,130,246,0.2)' }}>
                                  {dlPdfId===r.id ? <Loader size={11} className="animate-spin" /> : <Download size={11} />}
                                  Relatório PDF
                                </button>
                                {tab==='quarantine' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); releaseQuarantine(r.id) }}
                                    disabled={releasingId===r.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                    style={{ background:'rgba(16,185,129,0.1)', color:GREEN, border:'1px solid rgba(16,185,129,0.25)' }}>
                                    {releasingId===r.id ? <Loader size={11} className="animate-spin" /> : <ShieldOff size={11} />}
                                    Liberar
                                  </button>
                                )}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer (IndustryOS style) */}
        {activeList.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop:BORDER }}>
            <span className="text-xs" style={{ color:MUTED }}>
              Exibindo {activeList.length} de {tab==='history' ? results.length : quarantine.length} arquivo{activeList.length!==1?'s':''}
            </span>
            <span className="text-xs flex items-center gap-1.5" style={{ color:MUTED }}>
              <ShieldCheck size={11} style={{ color:ACCENT }} />
              Timestamp RFC-3161 em cada análise
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
