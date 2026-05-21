import { createContext, useContext, useState, useCallback, useRef } from 'react'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message: string
  duration: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast: (type: ToastType, title: string, message: string, duration?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(p => p.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, title: string, message: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(p => [...p.slice(-4), { id, type, title, message, duration }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
