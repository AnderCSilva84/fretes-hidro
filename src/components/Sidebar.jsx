import { NavLink } from 'react-router-dom'
import useAuth from '../context/useAuth.js'
import {
  BoatIcon,
  DashboardIcon,
  MoneyIcon,
  PackageIcon,
  PeopleIcon,
  PinIcon,
  PlusIcon,
  RouteIcon,
  ShieldIcon,
} from './AppIcons.jsx'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/nova-comanda', label: 'Novo Frete', icon: PlusIcon },
  { to: '/clientes', label: 'Clientes', icon: PeopleIcon },
  { to: '/terminais', label: 'Terminais', icon: PinIcon },
  { to: '/embarcacoes', label: 'Embarcacoes', icon: BoatIcon },
  { to: '/rotas-valores', label: 'Rotas e Valores', icon: RouteIcon },
  { to: '/encomendas', label: 'Encomendas', icon: PackageIcon },
  { to: '/caixa', label: 'Caixa', icon: MoneyIcon },
]

export default function Sidebar({ open = false, onClose }) {
  const { user } = useAuth()
  const menuItems =
    user?.perfil === 'superadmin'
      ? [...items, { to: '/usuarios', label: 'Usuarios', icon: ShieldIcon }]
      : items

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-[21rem] max-w-[90vw] border-r border-blue-100 bg-white/98 p-5 text-slate-900 shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-6 rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] px-4 py-5 text-white shadow-panel">
        <h2 className="text-2xl font-bold tracking-[-0.03em]">LUZ DA AURORA III</h2>
        <p className="mt-2 text-sm text-blue-100/85">Controle de balcao, terminais, encomendas e caixa.</p>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive ? 'bg-[#1657d8] text-white shadow-panel' : 'bg-blue-50 text-slate-700 hover:bg-blue-100'
                }`
              }
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-current">
                <Icon />
              </span>
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-6 rounded-[1.6rem] border border-blue-100 bg-blue-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Aplicativo vertical</p>
        <p className="mt-1">Interface adaptada para uso pratico em celular e tablet no modo retrato.</p>
      </div>
    </aside>
  )
}
