const STORAGE_KEY = 'fretes-pwa-runtime-errors'
const MAX_ENTRIES = 30

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || '',
    }
  }

  return {
    name: 'UnknownError',
    message: String(error || 'Erro desconhecido'),
    stack: '',
  }
}

export function reportRuntimeError(context, error, extra = {}) {
  const payload = {
    context,
    ...serializeError(error),
    extra,
    createdAt: new Date().toISOString(),
  }

  console.error(`[runtime:${context}]`, payload)

  if (typeof window === 'undefined') {
    return payload
  }

  try {
    const current = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]')
    const next = [payload, ...current].slice(0, MAX_ENTRIES)
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Best-effort logging only.
  }

  return payload
}

export function getStoredRuntimeErrors() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}
