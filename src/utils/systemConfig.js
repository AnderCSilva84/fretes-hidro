export const SYSTEM_NAME = 'NAVIA'
export const SYSTEM_ICON_SRC = '/pwa-192.png?v=navia-20260628b'
export const SYSTEM_SPLASH_SRC = '/telaInicial.jpeg'
export const ROOT_SUPERADMIN_EMAIL = 'adm@acs.com'
export const DEFAULT_EMPRESA = {
  id: 'empresa-fretes-hidro',
  nome: 'Fretes Hidro',
  cnpj: '',
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isRootSuperadminEmail(email) {
  return normalizeEmail(email) === ROOT_SUPERADMIN_EMAIL
}

export function isRootSuperadminUser(user) {
  return isRootSuperadminEmail(user?.email)
}
