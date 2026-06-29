import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

if (window.location.hash.startsWith('#/')) {
  const destino = window.location.hash.slice(1)
  window.history.replaceState(null, '', destino || '/')
}

registerSW({
  immediate: true,
})

const bootSplash = document.getElementById('boot-splash')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
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
