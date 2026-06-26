import { useEffect, useState } from 'react'
import useAuth from '../context/useAuth.js'
import BottomNav from './BottomNav.jsx'
import Header from './Header.jsx'
import ImpersonationBanner from './ImpersonationBanner.jsx'
import Sidebar from './Sidebar.jsx'
import SystemFooter from './SystemFooter.jsx'

export default function Layout({ title, subtitle, icon, children, immersive = false, contentClassName = '', containerClassName = '' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout, stopImpersonation } = useAuth()

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction

    if (menuOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.24),transparent_34%),linear-gradient(180deg,#eef5ff_0%,#dbeafe_100%)]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-[#0a2d61]/40 backdrop-blur-[1px]"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className={`relative z-10 mx-auto flex min-h-screen w-full flex-col ${containerClassName || 'max-w-[1180px]'}`}>
        <Header
          title={title}
          subtitle={subtitle}
          icon={icon}
          user={user}
          onMenuClick={() => setMenuOpen((value) => !value)}
          onLogout={logout}
        />

        <ImpersonationBanner user={user} onStop={stopImpersonation} />

        <main className="flex-1 px-4 pb-32 pt-5 sm:px-5">
          <div className={`mx-auto w-full ${contentClassName || 'max-w-[1040px]'}`}>{children}</div>
          <SystemFooter className="mx-auto max-w-[1040px] px-2 pb-4 pt-8" />
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
