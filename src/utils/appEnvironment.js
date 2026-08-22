const APP_ENVIRONMENT_STORAGE_KEY = 'navia-app-environment'

export const APP_ENVIRONMENTS = {
  DESKTOP: 'desktop',
  TERMINAL: 'terminal',
}

export function readAppEnvironment() {
  if (typeof window === 'undefined') {
    return APP_ENVIRONMENTS.DESKTOP
  }

  return window.localStorage.getItem(APP_ENVIRONMENT_STORAGE_KEY) === APP_ENVIRONMENTS.TERMINAL
    ? APP_ENVIRONMENTS.TERMINAL
    : APP_ENVIRONMENTS.DESKTOP
}

export function writeAppEnvironment(environment) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    APP_ENVIRONMENT_STORAGE_KEY,
    environment === APP_ENVIRONMENTS.TERMINAL ? APP_ENVIRONMENTS.TERMINAL : APP_ENVIRONMENTS.DESKTOP,
  )
}

export function isTerminalEnvironment() {
  return readAppEnvironment() === APP_ENVIRONMENTS.TERMINAL
}
