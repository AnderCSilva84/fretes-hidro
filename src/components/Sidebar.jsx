import { NavLink } from 'react-router-dom'
import useAuth from '../context/useAuth.js'
import { getDefaultHomeRoute, hasFreteAccess, hasPassagemAccess } from '../utils/accessControl.js'
import {
  BoatIcon,
  BuildingIcon,
  ClipboardIcon,
  DashboardIcon,
  MoneyIcon,
  PackageIcon,
  PeopleIcon,
  PinIcon,
  PlusIcon,
  RouteIcon,
  SearchIcon,
  ShieldIcon,
} from './AppIcons.jsx'
import { SYSTEM_ICON_SRC, SYSTEM_NAME } from '../utils/systemConfig.js'

function SidebarSection({ title, items, onClose }) {
  if (!items.length) {
    return null
  }

  return (
    <section className="space-y-2">
      <p className="px-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
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
      </div>
    </section>
  )
}

export default function Sidebar({ open = false, onClose }) {
  const { user } = useAuth()
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)

  const dashboardItems = [
    { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  ]

  const freteItems = canAccessFretes
    ? [
        { to: '/nova-comanda', label: 'Novo Frete', icon: PlusIcon },
        { to: '/clientes', label: 'Clientes', icon: PeopleIcon },
        { to: '/encomendas', label: 'Encomendas', icon: PackageIcon },
        { to: '/scanner-retirada', label: 'Scanner Retirada', icon: SearchIcon },
      ]
    : []

  const passagemItems = canAccessPassagens
    ? [
        { to: '/nova-passagem', label: 'Nova Passagem', icon: PlusIcon },
        { to: '/passageiros', label: 'Passageiros', icon: PeopleIcon },
        { to: '/passagens', label: 'Passagens', icon: PackageIcon },
        { to: '/scanner-embarque', label: 'Scanner Embarque', icon: SearchIcon },
      ]
    : []

  const sharedItems = [
    { to: '/terminais', label: 'Terminais', icon: PinIcon },
    { to: '/embarcacoes', label: 'Embarcacoes', icon: BoatIcon },
    { to: '/rotas-valores', label: 'Rotas e Valores', icon: RouteIcon },
    { to: '/caixa', label: 'Caixa', icon: MoneyIcon },
  ]

  const adminItems =
    user?.perfil === 'superadmin'
      ? [
          { to: '/usuarios', label: 'Usuarios', icon: ShieldIcon },
          { to: '/empresas', label: 'Empresas', icon: BuildingIcon },
          ...(user?.rootSuperadmin ? [{ to: '/logs-uso', label: 'Logs de uso', icon: ClipboardIcon }] : []),
        ]
      : []

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 h-screen w-[21rem] max-w-[90vw] overflow-y-auto overscroll-contain border-r border-blue-100 bg-white/98 p-5 pb-10 text-slate-900 shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-6 rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] px-4 py-5 text-white shadow-panel">
        <div className="flex items-center gap-3">
          <img
            src={SYSTEM_ICON_SRC}
            alt={SYSTEM_NAME}
            className="h-16 w-16 scale-[1.15] rounded-[1.7rem] border border-white/35 bg-white object-cover p-1.5 shadow-[0_14px_28px_rgba(15,23,42,0.22)] sm:h-[5.5rem] sm:w-[5.5rem]"
          />
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] sm:text-5xl">{SYSTEM_NAME}</h2>
        </div>
        <p className="mt-2 text-sm text-blue-100/85">
          Ambientes separados para fretes e passagens, com acesso por modulo.
        </p>
      </div>

      <nav className="space-y-5">
        <SidebarSection title="Inicio" items={dashboardItems} onClose={onClose} />
        <SidebarSection title="Fretes" items={freteItems} onClose={onClose} />
        <SidebarSection title="Passagens" items={passagemItems} onClose={onClose} />
        <SidebarSection title="Estrutura Compartilhada" items={sharedItems} onClose={onClose} />
        <SidebarSection title="Administracao" items={adminItems} onClose={onClose} />
      </nav>

      <div className="mt-6 rounded-[1.6rem] border border-blue-100 bg-blue-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Acesso atual</p>
        {user?.impersonationActive ? (
          <p className="mt-1 text-amber-700">
            Simulando: {user.nome || user.email} ({user.perfil || 'operador'})
          </p>
        ) : null}
        <p className="mt-1">
          Inicio padrao: {getDefaultHomeRoute(user)}
        </p>
        <p className="mt-1">
          Modulos: {canAccessFretes ? 'Fretes' : ''}{canAccessFretes && canAccessPassagens ? ' + ' : ''}{canAccessPassagens ? 'Passagens' : ''}
        </p>
      </div>
    </aside>
  )
}
