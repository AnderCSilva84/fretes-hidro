import { NavLink } from 'react-router-dom'
import useAuth from '../context/useAuth.js'
import useBranding from '../context/useBranding.js'
import { canAccessManagement, getDefaultHomeRoute, hasFreteAccess, hasPassagemAccess } from '../utils/accessControl.js'
import { isTerminalEnvironment } from '../utils/appEnvironment.js'
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
    <section className="sidebar-section space-y-2">
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
                `sidebar-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive ? 'text-white shadow-panel' : 'bg-blue-50 text-slate-700 hover:bg-blue-100'
                }`
              }
              style={({ isActive }) => (isActive ? { background: 'var(--brand-primary)' } : undefined)}
            >
              <span className="sidebar-link-icon flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-current">
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
  const { company, branding } = useBranding()
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)
  const terminalEnvironment = isTerminalEnvironment()
  const managementAccess = canAccessManagement(user) && !terminalEnvironment
  const terminalSuperadminReadAccess = terminalEnvironment && Boolean(user?.rootSuperadmin || user?.perfil === 'superadmin')

  const dashboardItems = managementAccess ? [{ to: '/dashboard', label: 'Dashboard', icon: DashboardIcon }] : []

  const freteItems = canAccessFretes
    ? [
        { to: '/nova-comanda', label: 'Novo Frete', icon: PlusIcon },
        ...(managementAccess ? [{ to: '/encomendas', label: 'Encomendas', icon: PackageIcon }] : []),
        { to: '/scanner-retirada', label: 'Scanner Retirada', icon: SearchIcon },
      ]
    : []

  const passagemItems = canAccessPassagens
    ? [
        { to: '/nova-passagem', label: 'Venda por Mapa', icon: PlusIcon },
        { to: '/passagens', label: 'Passagens', icon: PackageIcon },
        { to: '/scanner-embarque', label: 'Scanner Embarque', icon: SearchIcon },
      ]
    : []

  const cadastroItems = [
    ...(managementAccess && canAccessFretes ? [{ to: '/clientes', label: 'Clientes', icon: PeopleIcon }] : []),
    ...(managementAccess && canAccessPassagens ? [{ to: '/passageiros', label: 'Passageiros', icon: PeopleIcon }] : []),
    ...(managementAccess || terminalSuperadminReadAccess
      ? [
          { to: '/viagens', label: 'Linhas e Horarios', icon: BoatIcon },
          { to: '/terminais', label: 'Terminais', icon: PinIcon },
          { to: '/embarcacoes', label: 'Embarcacoes', icon: BoatIcon },
          { to: '/rotas-valores', label: 'Rotas e Valores', icon: RouteIcon },
        ]
      : []),
    ...(!terminalEnvironment && user?.perfil === 'superadmin'
      ? [
          { to: '/usuarios', label: 'Usuarios', icon: ShieldIcon },
          { to: '/empresas', label: 'Empresas', icon: BuildingIcon },
        ]
      : []),
  ]

  const sharedItems = [{ to: '/caixa', label: 'Caixa', icon: MoneyIcon }]

  const adminItems =
    !terminalEnvironment && user?.perfil === 'superadmin'
      ? [
          ...(user?.rootSuperadmin ? [{ to: '/logs-uso', label: 'Logs de uso', icon: ClipboardIcon }] : []),
          ...(user?.rootSuperadmin ? [{ to: '/migracao-dados', label: 'Migrar dados', icon: ClipboardIcon }] : []),
        ]
      : []

  return (
    <aside
      aria-hidden={!open}
      className="app-sidebar fixed inset-y-0 left-0 z-30 h-screen w-[21rem] max-w-[90vw] overflow-y-auto overscroll-contain border-r border-blue-100 bg-white/98 p-5 pb-10 text-slate-900 shadow-2xl"
      style={{
        transform: open ? 'translate3d(0, 0, 0)' : 'translate3d(-101%, 0, 0)',
        WebkitTransform: open ? 'translate3d(0, 0, 0)' : 'translate3d(-101%, 0, 0)',
        transition: 'transform 300ms ease',
        WebkitTransition: '-webkit-transform 300ms ease',
        visibility: open ? 'visible' : 'hidden',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div className="sticky top-0 z-10 mb-2 flex justify-end pointer-events-none">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-white text-2xl leading-none text-slate-700 shadow-lg"
          aria-label="Fechar menu"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div
        className="sidebar-brand mb-6 rounded-[1.8rem] px-4 py-5 text-white shadow-panel"
        style={{
          background: 'linear-gradient(135deg, var(--brand-secondary) 0%, var(--brand-primary) 45%, var(--brand-secondary) 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src={branding.logoUrl || SYSTEM_ICON_SRC}
            alt={company?.nome || SYSTEM_NAME}
            className="sidebar-logo h-16 w-16 scale-[1.15] rounded-[1.7rem] border border-white/35 bg-white object-cover p-1.5 shadow-[0_14px_28px_rgba(15,23,42,0.22)] sm:h-[5.5rem] sm:w-[5.5rem]"
          />
          <h2 className="sidebar-name min-w-0 break-words text-[2rem] font-bold tracking-[-0.03em] sm:text-5xl">{company?.nome || SYSTEM_NAME}</h2>
        </div>
        <p className="mt-2 text-sm text-blue-100/85">
          Ambientes separados para fretes e passagens, com acesso por modulo.
        </p>
      </div>

      <nav className="space-y-5">
        <SidebarSection title="Inicio" items={dashboardItems} onClose={onClose} />
        <SidebarSection title="Fretes" items={freteItems} onClose={onClose} />
        <SidebarSection title="Passagens" items={passagemItems} onClose={onClose} />
        <SidebarSection title="Cadastros" items={cadastroItems} onClose={onClose} />
        <SidebarSection title="Operacao" items={sharedItems} onClose={onClose} />
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
