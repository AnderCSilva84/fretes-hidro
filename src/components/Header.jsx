import Button from './Button.jsx'

export default function Header({ title, subtitle, icon, onMenuClick, onLogout, user }) {
  return (
    <header className="sticky top-0 z-20 overflow-hidden rounded-b-[2.2rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
      <div className="px-4 pb-6 pt-5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
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

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-100">LUZ DA AURORA III</p>
              <h1 className="mt-2 truncate text-[1.75rem] font-bold tracking-[-0.04em] sm:text-[2rem]">{title}</h1>
              {subtitle ? <p className="mt-2 max-w-2xl text-sm text-blue-100/90">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur sm:block">
              <p className="text-sm font-semibold text-white">{user?.displayName || user?.email || 'Operador'}</p>
              <p className="text-xs text-blue-100/80">Acesso institucional</p>
            </div>

            {onLogout ? (
              <Button variant="ghost" onClick={onLogout} className="min-h-12 rounded-2xl border-white/20 bg-white/10 px-3 text-white hover:bg-white/16">
                <LogoutIcon />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
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
