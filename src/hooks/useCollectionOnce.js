import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCollectionOnce } from '../services/firebase.js'

export default function useCollectionOnce(collectionName, options = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const optionsKey = JSON.stringify(options)
  const stableOptions = useMemo(() => JSON.parse(optionsKey || '{}'), [optionsKey])

  const reload = useCallback(async () => {
    setLoading(true)

    try {
      const nextItems = await listCollectionOnce(collectionName, stableOptions)
      setItems(nextItems)
    } finally {
      setLoading(false)
    }
  }, [collectionName, stableOptions])

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoading(true)

      try {
        const nextItems = await listCollectionOnce(collectionName, stableOptions)
        if (active) {
          setItems(nextItems)
        }
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

  return { items, loading, reload, setItems }
}
