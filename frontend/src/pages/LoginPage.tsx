import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '../api/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', tenant_slug: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const me = await api.get('/auth/me')
      localStorage.setItem('user', JSON.stringify(me.data))
      navigate('/app')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao fazer login. Verifique os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #16213E 0%, #0F3460 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-icon.png" alt="Cheetah Technology"
            className="mx-auto object-contain mb-3" style={{ height: 64 }} />
          <p className="text-xl font-bold text-white">Cheetah Technology</p>
          <p className="text-gray-400 text-sm mt-1">Plataforma de Cibersegurança para PMEs</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Entrar na plataforma</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID da Empresa</label>
              <input
                type="text" required placeholder="ex: clinica-bemestar"
                value={form.tenant_slug}
                onChange={e => setForm(f => ({ ...f, tenant_slug: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#F5921B' } as any}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email" required placeholder="seu@email.com.br"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} required placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-70"
              style={{ background: '#F5921B' }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Contas de demonstração:</p>
            <p className="text-xs text-gray-600">🏥 <b>clinica-bemestar</b> · admin@clinicabemestar.com.br · admin123</p>
            <p className="text-xs text-gray-600 mt-1">🔧 <b>oficina-santos</b> · jose@oficinasantos.com.br · admin123</p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2026 Cheetah Security Platform · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
