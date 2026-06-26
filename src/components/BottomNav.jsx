import { Link, useLocation } from 'react-router-dom'
import useAuth from '../context/useAuth.js'
import { HomeIcon, ListIcon, MoneyIcon, PlusIcon } from './AppIcons.jsx'
import { hasFreteAccess, hasPassagemAccess } from '../utils/accessControl.js'

function getBottomNavItems(user) {
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)

  if (canAccessFretes && !canAccessPassagens) {
    return [
      { to: '/dashboard', label: 'Inicio', icon: HomeIcon },
      { to: '/nova-comanda', label: 'Novo', icon: PlusIcon, primary: true },
      { to: '/encomendas', label: 'Lista', icon: ListIcon },
      { to: '/caixa', label: 'Caixa', icon: MoneyIcon },
    ]
  }

  if (canAccessPassagens && !canAccessFretes) {
    return [
      { to: '/dashboard', label: 'Inicio', icon: HomeIcon },
      { to: '/nova-passagem', label: 'Novo', icon: PlusIcon, primary: true },
      { to: '/passagens', label: 'Lista', icon: ListIcon },
      { to: '/caixa', label: 'Caixa', icon: MoneyIcon },
    ]
  }

  return [
    { to: '/dashboard', label: 'Inicio', icon: HomeIcon },
    { to: '/nova-comanda', label: 'Novo', icon: PlusIcon, primary: true },
    { to: '/encomendas', label: 'Lista', icon: ListIcon },
    { to: '/caixa', label: 'Caixa', icon: MoneyIcon },
  ]
}

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const bottomNav = getBottomNavItems(user)

  return (
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
  )
}
