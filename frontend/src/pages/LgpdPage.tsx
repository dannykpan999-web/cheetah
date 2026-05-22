import { useEffect, useState } from 'react'
import {
  ShieldCheck, CheckCircle, XCircle, AlertTriangle, FileText,
  Globe, Monitor, CalendarClock, ClipboardList, AlertCircle,
  TrendingUp, Clock, Download, Loader, RefreshCw,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const BORDER = '1px solid rgba(255,255,255,0.07)'
const CARD   = '#141929'
const BG     = '#0B0F1A'
const TEXT   = '#F1F5F9'
const SUB    = '#94A3B8'
const MUTED  = '#475569'
const ACCENT = '#F5921B'
const GREEN  = '#10B981'
const RED    = '#EF4444'
const YELLOW = '#F59E0B'
const BLUE   = '#3B82F6'
const ORANGE = '#F97316'
const PURPLE = '#7C3AED'

interface Check {
  id: string; title: string; description: string; article: string
  passed: boolean; partial: boolean; weight: number; earned: number; detail: string
}
interface PiiFile {
  file_name: string; pii_types: string[]; scanned_at: string; risk_level: string
}
interface Recommendation {
  priority: string; action: string; detail: string
}
interface Summary {
  total_scans: number; threats_blocked: number; pii_files_found: number
  dns_rules: number; active_endpoints: number; critical_alerts: number
}
interface Scorecard {
  score: number; grade: string; grade_color: string
  checks: Check[]; pii_files: PiiFile[]
  summary: Summary; recommendations: Recommendation[]
}

function GradeRing({ score, color, grade }: { score: number; color: string; grade: string }) {
  const r = 52, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
      <svg width="132" height="132" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 8px ${color}88)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>/ 100</span>
        <span style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2 }}>{grade}</span>
      </div>
    </div>
  )
}

