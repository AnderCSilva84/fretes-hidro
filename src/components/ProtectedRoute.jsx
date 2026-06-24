import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../context/useAuth.js'

export default function ProtectedRoute({ requiredPerfil = null }) {
  const { ready, user } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-sm font-medium text-slate-500">
        Carregando acesso...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredPerfil) {
    const allowedProfiles = Array.isArray(requiredPerfil) ? requiredPerfil : [requiredPerfil]
    if (!allowedProfiles.includes(user.perfil)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <Outlet />
}
