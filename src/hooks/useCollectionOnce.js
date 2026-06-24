import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCollectionOnce } from '../services/firebase.js'
import { reportRuntimeError } from '../utils/runtimeDiagnostics.js'

export default function useCollectionOnce(collectionName, options = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const optionsKey = JSON.stringify(options)
  const stableOptions = useMemo(() => JSON.parse(optionsKey || '{}'), [optionsKey])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const nextItems = await listCollectionOnce(collectionName, stableOptions)
      setItems(nextItems)
    } catch (runtimeError) {
      setItems([])
      setError(runtimeError)
      reportRuntimeError('useCollectionOnce.reload', runtimeError, {
        collectionName,
        options: stableOptions,
      })
    } finally {
      setLoading(false)
    }
  }, [collectionName, stableOptions])

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        const nextItems = await listCollectionOnce(collectionName, stableOptions)
        if (active) {
          setItems(nextItems)
        }
      } catch (runtimeError) {
        if (active) {
          setItems([])
          setError(runtimeError)
        }
        reportRuntimeError('useCollectionOnce.effect', runtimeError, {
          collectionName,
          options: stableOptions,
        })
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    carregar()

    return () => {
      active = false
    }
  }, [collectionName, stableOptions])

  return { items, loading, error, reload, setItems }
}
