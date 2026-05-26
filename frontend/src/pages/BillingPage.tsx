import { useEffect, useState } from 'react'
import {
  CreditCard, CheckCircle, XCircle, Download, Loader,
  RefreshCw, Zap, ArrowUpRight, Shield, FileText,
  TrendingUp, Clock, Star,
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
const BLUE   = '#3B82F6'
const PURPLE = '#7C3AED'
const YELLOW = '#F59E0B'

interface PlanDef {
  key: string; label: string; price: string; period: string
  color: string; features: string[]; limits: Record<string,number>; current: boolean
}
interface Overview {
  plan: string; plan_label: string; price: string; period: string
  plan_color: string; active_since: string; features: string[]
  limits: Record<string,number>; usage: Record<string,number>
  all_plans: PlanDef[]
  invoices: Invoice[]
}
interface Invoice {
  id: string; date: string; date_label: string
  description: string; amount: string; status: 'paid' | 'failed'
}

// ── Usage meter (from Template #1) ───────────────────────────────────────────
function UsageMeter({
  label, used, limit, color,
}: { label: string; used: number; limit: number; color: string }) {
  const unlimited = limit === -1
  const pct = unlimited ? 20 : Math.min(100, Math.round((used / limit) * 100))
  const barColor = pct > 85 ? RED : pct > 60 ? YELLOW : color

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: SUB }}>{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>
          {used} / {unlimited ? '∞' : limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${unlimited ? 20 : pct}%`, background: barColor,
            boxShadow: `0 0 6px ${barColor}66` }} />
      </div>
      {!unlimited && (
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          {pct}% utilizado{pct > 85 ? ' — próximo do limite' : ''}
        </p>
      )}
    </div>
  )
}

// ── Plan card (from Template #3 row layout) ───────────────────────────────────
function PlanCard({ plan, onUpgrade }: { plan: PlanDef; onUpgrade: (key: string) => void }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col transition-all duration-200"
      style={{
        background: plan.current ? `linear-gradient(135deg, ${plan.color}18, ${plan.color}08)` : CARD,
        border: plan.current ? `1px solid ${plan.color}44` : BORDER,
        boxShadow: plan.current ? `0 0 24px ${plan.color}18` : 'none',
      }}>

      {/* Plan name + badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: plan.color }}>
          {plan.label}
        </span>
        {plan.current && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: plan.color+'22', color: plan.color, border: `1px solid ${plan.color}33` }}>
            <Star size={9} /> Atual
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black" style={{ color: plan.current ? plan.color : TEXT }}>
            {plan.price}
          </span>
          <span className="text-xs" style={{ color: MUTED }}>/{plan.period}</span>
        </div>
      </div>

      {/* Features list */}
      <ul className="space-y-2 flex-1 mb-5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-xs" style={{ color: SUB }}>
            <CheckCircle size={11} style={{ color: plan.color, flexShrink: 0 }} />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA button */}
      {plan.current ? (
        <div className="py-2.5 rounded-xl text-center text-xs font-semibold"
          style={{ background: plan.color+'15', color: plan.color, border: `1px solid ${plan.color}30` }}>
          Plano Atual
        </div>
      ) : (
        <button onClick={() => onUpgrade(plan.key)}
          className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
          style={{ background: plan.color, color: '#fff' }}>
          <ArrowUpRight size={13} /> Fazer Upgrade
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [data, setData]           = useState<Overview | null>(null)
  const [loading, setLoading]     = useState(true)
  const [dlId, setDlId]           = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const r = await api.get<Overview>('/billing/overview')
      setData(r.data)
    } catch {
      toast('error', 'Erro ao Carregar', 'Não foi possível carregar as informações de cobrança.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function downloadInvoice(inv: Invoice) {
    setDlId(inv.id)
    try {
      const lines = [
        'FATURA — CHEETAH SECURITY PLATFORM',
        '══════════════════════════════════',
        `Nº da Fatura:  ${inv.id}`,
        `Data:          ${inv.date_label}`,
        `Descrição:     ${inv.description}`,
        `Valor:         ${inv.amount}`,
        `Status:        ${inv.status === 'paid' ? 'PAGO' : 'FALHOU'}`,
        '',
        'Cheetah Security Platform — cheetah.technology',
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${inv.id}.txt`; a.click()
      URL.revokeObjectURL(url)
      toast('success', 'Fatura Baixada', `${inv.id} salvo com sucesso.`)
    } catch {
      toast('error', 'Erro', 'Não foi possível baixar a fatura.')
    } finally { setDlId(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3" style={{ color: MUTED }}>
      <Loader size={18} className="animate-spin" />
      <span className="text-sm">Carregando informações de cobrança...</span>
    </div>
  )
  if (!data) return null

  const usageItems = [
    { label: 'Scans de Documentos', key: 'scans',     color: BLUE   },
    { label: 'Endpoints',           key: 'endpoints',  color: ACCENT },
    { label: 'Regras DNS',          key: 'dns_rules',  color: PURPLE },
  ]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: MUTED }}>
            <CreditCard size={10} /><span>Conta</span>
            <span>›</span><span style={{ color: SUB }}>Cobrança</span>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <CreditCard size={20} style={{ color: ACCENT }} />Cobrança & Planos
          </h1>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Gerencie seu plano, uso e histórico de faturas
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: CARD, color: SUB, border: BORDER }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── Row 1: Current Plan (left) + Usage Summary (right) ── Template #2 layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Current Plan card */}
        <div className="rounded-2xl p-5"
          style={{ background: CARD, border: `1px solid ${data.plan_color}33` }}>
          <p className="text-xs font-semibold tracking-wider mb-4" style={{ color: MUTED }}>
            PLANO ATUAL
          </p>
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold mb-2"
                style={{ background: data.plan_color+'22', color: data.plan_color, border: `1px solid ${data.plan_color}33` }}>
                <Shield size={11} /> {data.plan_label}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black" style={{ color: data.plan_color }}>{data.price}</span>
                <span className="text-xs" style={{ color: MUTED }}>/{data.period}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: MUTED }}>Ativo desde</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: SUB }}>{data.active_since}</p>
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-1.5 mb-4">
            {data.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs" style={{ color: SUB }}>
                <CheckCircle size={11} style={{ color: data.plan_color }} />{f}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-4" style={{ borderTop: BORDER }}>
            <Zap size={11} style={{ color: MUTED }} />
            <span className="text-xs" style={{ color: MUTED }}>
              Próxima cobrança — integração Stripe em breve
            </span>
          </div>
        </div>

        {/* Usage Summary card — Template #1 meters */}
        <div className="rounded-2xl p-5" style={{ background: CARD, border: BORDER }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold tracking-wider" style={{ color: MUTED }}>
              USO DO PLANO
            </p>
            <TrendingUp size={13} style={{ color: MUTED }} />
          </div>

          <div className="space-y-5">
            {usageItems.map(({ label, key, color }) => (
              <UsageMeter
                key={key}
                label={label}
                used={data.usage[key]}
                limit={data.limits[key]}
                color={color}
              />
            ))}
          </div>

          <div className="mt-5 pt-4 grid grid-cols-3 gap-2" style={{ borderTop: BORDER }}>
            {usageItems.map(({ label, key, color }) => {
              const lim = data.limits[key]
              const used = data.usage[key]
              const pct = lim === -1 ? '∞' : `${Math.round((used/lim)*100)}%`
              return (
                <div key={key} className="text-center px-2 py-2 rounded-xl"
                  style={{ background: color+'0D', border: `1px solid ${color}18` }}>
                  <p className="text-base font-black tabular-nums" style={{ color }}>{pct}</p>
                  <p className="text-xs mt-0.5 leading-tight" style={{ color: MUTED }}>{label.split(' ')[0]}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Row 2: Plan comparison cards — Template #3 side-by-side ── */}
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: TEXT }}>
          <Star size={14} style={{ color: ACCENT }} />Planos Disponíveis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.all_plans.map(plan => (
            <PlanCard key={plan.key} plan={plan} onUpgrade={k => setUpgradeModal(k)} />
          ))}
        </div>
      </div>

      {/* ── Row 3: Billing History — Template #4 table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3"
          style={{ borderBottom: BORDER }}>
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: TEXT }}>
              <FileText size={14} style={{ color: ACCENT }} />
              Histórico de Faturas
              <span className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(255,255,255,0.06)', color: MUTED }}>
                {data.invoices.length}
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              Todas as cobranças mensais do plano
            </p>
          </div>
        </div>

        <table className="w-full min-w-[520px]">
          <thead>
            <tr style={{ borderBottom: BORDER }}>
              {['Fatura', 'Descrição', 'Data', 'Valor', 'Status', 'Ação'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: MUTED }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((inv, i) => (
              <tr key={inv.id}
                className="transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: i < data.invoices.length - 1 ? BORDER : 'none' }}>

                {/* Invoice ID */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)', border: BORDER }}>
                      <FileText size={12} style={{ color: MUTED }} />
                    </div>
                    <span className="text-xs font-mono font-semibold" style={{ color: TEXT }}>{inv.id}</span>
                  </div>
                </td>

                {/* Description */}
                <td className="px-5 py-3.5">
                  <span className="text-xs" style={{ color: SUB }}>{inv.description}</span>
                </td>

                {/* Date */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                    <Clock size={10} /> {inv.date_label}
                  </div>
                </td>

                {/* Amount */}
                <td className="px-5 py-3.5">
                  <span className="text-xs font-bold" style={{ color: TEXT }}>{inv.amount}</span>
                </td>

                {/* Status badge — Template #2 paid/failed style */}
                <td className="px-5 py-3.5">
                  {inv.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: GREEN+'18', color: GREEN, border: `1px solid ${GREEN}30` }}>
                      <CheckCircle size={10} /> Pago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: RED+'18', color: RED, border: `1px solid ${RED}30` }}>
                      <XCircle size={10} /> Falhou
                    </span>
                  )}
                </td>

                {/* Download — Template #4 action per row */}
                <td className="px-5 py-3.5">
                  {inv.status === 'paid' ? (
                    <button onClick={() => downloadInvoice(inv)}
                      disabled={dlId === inv.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: 'rgba(59,130,246,0.1)', color: BLUE, border: '1px solid rgba(59,130,246,0.2)' }}>
                      {dlId === inv.id
                        ? <Loader size={10} className="animate-spin" />
                        : <Download size={10} />}
                      Baixar
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: MUTED }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: BORDER }}>
          <span className="text-xs" style={{ color: MUTED }}>
            {data.invoices.filter(i => i.status === 'paid').length} paga{data.invoices.filter(i => i.status === 'paid').length !== 1 ? 's' : ''} ·{' '}
            {data.invoices.filter(i => i.status === 'failed').length} com falha
          </span>
          <span className="text-xs flex items-center gap-1.5" style={{ color: MUTED }}>
            <Shield size={11} style={{ color: ACCENT }} />
            Stripe Billing — integração em breve
          </span>
        </div>
      </div>

      {/* ── Upgrade modal ── */}
      {upgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setUpgradeModal(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: '#1A2035', border: BORDER }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: ACCENT+'18', border: `1px solid ${ACCENT}30` }}>
                <Zap size={18} style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: TEXT }}>Fazer Upgrade</p>
                <p className="text-xs" style={{ color: MUTED }}>Plano {data.all_plans.find(p => p.key === upgradeModal)?.label}</p>
              </div>
            </div>
            <p className="text-xs mb-4" style={{ color: SUB }}>
              A integração com Stripe está sendo configurada. Para fazer upgrade agora, entre em contato diretamente:
            </p>
            <div className="px-3 py-2.5 rounded-xl text-xs font-mono mb-4"
              style={{ background: BG, color: ACCENT, border: BORDER }}>
              contato@cheetah.technology
            </div>
            <button onClick={() => setUpgradeModal(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: ACCENT, color: '#fff' }}>
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
