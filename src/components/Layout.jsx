import { useEffect, useState } from 'react'
import useAuth from '../context/useAuth.js'
import ConnectivityBanner from './ConnectivityBanner.jsx'
import Header from './Header.jsx'
import ImpersonationBanner from './ImpersonationBanner.jsx'
import Sidebar from './Sidebar.jsx'
import SystemFooter from './SystemFooter.jsx'
import { isTerminalEnvironment } from '../utils/appEnvironment.js'

export default function Layout({ title, subtitle, icon, children, immersive = false, contentClassName = '', containerClassName = '' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout, stopImpersonation } = useAuth()
  const terminalEnvironment = isTerminalEnvironment()

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    if (!menuOpen) {
      document.body.style.overflow = ''
    }

    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  if (immersive) {
    return (
      <div className="min-h-screen bg-transparent">
        <ImpersonationBanner user={user} onStop={stopImpersonation} />
        <main className="min-h-screen">{children}</main>
        <SystemFooter className="px-4 pb-6 pt-4" />
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen ${terminalEnvironment ? 'app-environment-terminal' : ''}`}
      style={{
        background: 'radial-gradient(circle at top, var(--brand-primary-soft), transparent 34%), linear-gradient(180deg, #eef5ff 0%, #dbeafe 100%)',
      }}
    >
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-[#0a2d61]/40 backdrop-blur-[1px]"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className={`relative z-10 mx-auto flex min-h-screen w-full flex-col ${containerClassName || 'max-w-full xl:max-w-[80vw]'}`}>
        <Header
          title={title}
          subtitle={subtitle}
          icon={icon}
          user={user}
          onMenuClick={() => setMenuOpen((value) => !value)}
          onLogout={logout}
        />

        <ImpersonationBanner user={user} onStop={stopImpersonation} />
        <ConnectivityBanner />

        <main className="app-main flex-1 px-4 pb-8 pt-5 sm:px-5">
          <div className={`mx-auto w-full ${contentClassName || 'max-w-none'}`}>{children}</div>
          <SystemFooter className="mx-auto w-full px-2 pb-4 pt-8 xl:max-w-[80vw]" />
        </main>
      </div>
    </div>
  )
}
