import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes.jsx'
import { reportRuntimeError } from './utils/runtimeDiagnostics.js'

function RuntimeDiagnostics() {
  const location = useLocation()

  useEffect(() => {
    function handleError(event) {
      reportRuntimeError('window.error', event.error || new Error(event.message || 'Erro global'), {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
      })
    }

    function handleUnhandledRejection(event) {
      reportRuntimeError('window.unhandledrejection', event.reason || new Error('Promise rejeitada sem tratamento'), {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [location.hash, location.pathname, location.search])

  return null
}

function App() {
  return (
    <>
      <RuntimeDiagnostics />
      <AppRoutes />
    </>
  )
}

export default App
