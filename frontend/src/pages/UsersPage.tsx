import { useEffect, useState, FormEvent } from 'react'
import {
  Users, Plus, Trash2, ShieldCheck, Eye, Crown,
  X, Loader, Mail, User as UserIcon, Lock, ChevronDown,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from '../context/ToastContext'

const BORDER = '1px solid rgba(255,255,255,0.07)'
const CARD   = '#141929'
const TEXT   = '#F1F5F9'
const MUTED  = '#475569'
const SUB    = '#94A3B8'
const ACCENT = '#F5921B'
const BG     = '#0B0F1A'

interface Member {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  avatar_url: string | null
  created_at: string | null
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  owner:  { label: 'Proprietário', color: '#A855F7', bg: 'rgba(168,85,247,0.12)', Icon: Crown      },
  admin:  { label: 'Administrador', color: '#F5921B', bg: 'rgba(245,146,27,0.12)', Icon: ShieldCheck },
  viewer: { label: 'Visualizador',  color: '#64748B', bg: 'rgba(100,116,139,0.12)', Icon: Eye         },
}

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? ROLE_META.viewer
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color }}>
      <m.Icon size={11} /> {m.label}
    </span>
  )
}

function Avatar({ member, size = 32 }: { member: Member; size?: number }) {
  const initials = (member.full_name || member.email)
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const color = member.role === 'owner' ? '#A855F7' : member.role === 'admin' ? '#F5921B' : '#475569'
  if (member.avatar_url) {
    return <img src={member.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, border: `1.5px solid ${color}40` }} />
  }
  return (
    <div className="rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `${color}30`, color, border: `1.5px solid ${color}40` }}>
      {initials}
    </div>
  )
}

