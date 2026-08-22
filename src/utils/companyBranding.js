import { SYSTEM_ICON_SRC } from './systemConfig.js'

export const DEFAULT_COMPANY_BRANDING = {
  corPrimaria: '#0f4da5',
  corSecundaria: '#072d67',
  corDestaque: '#2f9e44',
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Number(value) || 0))
}

export function normalizeHexColor(value, fallback = DEFAULT_COMPANY_BRANDING.corPrimaria) {
  const raw = String(value || '').trim()

  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase()
  }

  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.slice(1).split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  return fallback
}

export function hexToRgbString(value, alpha = 1) {
  const normalized = normalizeHexColor(value)
  const sanitizedAlpha = Math.max(0, Math.min(1, Number(alpha)))
  const channels = normalized
    .slice(1)
    .match(/.{1,2}/g)
    ?.map((item) => clampChannel(Number.parseInt(item, 16))) || [15, 77, 165]

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${sanitizedAlpha})`
}

export function resolveCompanyBranding(company = null) {
  return {
    corPrimaria: normalizeHexColor(company?.corPrimaria, DEFAULT_COMPANY_BRANDING.corPrimaria),
    corSecundaria: normalizeHexColor(company?.corSecundaria, DEFAULT_COMPANY_BRANDING.corSecundaria),
    corDestaque: normalizeHexColor(company?.corDestaque, DEFAULT_COMPANY_BRANDING.corDestaque),
    logoUrl: String(company?.logoUrl || company?.logoDataUrl || SYSTEM_ICON_SRC).trim() || SYSTEM_ICON_SRC,
  }
}

export function applyCompanyBrandingToDocument(branding = DEFAULT_COMPANY_BRANDING) {
  if (typeof document === 'undefined') {
    return
  }

  const rootStyle = document.documentElement.style
  const resolved = resolveCompanyBranding(branding)

  rootStyle.setProperty('--brand-primary', resolved.corPrimaria)
  rootStyle.setProperty('--brand-secondary', resolved.corSecundaria)
  rootStyle.setProperty('--brand-accent', resolved.corDestaque)
  rootStyle.setProperty('--brand-primary-soft', hexToRgbString(resolved.corPrimaria, 0.16))
  rootStyle.setProperty('--brand-primary-fade', hexToRgbString(resolved.corPrimaria, 0.08))
  rootStyle.setProperty('--brand-secondary-soft', hexToRgbString(resolved.corSecundaria, 0.18))
  rootStyle.setProperty('--brand-accent-soft', hexToRgbString(resolved.corDestaque, 0.18))
}
