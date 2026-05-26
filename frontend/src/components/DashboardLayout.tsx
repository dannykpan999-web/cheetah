import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Globe, FileSearch, Monitor, LogOut, LayoutDashboard, Bell, Search, Menu, X, ShieldCheck, CreditCard } from 'lucide-react'
import { logout } from '../api/client'
import NotificationPanel from './NotificationPanel'
import UserDropdown from './UserDropdown'
import ChatWidget from './ChatWidget'

const C = {
  bg:     '#0B0F1A',
  card:   '#141929',
  border: 'rgba(255,255,255,0.07)',
  brd:    '1px solid rgba(255,255,255,0.07)',
  accent: '#F5921B',
  muted:  '#475569',
  sub:    '#94A3B8',
  text:   '#F1F5F9',
}

const NAV = [
  { to: '/app',          icon: 'LayoutDashboard', label: 'Dashboard',  end: true  },
  { to: '/app/dns',      icon: 'Globe',           label: 'DNS',        end: false },
  { to: '/app/scanner',  icon: 'FileSearch',      label: 'Scanner',    end: false },
  { to: '/app/endpoint', icon: 'Monitor',         label: 'Endpoint',   end: false },
  { to: '/app/lgpd',     icon: 'ShieldCheck',     label: 'LGPD',       end: false },
  { to: '/app/billing',  icon: 'CreditCard',      label: 'Cobrança',   end: false },
]

