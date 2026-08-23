import { StrictMode } from 'react'
import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { BrandingProvider } from './context/BrandingContext.jsx'
import { APP_ENVIRONMENTS, writeAppEnvironment } from './utils/appEnvironment.js'

const nativeTerminal = Capacitor.isNativePlatform()

if (nativeTerminal) {
  writeAppEnvironment(APP_ENVIRONMENTS.TERMINAL)
}

if (window.location.hash.startsWith('#/')) {
  const destino = window.location.hash.slice(1)
  window.history.replaceState(null, '', destino || '/')
}

let aplicarAtualizacao = () => Promise.resolve()
let recarregandoPorAtualizacao = false

if (!nativeTerminal) aplicarAtualizacao = registerSW({
  immediate: true,
  onNeedRefresh() {
    void aplicarAtualizacao(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    void registration.update()
    window.setInterval(() => {
      if (navigator.onLine) void registration.update()
    }, 60 * 1000)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void registration.update()
    })
  },
})

if (!nativeTerminal) navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (recarregandoPorAtualizacao) return
  recarregandoPorAtualizacao = true
  window.location.reload()
})

const bootSplash = document.getElementById('boot-splash')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BrandingProvider>
          <App />
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

if (bootSplash) {
  window.requestAnimationFrame(() => {
    bootSplash.classList.add('boot-splash-hidden')
    window.setTimeout(() => {
      bootSplash.remove()
    }, 420)
  })
}
