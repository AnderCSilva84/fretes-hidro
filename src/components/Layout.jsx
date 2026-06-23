import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useAuth from '../context/useAuth.js'
import { HomeIcon, ListIcon, MoneyIcon, PlusIcon } from './AppIcons.jsx'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

const bottomNav = [
  { to: '/dashboard', label: 'Inicio', icon: HomeIcon },
  { to: '/nova-comanda', label: 'Novo', icon: PlusIcon, primary: true },
  { to: '/encomendas', label: 'Lista', icon: ListIcon },
  { to: '/caixa', label: 'Caixa', icon: MoneyIcon },
]

export default function Layout({ title, subtitle, icon, children, immersive = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()

  if (immersive) {
    return (
      <div className="min-h-screen bg-transparent">
        <main className="min-h-screen">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-[#0a2d61]/40 backdrop-blur-[1px]"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col">
        <Header
          title={title}
          subtitle={subtitle}
          icon={icon}
          user={user}
          onMenuClick={() => setMenuOpen((value) => !value)}
          onLogout={logout}
        />

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-5">
          <div className="mx-auto w-full max-w-[1040px]">{children}</div>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-blue-100 bg-white/96 px-4 pb-4 pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto grid w-full max-w-[720px] grid-cols-4 gap-2">
            {bottomNav.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to
              const isPrimary = item.primary

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center gap-2 rounded-2xl px-2 py-2 text-center"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      isPrimary
                        ? 'bg-[#1657d8] text-white shadow-[0_10px_24px_rgba(28,99,231,0.28)]'
                        : isActive
                          ? 'bg-[#1657d8] text-white'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon />
                  </div>
                  <span className={`text-sm font-semibold ${isPrimary || isActive ? 'text-[#1657d8]' : 'text-slate-600'}`}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </footer>
      </div>
    </div>
  )
}
