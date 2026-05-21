import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { useToast, ToastItem, ToastType } from '../context/ToastContext'

const CFG: Record<ToastType, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  success: {
    icon: CheckCircle,
    color: '#10B981',
    bg:   'rgba(16,185,129,0.10)',
    border:'rgba(16,185,129,0.25)',
    label: 'SUCCESS',
  },
  warning: {
    icon: AlertTriangle,
    color: '#F59E0B',
    bg:   'rgba(245,158,11,0.10)',
    border:'rgba(245,158,11,0.25)',
    label: 'WARNING',
  },
  error: {
    icon: XCircle,
    color: '#EF4444',
    bg:   'rgba(239,68,68,0.10)',
    border:'rgba(239,68,68,0.25)',
    label: 'ERROR',
  },
  info: {
    icon: Info,
    color: '#14B8A6',
    bg:   'rgba(20,184,166,0.10)',
    border:'rgba(20,184,166,0.25)',
    label: 'INFO',
  },
}

function ToastCard({ item }: { item: ToastItem }) {
  const { dismiss } = useToast()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const cfg = CFG[item.type]
  const Icon = cfg.icon

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const step = 50
    const decrement = (step / item.duration) * 100
    const interval = setInterval(() => {
      setProgress(p => {
        const next = p - decrement
        if (next <= 0) { clearInterval(interval); return 0 }
        return next
      })
    }, step)
    return () => clearInterval(interval)
  }, [item.duration])

  return (
    <div
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease',
        background: '#141929',
        border: `1px solid ${cfg.border}`,
        borderRadius: 14,
        minWidth: 320,
        maxWidth: 380,
        overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)`,
        position: 'relative',
      }}
    >
      {/* Colored left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: cfg.color,
        borderRadius: '14px 0 0 14px',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 14px 18px' }}>
        {/* Icon circle */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={cfg.color} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: cfg.color, textTransform: 'uppercase',
          }}>
            {cfg.label}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
            {item.title}
          </p>
          {item.message && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
              {item.message}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => dismiss(item.id)}
          style={{
            flexShrink: 0, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#475569',
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%', background: cfg.color,
          width: `${progress}%`,
          transition: 'width 0.05s linear',
          borderRadius: '0 0 0 14px',
        }} />
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20,
      zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard item={t} />
        </div>
      ))}
    </div>
  )
}
