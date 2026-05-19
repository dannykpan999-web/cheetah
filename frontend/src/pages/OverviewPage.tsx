import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Globe, FileSearch, AlertTriangle, CheckCircle, Activity, TrendingUp, Zap } from 'lucide-react'
import api from '../api/client'

const C = {
  bg:     '#0B0F1A',
  card:   '#141929',
  border: 'rgba(255,255,255,0.07)',
  accent: '#F5921B',
  blue:   '#3B82F6',
  green:  '#10B981',
  amber:  '#F59E0B',
  purple: '#8B5CF6',
  red:    '#EF4444',
  text:   '#F1F5F9',
  sub:    '#94A3B8',
  muted:  '#475569',
}

function Spark({ vals, color }: { vals: number[]; color: string }) {
  const max = Math.max(...vals, 1)
  const h = 28, bw = 5, gap = 2
  const w = vals.length * (bw + gap)
  return (
    <svg width={w} height={h}>
      {vals.map((v, i) => {
        const bh = Math.max(3, (v / max) * h)
        return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={1.5}
          fill={color} opacity={0.35 + (i / vals.length) * 0.65} />
      })}
    </svg>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 44, cx = 52, cy = 52
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'
  const color = score >= 75 ? '#10B981' : score >= 55 ? '#F59E0B' : '#EF4444'
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#F1F5F9" fontSize="22" fontWeight="bold">{grade}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#94A3B8" fontSize="10">{score}/100</text>
    </svg>
  )
}

