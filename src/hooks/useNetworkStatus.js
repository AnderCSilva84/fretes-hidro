import { useEffect, useState } from 'react'

function getInitialStatus() {
  if (typeof navigator === 'undefined') {
    return true
  }

  return navigator.onLine
}

export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(getInitialStatus)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