export default function UsersPage() {
  const [members, setMembers]     = useState<Member[]>([])
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removing, setRemoving]   = useState(false)
  const [roleLoading, setRoleLoading] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'viewer' })
  const { toast } = useToast()

  const me = JSON.parse(localStorage.getItem('user') || '{}')
  const canManage = me.role === 'owner' || me.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get<Member[]>('/users/team')
      setMembers(r.data)
    } catch {} finally { setLoading(false) }
  }

  async function invite(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/users/invite', form)
      await load()
      setForm({ full_name: '', email: '', password: '', role: 'viewer' })
      setShowForm(false)
      toast('success', 'Membro Convidado', `${form.email} adicionado à equipe como ${ROLE_META[form.role]?.label}.`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Não foi possível convidar o usuário.'
      toast('error', 'Falha ao Convidar', msg)
    } finally { setSaving(false) }
  }

  async function changeRole(userId: string, role: string) {
    setRoleLoading(userId)
    try {
      await api.patch(`/users/${userId}/role`, { role })
      setMembers(m => m.map(x => x.id === userId ? { ...x, role } : x))
      toast('info', 'Cargo Atualizado', `Cargo alterado para ${ROLE_META[role]?.label}.`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Não foi possível alterar o cargo.'
      toast('error', 'Falha', msg)
    } finally { setRoleLoading(null) }
  }

  async function removeMember(userId: string) {
    setRemoving(true)
    const target = members.find(m => m.id === userId)
    try {
      await api.delete(`/users/${userId}`)
      setMembers(m => m.filter(x => x.id !== userId))
      setConfirmId(null)
      toast('info', 'Membro Removido', `${target?.full_name || target?.email} removido da equipe.`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Não foi possível remover o usuário.'
      toast('error', 'Falha ao Remover', msg)
    } finally { setRemoving(false) }
  }

  const ownerCount = members.filter(m => m.role === 'owner').length

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5" style={{ color: TEXT }}>
            <Users size={20} style={{ color: ACCENT }} /> Equipe
          </h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            {members.length} membro{members.length !== 1 ? 's' : ''} · Gerencie acesso e cargos
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: ACCENT, color: '#fff' }}>
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Cancelar' : 'Convidar Membro'}
          </button>
        )}
      </div>

      {/* Invite form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: CARD, border: '1px solid rgba(245,146,27,0.25)' }}>
          <p className="text-sm font-semibold" style={{ color: TEXT }}>Novo Membro</p>
          <form onSubmit={invite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                <input type="text" required placeholder="Nome completo" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: BG, border: BORDER, color: TEXT }} />
              </div>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                <input type="email" required placeholder="E-mail" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: BG, border: BORDER, color: TEXT }} />
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                <input type="password" required placeholder="Senha de acesso" value={form.password}
                  minLength={6}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: BG, border: BORDER, color: TEXT }} />
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: MUTED }}>Cargo</p>
                <div className="flex gap-2">
                  {(me.role === 'owner'
                    ? [{ value: 'viewer', label: 'Visualizador' }, { value: 'admin', label: 'Administrador' }]
                    : [{ value: 'viewer', label: 'Visualizador' }]
                  ).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, role: opt.value }))}
                      className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                      style={form.role === opt.value
                        ? { background: ACCENT + '20', color: ACCENT, border: `1px solid ${ACCENT}50` }
                        : { background: BG, color: MUTED, border: BORDER }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: ACCENT, color: '#fff' }}>
              {saving ? <><Loader size={14} className="animate-spin" /> Convidando...</> : <><Plus size={15} /> Adicionar à Equipe</>}
            </button>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: BORDER }}>
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: BORDER }}>
          <p className="text-xs font-semibold tracking-widest" style={{ color: MUTED }}>MEMBROS</p>
          <p className="text-xs" style={{ color: MUTED }}>
            {ownerCount} proprietário · {members.filter(m => m.role === 'admin').length} admin · {members.filter(m => m.role === 'viewer').length} visualizador
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm" style={{ color: MUTED }}>
            <Loader size={14} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {members.map(member => (
              <div key={member.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">

                <Avatar member={member} size={38} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                    {member.full_name || '—'}
                    {member.id === me.id && (
                      <span className="ml-2 text-xs font-normal" style={{ color: MUTED }}>(você)</span>
                    )}
                  </p>
                  <p className="text-xs truncate" style={{ color: MUTED }}>{member.email}</p>
                </div>

                <div className="hidden sm:block flex-shrink-0">
                  <RoleBadge role={member.role} />
                </div>

                <div className="text-xs flex-shrink-0" style={{ color: MUTED }}>
                  {member.is_active
                    ? <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Ativo
                      </span>
                    : <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: MUTED }} /> Inativo
                      </span>
                  }
                </div>

                {/* Role change (owner can change anyone except themselves; admin can't change) */}
                {canManage && member.role !== 'owner' && member.id !== me.id && (
                  <div className="relative flex-shrink-0">
                    {roleLoading === member.id ? (
                      <Loader size={14} className="animate-spin" style={{ color: MUTED }} />
                    ) : (
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={e => changeRole(member.id, e.target.value)}
                          className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                          style={{ background: BG, border: BORDER, color: SUB }}>
                          <option value="viewer">Visualizador</option>
                          {me.role === 'owner' && <option value="admin">Administrador</option>}
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ color: MUTED }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Remove */}
                {canManage && member.role !== 'owner' && member.id !== me.id && (
                  <div className="flex-shrink-0">
                    {confirmId === member.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs" style={{ color: MUTED }}>Remover?</span>
                        <button type="button" disabled={removing}
                          onClick={() => removeMember(member.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-60"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                          {removing ? <Loader size={10} className="animate-spin" /> : 'Sim'}
                        </button>
                        <button type="button" disabled={removing}
                          onClick={() => setConfirmId(null)}
                          className="px-2 py-1 rounded-lg text-xs"
                          style={{ color: MUTED, background: 'rgba(255,255,255,0.05)' }}>
                          Não
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(member.id)}
                        className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                        style={{ color: MUTED }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <ShieldCheck size={15} style={{ color: '#3B82F6', marginTop: 1, flexShrink: 0 }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: TEXT }}>Sobre cargos</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: MUTED }}>
            <strong style={{ color: SUB }}>Proprietário</strong> — acesso total, não pode ser removido. &nbsp;
            <strong style={{ color: SUB }}>Administrador</strong> — gerencia políticas, endpoints e usuários visualizadores. &nbsp;
            <strong style={{ color: SUB }}>Visualizador</strong> — acesso somente leitura ao painel.
          </p>
        </div>
      </div>

    </div>
  )
}
