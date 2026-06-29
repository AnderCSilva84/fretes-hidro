import { Navigate, Outlet } from 'react-router-dom'
import AppSplashScreen from './AppSplashScreen.jsx'
import useAuth from '../context/useAuth.js'
import { getDefaultHomeRoute, hasModuleAccess } from '../utils/accessControl.js'

export default function ProtectedRoute({ requiredPerfil = null, requiredModule = null }) {
  const { ready, user } = useAuth()

  if (!ready) {
    return <AppSplashScreen message="Carregando acesso..." />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredPerfil) {
    const allowedProfiles = Array.isArray(requiredPerfil) ? requiredPerfil : [requiredPerfil]
    if (!allowedProfiles.includes(user.perfil)) {
      return <Navigate to={getDefaultHomeRoute(user)} replace />
    }
  }

  if (requiredModule) {
    const requiredModules = Array.isArray(requiredModule) ? requiredModule : [requiredModule]
    const allowed = requiredModules.some((moduleName) => hasModuleAccess(user, moduleName))

    if (!allowed) {
      return <Navigate to={getDefaultHomeRoute(user)} replace />
    }
  }

  return <Outlet />
}
