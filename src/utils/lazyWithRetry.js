import { lazy } from 'react'

const RETRY_PREFIX = 'navia-lazy-retry:'

function isChunkLoadError(error) {
  const message = String(error?.message || error || '').toLowerCase()

  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror')
  )
}

export function lazyWithRetry(importer, retryKey) {
  return lazy(async () => {
    try {
      const module = await importer()
      sessionStorage.removeItem(`${RETRY_PREFIX}${retryKey}`)
      return module
    } catch (error) {
      if (typeof window !== 'undefined' && isChunkLoadError(error)) {
        const storageKey = `${RETRY_PREFIX}${retryKey}`
        const hasRetried = sessionStorage.getItem(storageKey) === '1'

        if (!hasRetried) {
          sessionStorage.setItem(storageKey, '1')
          window.location.reload()
          return new Promise(() => {})
        }
      }

      throw error
    }
  })
}