function CheckIcon({ passed, partial }: { passed: boolean; partial: boolean }) {
  if (passed)  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: GREEN+'18', border: `1px solid ${GREEN}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}><CheckCircle size={14} color={GREEN} /></div>
  if (partial) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: YELLOW+'18', border: `1px solid ${YELLOW}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}><AlertTriangle size={14} color={YELLOW} /></div>
  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: RED+'18', border: `1px solid ${RED}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}><XCircle size={14} color={RED} /></div>
}

function priorityColor(p: string) {
  return p === 'alta' ? RED : p === 'média' ? YELLOW : GREEN
}

const CHECK_ICONS: Record<string, React.ElementType> = {
  scan_performed:     FileText,
  no_active_threats:  ShieldCheck,
  dns_protection:     Globe,
  endpoint_monitoring:Monitor,
  pii_cataloged:      ClipboardList,
  scan_scheduled:     CalendarClock,
  no_critical_alerts: AlertCircle,
  audit_trail:        ClipboardList,
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function LgpdPage() {
  const [data, setData]       = useState<Scorecard | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const r = await api.get<Scorecard>('/lgpd/scorecard')
      setData(r.data)
    } catch {
      toast('error', 'Erro ao Carregar', 'Não foi possível carregar o scorecard LGPD.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function exportPDF() {
    if (!data) return
    setExporting(true)
    try {
      const lines = [
        'RELATÓRIO DE CONFORMIDADE LGPD',
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        '',
        `Score: ${data.score}/100  Nota: ${data.grade}`,
        '',
        'VERIFICAÇÕES:',
        ...data.checks.map(c =>
          `[${c.passed ? 'OK' : c.partial ? 'PARCIAL' : 'FALHOU'}] ${c.title} (${c.article}) — ${c.detail}`
        ),
        '',
        'RECOMENDAÇÕES:',
        ...data.recommendations.map((r, i) => `${i+1}. [${r.priority.toUpperCase()}] ${r.action}: ${r.detail}`),
        '',
        'ARQUIVOS COM DADOS PESSOAIS:',
        ...(data.pii_files.length
          ? data.pii_files.map(f => `- ${f.file_name} (${f.pii_types.join(', ')}) — ${timeAgo(f.scanned_at)}`)
          : ['Nenhum arquivo com dados pessoais detectado.']),
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'cheetah_lgpd_relatorio.txt'; a.click()
      URL.revokeObjectURL(url)
      toast('success', 'Relatório Exportado', 'cheetah_lgpd_relatorio.txt baixado com sucesso.')
    } catch {
      toast('error', 'Falha na Exportação', 'Não foi possível gerar o relatório.')
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3" style={{ color: MUTED }}>
      <Loader size={18} className="animate-spin" />
      <span className="text-sm">Calculando conformidade LGPD...</span>
    </div>
  )
  if (!data) return null

  const passed  = data.checks.filter(c => c.passed).length
  const partial = data.checks.filter(c => !c.passed && c.partial).length
  const failed  = data.checks.filter(c => !c.passed && !c.partial).length

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: MUTED }}>
            <ShieldCheck size={10} /><span>Conformidade</span>
            <span>›</span><span style={{ color: SUB }}>LGPD Scorecard</span>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <ShieldCheck size={20} style={{ color: ACCENT }} />Conformidade LGPD
          </h1>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Lei Geral de Proteção de Dados · Lei nº 13.709/2018
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: CARD, color: SUB, border: BORDER }}>
            <RefreshCw size={12} />Atualizar
          </button>
          <button onClick={exportPDF} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(245,146,27,0.1)', color: ACCENT, border: '1px solid rgba(245,146,27,0.25)' }}>
            {exporting ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
            Exportar Relatório
          </button>
        </div>
      </div>

      {/* ── Score hero ── */}
      <div className="rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6"
        style={{ background: CARD, border: `1px solid ${data.grade_color}22` }}>

        <GradeRing score={data.score} color={data.grade_color} grade={data.grade} />

        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
            <span className="text-lg font-bold" style={{ color: data.grade_color }}>
              {data.score >= 90 ? 'Excelente' : data.score >= 75 ? 'Bom' : data.score >= 60 ? 'Regular' : data.score >= 45 ? 'Insuficiente' : 'Crítico'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: data.grade_color+'18', color: data.grade_color, border: `1px solid ${data.grade_color}33` }}>
              Nota {data.grade}
            </span>
          </div>
          <p className="text-xs mb-4" style={{ color: MUTED }}>
            Avaliação baseada nas 8 verificações de conformidade da Lei nº 13.709/2018 (LGPD).
          </p>
          <div className="flex gap-3 justify-center md:justify-start flex-wrap">
            {[
              { label: 'Aprovado',  value: passed,  color: GREEN  },
              { label: 'Parcial',   value: partial, color: YELLOW },
              { label: 'Pendente',  value: failed,  color: RED    },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: color+'12', border: `1px solid ${color}25` }}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-semibold" style={{ color }}>{value} {label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
          {[
            { label: 'Scans',         value: data.summary.total_scans,      color: BLUE,   Icon: FileText    },
            { label: 'Bloqueados',    value: data.summary.threats_blocked,  color: GREEN,  Icon: ShieldCheck },
            { label: 'Dados PII',     value: data.summary.pii_files_found,  color: ORANGE, Icon: AlertCircle },
            { label: 'Endpoints',     value: data.summary.active_endpoints, color: ACCENT, Icon: Monitor     },
            { label: 'Regras DNS',    value: data.summary.dns_rules,        color: PURPLE, Icon: Globe       },
            { label: 'Alertas Crit.', value: data.summary.critical_alerts,  color: RED,    Icon: AlertTriangle },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: color+'0D', border: `1px solid ${color}20` }}>
              <Icon size={12} style={{ color, flexShrink: 0 }} />
              <div>
                <p className="text-base font-bold leading-none tabular-nums" style={{ color }}>{value}</p>
                <p className="text-xs mt-0.5 whitespace-nowrap" style={{ color: MUTED }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Checks grid + Recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Checklist — takes 2/3 */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT }}>
            <TrendingUp size={14} style={{ color: ACCENT }} />Verificações de Conformidade
          </h2>
          {data.checks.map(c => {
            const Icon = CHECK_ICONS[c.id] ?? ShieldCheck
            const statusColor = c.passed ? GREEN : c.partial ? YELLOW : RED
            return (
              <div key={c.id} className="rounded-xl p-4"
                style={{ background: CARD, border: `1px solid ${statusColor}18`, boxShadow: `inset 3px 0 0 ${statusColor}` }}>
                <div className="flex items-start gap-3">
                  <CheckIcon passed={c.passed} partial={c.partial} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon size={12} style={{ color: statusColor }} />
                      <span className="text-sm font-semibold" style={{ color: TEXT }}>{c.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold"
                        style={{ background: ACCENT+'15', color: ACCENT }}>{c.article}</span>
                      <span className="ml-auto text-xs font-semibold tabular-nums" style={{ color: statusColor }}>
                        {c.earned}/{c.weight}pts
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: MUTED }}>{c.description}</p>
                    <p className="text-xs mt-1.5 font-medium" style={{ color: statusColor }}>{c.detail}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recommendations — takes 1/3 */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT }}>
            <AlertCircle size={14} style={{ color: ACCENT }} />Recomendações
          </h2>
          {data.recommendations.length === 0 ? (
            <div className="rounded-xl p-5 text-center" style={{ background: CARD, border: BORDER }}>
              <CheckCircle size={28} className="mx-auto mb-2" style={{ color: GREEN }} />
              <p className="text-sm font-semibold" style={{ color: GREEN }}>Excelente!</p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>Nenhuma ação pendente.</p>
            </div>
          ) : data.recommendations.map((rec, i) => {
            const pc = priorityColor(rec.priority)
            return (
              <div key={i} className="rounded-xl p-4" style={{ background: CARD, border: BORDER }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase"
                    style={{ background: pc+'18', color: pc, border: `1px solid ${pc}30` }}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-xs font-semibold" style={{ color: TEXT }}>{rec.action}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{rec.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PII Data Map ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: BORDER }}>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT }}>
              <ClipboardList size={14} style={{ color: ACCENT }} />
              Mapeamento de Dados Pessoais (Art. 37)
              <span className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(255,255,255,0.06)', color: MUTED }}>
                {data.pii_files.length} arquivo{data.pii_files.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              Documentos com dados pessoais identificados pelo scanner — CPF, e-mail, telefone, dados de saúde.
            </p>
          </div>
        </div>

        {data.pii_files.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={32} className="mx-auto mb-3 opacity-20" style={{ color: SUB }} />
            <p className="text-sm" style={{ color: MUTED }}>Nenhum arquivo com dados pessoais detectado.</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Faça upload de documentos no Scanner para iniciar o mapeamento.</p>
          </div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: BORDER }}>
                {['Arquivo', 'Tipos de Dados Pessoais', 'Risco', 'Verificado em'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pii_files.map((f, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: i < data.pii_files.length - 1 ? BORDER : 'none',
                    boxShadow: 'inset 3px 0 0 ' + ORANGE }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <FileText size={13} style={{ color: ORANGE, flexShrink: 0 }} />
                      <span className="text-xs font-semibold truncate max-w-[180px]" style={{ color: TEXT }}>{f.file_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {f.pii_types.length > 0
                        ? f.pii_types.map((t, j) => (
                          <span key={j} className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: ORANGE+'18', color: ORANGE }}>{t}</span>
                        ))
                        : <span className="text-xs" style={{ color: MUTED }}>Dados pessoais detectados</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-semibold capitalize" style={{
                      color: f.risk_level === 'critical' ? PURPLE : f.risk_level === 'high' ? RED : f.risk_level === 'medium' ? YELLOW : GREEN
                    }}>{f.risk_level}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                      <Clock size={10} />{timeAgo(f.scanned_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
          <span className="text-xs" style={{ color: MUTED }}>
            Atualizado em {new Date().toLocaleString('pt-BR')}
          </span>
          <span className="text-xs flex items-center gap-1.5" style={{ color: MUTED }}>
            <ShieldCheck size={11} style={{ color: ACCENT }} />
            Conforme Art. 37 — LGPD Lei nº 13.709/2018
          </span>
        </div>
      </div>

    </div>
  )
}