const ICON_MAP: Record<string, any> = { LayoutDashboard, Globe, FileSearch, Monitor, ShieldCheck, CreditCard }

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-0.5">
      {NAV.map(({ to, icon, label, end }) => {
        const Icon = ICON_MAP[icon]
        return (
          <NavLink key={to} to={to} end={end}
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={({ isActive }) => isActive
              ? { background: 'rgba(245,146,27,0.12)', border: '1px solid rgba(245,146,27,0.25)', color: C.text }
              : { color: C.sub, border: '1px solid transparent' }
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} style={{ color: isActive ? C.accent : C.muted, flexShrink: 0 }} />
                {label}
              </>
            )}
          </NavLink>
        )
      })}
    </div>
  )
}

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [userOpen,   setUserOpen]   = useState(false)

  function toggleNotif() { setNotifOpen(v => !v); setUserOpen(false) }
  function toggleUser()  { setUserOpen(v => !v);  setNotifOpen(false) }
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const roleMap: Record<string, string> = { owner: 'Proprietario', admin: 'Administrador', viewer: 'Visualizador' }
  const initials = (user.full_name || user.email || 'U')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, color: C.text }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col" style={{ background: C.bg, borderRight: C.brd }}>
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <img src="/logo-icon.png" alt="" className="object-contain flex-shrink-0" style={{ height: 34 }} />
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: C.text }}>Cheetah</p>
            <p className="text-xs font-medium" style={{ color: C.accent }}>Technology</p>
          </div>
        </div>
        <nav className="flex-1 px-3 overflow-y-auto py-2">
          <p className="text-xs font-semibold px-3 mb-2 tracking-widest" style={{ color: C.muted }}>GERAL</p>
          <SidebarNav />
        </nav>
        <div className="px-4 py-4" style={{ borderTop: C.brd }}>
          <div className="flex items-center gap-3 mb-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                style={{ border:'1.5px solid rgba(245,146,27,.3)' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#F5921B,#D96820)' }}>
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{user.full_name || user.email}</p>
              <p className="text-xs truncate" style={{ color: C.muted }}>{roleMap[user.role] || user.role}</p>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 text-xs w-full px-2 py-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: C.muted }}>
            <LogOut size={13} /> Sair da conta
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] flex flex-col h-full z-10"
            style={{ background: C.bg, borderRight: C.brd }}>
            <div className="flex items-center justify-between px-4 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                <img src="/logo-icon.png" alt="" style={{ height: 32 }} />
                <div>
                  <p className="font-bold text-sm leading-tight" style={{ color: C.text }}>Cheetah</p>
                  <p className="text-xs font-medium" style={{ color: C.accent }}>Technology</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ color: C.muted }}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 overflow-y-auto py-2">
              <p className="text-xs font-semibold px-3 mb-2 tracking-widest" style={{ color: C.muted }}>GERAL</p>
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </nav>
            <div className="px-4 py-5" style={{ borderTop: C.brd }}>
              <div className="flex items-center gap-3 mb-4">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar"
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                    style={{ border:'1.5px solid rgba(245,146,27,.3)' }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#F5921B,#D96820)' }}>
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{user.full_name || user.email}</p>
                  <p className="text-xs truncate" style={{ color: C.muted }}>{roleMap[user.role] || user.role}</p>
                </div>
              </div>
              <button onClick={logout}
                className="flex items-center gap-2 text-sm w-full px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: C.muted, border: C.brd }}>
                <LogOut size={15} /> Sair da conta
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between px-3 md:px-6 flex-shrink-0"
          style={{ background: C.bg, borderBottom: C.brd, minHeight: 56 }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Hamburger — mobile only */}
            <button className="md:hidden p-1.5 rounded-lg flex-shrink-0"
              onClick={() => setDrawerOpen(true)} style={{ color: C.muted }}>
              <Menu size={22} />
            </button>
            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <img src="/logo-icon.png" alt="" style={{ height: 26, flexShrink: 0 }} />
              <span className="font-bold text-sm truncate" style={{ color: C.text }}>Cheetah</span>
            </div>
            {/* Desktop search */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl flex-1 max-w-xs"
              style={{ background: C.card, border: C.brd }}>
              <Search size={14} style={{ color: C.muted }} />
              <input placeholder="Pesquisar..." className="bg-transparent text-sm outline-none flex-1"
                style={{ color: C.sub }} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Bell + NotificationPanel */}
            <div style={{ position:'relative' }}>
              <button
                className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5"
                style={{ border: C.brd }}
                onClick={toggleNotif}
              >
                <Bell size={15} style={{ color: notifOpen ? C.accent : C.muted }} />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} />
              </button>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Avatar + UserDropdown */}
            <div style={{ position:'relative', borderLeft: C.brd, paddingLeft:12 }}>
              <button
                className="flex items-center gap-2 cursor-pointer"
                style={{ background:'none', border:'none', padding:0 }}
                onClick={toggleUser}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    style={{
                      boxShadow: userOpen ? '0 0 0 2px rgba(245,146,27,.55)' : 'none',
                      border: '1.5px solid rgba(245,146,27,.3)',
                      transition:'box-shadow .2s',
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg,#F5921B,#D96820)',
                      boxShadow: userOpen ? '0 0 0 2px rgba(245,146,27,.5)' : 'none',
                      transition:'box-shadow .2s',
                    }}>
                    {initials}
                  </div>
                )}
              </button>
              {userOpen && <UserDropdown onClose={() => setUserOpen(false)} />}
            </div>

          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for tab bar */}
        <main className="flex-1 overflow-auto" style={{ background: C.bg, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="pb-16 md:pb-0">
            <Outlet />
          </div>
        </main>

        {/* ── Mobile Bottom Tab Bar ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex"
          style={{ background: C.bg, borderTop: C.brd, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {NAV.map(({ to, icon, label, end }) => {
            const Icon = ICON_MAP[icon]
            return (
              <NavLink key={to} to={to} end={end}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
                style={({ isActive }) => ({ color: isActive ? C.accent : C.muted })}
              >
                {({ isActive }) => (
                  <>
                    <div className="w-8 h-8 flex items-center justify-center rounded-xl"
                      style={isActive ? { background: 'rgba(245,146,27,0.12)' } : {}}>
                      <Icon size={18} style={{ color: isActive ? C.accent : C.muted }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* ── AI Chat Widget ── */}
      <ChatWidget />
    </div>
  )
}