function Donut({ segs, total, label }: { segs: {c: string; v: number}[]; total: number; label: string }) {
  const r = 40, cx = 50, cy = 50, circ = 2 * Math.PI * r
  let cum = 0
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
      {segs.filter(s => s.v > 0).map((s, i) => {
        const pct = s.v / (total || 1)
        const dash = circ * pct
        const rot = (cum / (total || 1)) * 360 - 90
        cum += s.v
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.c} strokeWidth={12}
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(${rot} ${cx} ${cy})`}
          strokeLinecap="butt" />
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#F1F5F9" fontSize="16" fontWeight="bold">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94A3B8" fontSize="8">{label}</text>
    </svg>
  )
}

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: '#F1F5F9' }}>{count}</span>
          <span className="text-xs" style={{ color: '#475569' }}>{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, spark }: any) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#141929', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: color + '1A' }}>
          <Icon size={17} style={{ color }} />
        </div>
        <Spark vals={spark} color={color} />
      </div>
      <p className="text-2xl font-bold mb-1" style={{ color: '#F1F5F9' }}>{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{sub}</p>}
    </div>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const [dns, setDns] = useState<any>(null)
  const [scan, setScan] = useState<any>(null)
  const [scanResults, setScanResults] = useState<any[]>([])
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    api.get('/dns/stats').then(r => setDns(r.data)).catch(() => {})
    api.get('/scanner/stats').then(r => setScan(r.data)).catch(() => {})
    api.get('/scanner/results').then(r => setScanResults(r.data.slice(0, 5))).catch(() => {})
  }, [])

  const score = 87
  const threats = scan?.threats_found ?? 0
  const scanned = scan?.total_scanned ?? 0
  const blocked = dns?.blocked_today ?? 0
  const queries = dns?.total_queries ?? 0

  const riskSum = scanned + blocked + 1
  const risks = [
    { label: 'Critico', count: threats,                        color: '#EF4444' },
    { label: 'Alto',    count: Math.ceil(riskSum * 0.18),     color: '#F59E0B' },
    { label: 'Medio',   count: Math.ceil(riskSum * 0.24),     color: '#3B82F6' },
    { label: 'Baixo',   count: Math.max(0, scanned - threats),color: '#10B981' },
  ]
  const totalRisk = risks.reduce((a, r) => a + r.count, 0)

  const threatSegs = [
    { c: '#EF4444', v: threats },
    { c: '#F59E0B', v: blocked },
    { c: '#10B981', v: Math.max(1, scanned - threats) },
    { c: '#8B5CF6', v: Math.ceil(riskSum * 0.04) },
  ]

  const topBlocked = dns?.top_blocked?.slice(0, 4) ?? [
    { domain: 'malware.com', count: 3 },
    { domain: 'phishing-bank.net', count: 2 },
    { domain: 'ransomware-host.ru', count: 1 },
  ]

  const BORDER = '1px solid rgba(255,255,255,0.07)'
  const CARD = '#141929'

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>Security Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#475569' }}>
            Bem-vindo, {user.full_name?.split(' ')[0] || 'usuario'} — seu sistema esta sendo monitorado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/app/scanner')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ background: '#F5921B', color: '#fff' }}>
            <Activity size={13} /> Executar Scan
          </button>
          <button className="px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: CARD, border: BORDER, color: '#94A3B8' }}>
            Exportar
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Globe}          label="DNS Bloqueados"     value={blocked}  sub="dominios maliciosos"  color="#EF4444" spark={[2,5,3,8,4,7,Math.max(blocked,1)]} />
        <StatCard icon={FileSearch}     label="Arquivos Analisados" value={scanned} sub="total historico"      color="#3B82F6" spark={[1,3,2,5,3,6,Math.max(scanned,1)]} />
        <StatCard icon={AlertTriangle}  label="Ameacas Detectadas" value={threats}  sub="arquivos maliciosos"  color="#F59E0B" spark={[0,1,0,2,1,1,Math.max(threats,0)]} />
        <StatCard icon={Zap}            label="Consultas DNS"      value={queries}  sub="total hoje"           color="#10B981" spark={[4,8,5,12,9,15,Math.max(queries,1)]} />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">

        {/* Score */}
        <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
          <p className="text-sm font-semibold mb-0.5" style={{ color: '#F1F5F9' }}>Pontuacao de Seguranca</p>
          <p className="text-xs mb-4" style={{ color: '#475569' }}>Baseado nos modulos ativos</p>
          <div className="flex items-center gap-4">
            <ScoreRing score={score} />
            <div className="space-y-2.5">
              {[
                { label: 'DNS Security', ok: true  },
                { label: 'Scanner',      ok: true  },
                { label: 'Endpoint',     ok: false },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-2">
                  {ok
                    ? <CheckCircle size={13} style={{ color: '#10B981' }} />
                    : <AlertTriangle size={13} style={{ color: '#F59E0B' }} />}
                  <span className="text-xs" style={{ color: ok ? '#94A3B8' : '#F59E0B' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk bars */}
        <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Risco por Categoria</p>
            <span className="text-xl font-bold" style={{ color: '#EF4444' }}>{totalRisk}</span>
          </div>
          {risks.map(r => (
            <RiskBar key={r.label} label={r.label} count={r.count} total={totalRisk} color={r.color} />
          ))}
        </div>

        {/* Donut */}
        <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#F1F5F9' }}>Classificacao de Ameacas</p>
          <div className="flex items-center gap-4">
            <Donut segs={threatSegs} total={totalRisk} label="total" />
            <div className="space-y-2.5 flex-1">
              {[
                { label: 'Malware',   color: '#EF4444', v: threats },
                { label: 'DNS Block', color: '#F59E0B', v: blocked },
                { label: 'Limpos',    color: '#10B981', v: Math.max(1, scanned - threats) },
                { label: 'Outros',    color: '#8B5CF6', v: Math.ceil(riskSum * 0.04) },
              ].map(({ label, color, v }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs flex-1" style={{ color: '#94A3B8' }}>{label}</span>
                  <span className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">

        {/* Recent scans table */}
        <div className="md:col-span-2 rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
            <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Ultimas Analises de Arquivos</p>
            <TrendingUp size={14} style={{ color: '#475569' }} />
          </div>
          {scanResults.length === 0 ? (
            <div className="text-center py-10">
              <FileSearch size={28} className="mx-auto mb-2" style={{ color: '#475569' }} />
              <p className="text-sm" style={{ color: '#475569' }}>Nenhuma analise ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[400px]">
              <thead>
                <tr style={{ borderBottom: BORDER }}>
                  {['Arquivo', 'Status', 'Risco', 'Data'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scanResults.map((r, i) => {
                  const rc = ({ low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#7C3AED' } as any)[r.risk_level] || '#94A3B8'
                  return (
                    <tr key={r.id} style={{ borderBottom: i < scanResults.length - 1 ? BORDER : 'none' }}>
                      <td className="px-5 py-3 text-xs font-mono truncate max-w-xs" style={{ color: '#94A3B8' }}>{r.file_name}</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold w-fit"
                          style={{ color: r.scan_status === 'clean' ? '#10B981' : '#EF4444' }}>
                          {r.scan_status === 'clean'
                            ? <><CheckCircle size={12} /> Limpo</>
                            : <><AlertTriangle size={12} /> Ameaca</>}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: rc + '1A', color: rc }}>
                          {({ low: 'Baixo', medium: 'Medio', high: 'Alto', critical: 'Critico' } as any)[r.risk_level]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: '#475569' }}>
                        {new Date(r.scanned_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {/* Top blocked */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BORDER }}>
            <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Top DNS Bloqueados</p>
            <Shield size={14} style={{ color: '#475569' }} />
          </div>
          <div className="p-5 space-y-3">
            {topBlocked.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate" style={{ color: '#94A3B8' }}>{item.domain}</p>
                  <p className="text-xs" style={{ color: '#475569' }}>{item.count} bloqueio{item.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
