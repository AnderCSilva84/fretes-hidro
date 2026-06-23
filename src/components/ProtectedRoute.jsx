import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../context/useAuth.js'

export default function ProtectedRoute({ requiredPerfil = null }) {
  const { ready, user } = useAuth()

  if (!ready) {
    return null
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
