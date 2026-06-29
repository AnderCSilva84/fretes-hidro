import Button from './Button.jsx'
import { SYSTEM_ICON_SRC, SYSTEM_NAME } from '../utils/systemConfig.js'

export default function Header({ title, icon, onMenuClick, onLogout, user }) {
  const empresaAtual = getEmpresaAtual(user)
  const nomeExibido = user?.impersonationActive
    ? user?.impersonatedBy?.nome || user?.impersonatedBy?.email || 'Superadmin'
    : user?.displayName || user?.email || 'Operador'
  const descricaoExibida = user?.impersonationActive
    ? `Simulando ${user?.nome || user?.email || 'usuario'}`
    : user?.rootSuperadmin
      ? 'Superadmin principal'
      : 'Acesso institucional'

  return (
    <header className="sticky top-0 z-20 overflow-hidden rounded-b-[2rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] text-white shadow-[0_16px_36px_rgba(10,45,97,0.26)]">
      <div className="px-4 pb-4 pt-4 sm:px-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
          <div className="flex items-start gap-3 lg:min-w-[8rem]">
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 text-white backdrop-blur transition hover:bg-white/18"
              aria-label="Abrir menu"
            >
              <MenuIcon />
            </button>

            {icon ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 text-white backdrop-blur">
                {icon}
              </div>
            ) : null}
          </div>

          <div />

          <div className="flex shrink-0 items-start justify-end gap-2 lg:min-w-[12rem]">
            <div className="hidden rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur sm:block">
              <p className="text-sm font-semibold text-white">{nomeExibido}</p>
              <p className="text-xs text-blue-100/80">{descricaoExibida}</p>
            </div>

            {onLogout ? (
              <Button variant="ghost" onClick={onLogout} className="min-h-12 self-start rounded-2xl border-white/20 bg-white/10 px-3 text-white hover:bg-white/16">
                <LogoutIcon />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 min-w-0 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-center gap-3">
              <img
                src={SYSTEM_ICON_SRC}
                alt={SYSTEM_NAME}
                className="h-12 w-12 scale-[1.15] rounded-[1.35rem] border border-white/35 bg-white object-cover p-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.16)] sm:h-[3.6rem] sm:w-[3.6rem]"
              />
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-100 sm:text-[1.45rem] sm:tracking-[0.28em]">{SYSTEM_NAME}</p>
            </div>
            <h1 className="text-[1.45rem] font-bold tracking-[-0.04em] sm:text-[1.75rem]">{title}</h1>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur">
              <CompanyBadgeIcon />
              <span>{empresaAtual}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function getEmpresaAtual(user) {
  if (user?.impersonationActive && user?.empresaNome) {
    return user.empresaNome
  }

  if (user?.rootSuperadmin) {
    return SYSTEM_NAME
  }

  if (user?.empresaNome) {
    return user.empresaNome
  }

  const nomeUsuario = String(user?.nome || user?.displayName || '').trim().toLowerCase()

  if (nomeUsuario.includes('leda')) {
    return 'Luz da Aurora III'
  }

  return 'Empresa nao identificada'
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

function CompanyBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 10h.01M9 14h.01M15 10h.01M15 14h.01" />
    </svg>
  )
}
