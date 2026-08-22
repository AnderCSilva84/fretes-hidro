import { Navigate, Outlet } from 'react-router-dom'
import AppSplashScreen from './AppSplashScreen.jsx'
import useAuth from '../context/useAuth.js'
import { canAccessManagement, canUseEnvironment, getDefaultHomeRoute, hasModuleAccess } from '../utils/accessControl.js'
import { APP_ENVIRONMENTS, readAppEnvironment } from '../utils/appEnvironment.js'

export default function ProtectedRoute({ requiredPerfil = null, requiredModule = null, requiredEnvironment = null, requiredManagement = false, allowTerminalSuperadmin = false }) {
  const { ready, user } = useAuth()
  const environment = readAppEnvironment()

  if (!ready) {
    return <AppSplashScreen message="Carregando acesso..." />
  }

  if (!user) {
    return <Navigate to={environment === APP_ENVIRONMENTS.TERMINAL ? '/terminal' : '/login'} replace />
  }

  if (!canUseEnvironment(user, environment)) {
    return <Navigate to="/terminal" replace state={{ environmentError: 'O perfil gestor deve acessar pelo computador.' }} />
  }

  const terminalSuperadminException = allowTerminalSuperadmin
    && environment === APP_ENVIRONMENTS.TERMINAL
    && (user?.rootSuperadmin || user?.perfil === 'superadmin')

  if (requiredEnvironment && environment !== requiredEnvironment && !terminalSuperadminException) {
    return <Navigate to={getDefaultHomeRoute(user, environment)} replace />
  }

  if (requiredManagement && !canAccessManagement(user)) {
    return <Navigate to={getDefaultHomeRoute(user, environment)} replace />
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
