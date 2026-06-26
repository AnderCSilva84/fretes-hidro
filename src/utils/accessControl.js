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

export function getDefaultHomeRoute(user) {
  if (hasFreteAccess(user)) {
    return '/dashboard'
  }

  if (hasPassagemAccess(user)) {
    return '/nova-passagem'
  }

  return '/login'
}
