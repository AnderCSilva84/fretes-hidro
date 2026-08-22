export function normalizeModuleAccess(source) {
  const acessoFretes = source?.acessoFretes
  const acessoPassagens = source?.acessoPassagens
  const rootSuperadmin = Boolean(source?.rootSuperadmin)

  if (rootSuperadmin) {
    return {
      acessoFretes: true,
      acessoPassagens: true,
    }
  }

  if (typeof acessoFretes === 'boolean' || typeof acessoPassagens === 'boolean') {
    return {
      acessoFretes: acessoFretes !== false,
      acessoPassagens: acessoPassagens !== false,
    }
  }

  return {
    acessoFretes: true,
    acessoPassagens: true,
  }
}

export function enrichUserModuleAccess(source) {
  const normalized = normalizeModuleAccess(source)
  return {
    ...source,
    ...normalized,
  }
}

export function hasFreteAccess(user) {
  return normalizeModuleAccess(user).acessoFretes
}

export function hasPassagemAccess(user) {
  return normalizeModuleAccess(user).acessoPassagens
}

export function hasModuleAccess(user, moduleName) {
  if (moduleName === 'fretes') {
    return hasFreteAccess(user)
  }

  if (moduleName === 'passagens') {
    return hasPassagemAccess(user)
  }

  return false
}

export function getDefaultHomeRoute(user, environment = readAppEnvironment()) {
  if (environment === APP_ENVIRONMENTS.TERMINAL) {
    if (hasPassagemAccess(user)) {
      return '/nova-passagem'
    }

    if (hasFreteAccess(user)) {
      return '/nova-comanda'
    }

    return '/terminal'
  }

  if (canAccessManagement(user)) {
    return '/dashboard'
  }

  if (hasFreteAccess(user)) {
    return '/nova-comanda'
  }

  if (hasPassagemAccess(user)) {
    return '/nova-passagem'
  }

  return '/login'
}
import { APP_ENVIRONMENTS, readAppEnvironment } from './appEnvironment.js'

export function isGestor(user) {
  return ['gestor', 'admin'].includes(String(user?.perfil || '').toLowerCase())
}

export function canAccessManagement(user) {
  return Boolean(user?.rootSuperadmin || user?.perfil === 'superadmin' || isGestor(user))
}

export function canUseEnvironment(user, environment = readAppEnvironment()) {
  if (environment === APP_ENVIRONMENTS.TERMINAL) {
    return String(user?.perfil || '').toLowerCase() === 'operador' && !user?.rootSuperadmin
  }

  return true
}
