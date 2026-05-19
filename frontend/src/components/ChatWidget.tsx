import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Shield, Minimize2, RotateCcw } from 'lucide-react'

const C = {
  bg:     '#0B0F1A',
  card:   '#141929',
  card2:  '#1A2035',
  border: 'rgba(255,255,255,0.07)',
  accent: '#F5921B',
  text:   '#F1F5F9',
  muted:  '#475569',
  sub:    '#94A3B8',
}

type Msg = { id: string; role: 'user' | 'assistant'; content: string; ts: Date }

const SUGGESTIONS = [
  'Como bloquear um domínio no DNS?',
  'O que é detecção de PII / LGPD?',
  'Como funciona o scanner de arquivos?',
  'Como ver alertas de endpoint?',
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: C.accent, opacity: 0.7,
          animation: `chatdot .9s ease-in-out ${i * 0.18}s infinite`,
        }}/>
      ))}
    </div>
  )
}

function BotAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#F5921B,#D96820)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(245,146,27,.4)',
    }}>
      <Shield size={14} style={{ color: '#fff' }}/>
    </div>
  )
}

function Message({ msg }: { msg: Msg }) {
  const isBot = msg.role === 'assistant'

  if (isBot) return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <BotAvatar/>
      <div style={{ maxWidth: '82%' }}>
        <div style={{
          background: C.card2, border: `1px solid ${C.border}`,
          borderRadius: '4px 14px 14px 14px',
          padding: '10px 14px', color: C.text,
          fontSize: 13.5, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {msg.content || <TypingDots/>}
        </div>
        <p style={{ color: C.muted, fontSize: 10.5, marginTop: 4, paddingLeft: 2 }}>
          {msg.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: 'linear-gradient(135deg,#F5921B,#D96820)',
          borderRadius: '14px 4px 14px 14px',
          padding: '10px 14px', color: '#fff',
          fontSize: 13.5, lineHeight: 1.6,
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>
        <p style={{ color: C.muted, fontSize: 10.5, marginTop: 4, textAlign: 'right', paddingRight: 2 }}>
          Você · {msg.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export default function ChatWidget() {
  const [open,      setOpen]      = useState(false)
  const [messages,  setMessages]  = useState<Msg[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [unread,    setUnread]    = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef   = useRef<AbortController | null>(null)

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const name = user.full_name?.split(' ')[0] || 'aqui'
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Olá${name !== 'aqui' ? ', ' + name : ''}! 👋 Sou o **Cheetah AI**, seu assistente de segurança.\n\nComo posso ajudá-lo hoje?`,
        ts: new Date(),
      }])
    }
    if (open) {
      setUnread(false)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const userMsg: Msg = { id: Date.now().toString(), role: 'user', content: trimmed, ts: new Date() }
    const botId = (Date.now() + 1).toString()
    const botMsg: Msg = { id: botId, role: 'assistant', content: '', ts: new Date() }

    setMessages(prev => [...prev, userMsg, botMsg])
    setInput('')
    setStreaming(true)

    const history = messages
      .filter(m => m.id !== 'welcome')
      .slice(-18)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      abortRef.current = new AbortController()
      const token = localStorage.getItem('access_token') || ''
      const res = await fetch('/api/v1/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: trimmed, history }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Falha na conexão')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const { t, err } = JSON.parse(raw)
            if (err) {
              setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: err } : m))
            } else if (t) {
              setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: m.content + t } : m))
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === botId ? { ...m, content: 'Desculpe, ocorreu um erro. Tente novamente.' } : m
        ))
      }
    } finally {
      setStreaming(false)
      if (!open) setUnread(true)
    }
  }, [messages, streaming, open])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function reset() {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
    setInput('')
  }

  return (
    <>
      <style>{`
        @keyframes chatdot {
          0%,80%,100% { transform:scale(.6); opacity:.4 }
          40%          { transform:scale(1);  opacity:1   }
        }
        @keyframes chatpop {
          from { opacity:0; transform:translateY(16px) scale(.95) }
          to   { opacity:1; transform:translateY(0)    scale(1)   }
        }
        .chat-panel { animation: chatpop .22s cubic-bezier(.22,1,.36,1) }
        textarea.chat-input::-webkit-scrollbar { display:none }
        .chat-msgs::-webkit-scrollbar { width:4px }
        .chat-msgs::-webkit-scrollbar-track { background:transparent }
        .chat-msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:4px }
      `}</style>

      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: open
            ? 'rgba(245,146,27,.2)'
            : 'linear-gradient(135deg,#F5921B,#D96820)',
          border: open ? '2px solid rgba(245,146,27,.5)' : 'none',
          boxShadow: open ? 'none' : '0 8px 28px rgba(245,146,27,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all .25s',
        }}
        title="Cheetah AI"
      >
        {open
          ? <X size={22} style={{ color: C.accent }}/>
          : <MessageCircle size={24} style={{ color: '#fff' }}/>
        }
        {unread && !open && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 12, height: 12, borderRadius: '50%',
            background: '#EF4444', border: '2px solid #0B0F1A',
          }}/>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div className="chat-panel" style={{
          position: 'fixed', bottom: 98, right: 28, zIndex: 999,
          width: 375, height: 540,
          background: C.card,
          border: `1px solid rgba(255,255,255,.09)`,
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.04)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: "'Inter','Segoe UI',sans-serif",
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 13px',
            background: 'linear-gradient(135deg,rgba(245,146,27,.12),rgba(245,146,27,.04))',
            borderBottom: `1px solid rgba(255,255,255,.07)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'linear-gradient(135deg,#F5921B,#D96820)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(245,146,27,.4)',
              }}>
                <Shield size={17} style={{ color: '#fff' }}/>
              </div>
              <div>
                <p style={{ color: C.text, fontWeight: 700, fontSize: 14, margin: 0 }}>Cheetah AI</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#22C55E',
                    boxShadow: '0 0 5px rgba(34,197,94,.8)',
                  }}/>
                  <span style={{ color: '#22C55E', fontSize: 11, fontWeight: 600 }}>Online</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={reset}
                title="Nova conversa"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255,255,255,.05)', border: `1px solid rgba(255,255,255,.07)`,
                  color: C.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.sub; e.currentTarget.style.background = 'rgba(255,255,255,.09)' }}
                onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'rgba(255,255,255,.05)' }}
              >
                <RotateCcw size={13}/>
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Minimizar"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255,255,255,.05)', border: `1px solid rgba(255,255,255,.07)`,
                  color: C.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.sub; e.currentTarget.style.background = 'rgba(255,255,255,.09)' }}
                onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'rgba(255,255,255,.05)' }}
              >
                <Minimize2 size={13}/>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-msgs" style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {messages.map(m => <Message key={m.id} msg={m}/>)}

            {/* Suggestions — show after welcome only */}
            {messages.length === 1 && !streaming && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 40 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    background: 'rgba(245,146,27,.07)',
                    border: '1px solid rgba(245,146,27,.2)',
                    borderRadius: 20, color: C.accent,
                    fontSize: 12, fontWeight: 600,
                    padding: '6px 14px', cursor: 'pointer', textAlign: 'left',
                    transition: 'background .15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,146,27,.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,146,27,.07)')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px 12px',
            borderTop: `1px solid rgba(255,255,255,.07)`,
            background: 'rgba(10,14,26,.5)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              background: 'rgba(255,255,255,.04)',
              border: `1.5px solid rgba(255,255,255,.08)`,
              borderRadius: 14, padding: '8px 8px 8px 14px',
              transition: 'border-color .2s',
            }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(245,146,27,.4)')}
              onBlurCapture={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}
            >
              <textarea
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={streaming}
                placeholder="Digite sua pergunta..."
                rows={1}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: C.text, fontSize: 13.5, lineHeight: 1.5,
                  resize: 'none', maxHeight: 100, overflow: 'auto',
                  fontFamily: "'Inter','Segoe UI',sans-serif",
                  paddingTop: 2,
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: streaming || !input.trim()
                    ? 'rgba(245,146,27,.2)'
                    : 'linear-gradient(135deg,#F5921B,#D96820)',
                  border: 'none', cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .2s',
                  boxShadow: streaming || !input.trim() ? 'none' : '0 3px 10px rgba(245,146,27,.35)',
                }}
              >
                <Send size={15} style={{ color: streaming || !input.trim() ? 'rgba(245,146,27,.5)' : '#fff' }}/>
              </button>
            </div>
            <p style={{ color: C.muted, fontSize: 10.5, textAlign: 'center', marginTop: 7 }}>
              Cheetah AI · Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>

        </div>
      )}
    </>
  )
}
