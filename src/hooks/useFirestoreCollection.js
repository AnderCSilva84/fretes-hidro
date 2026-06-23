import { useEffect, useState } from 'react'
import { subscribeCollection } from '../services/firebase.js'

export default function useFirestoreCollection(collectionName) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeCollection(collectionName, (nextItems) => {
      setItems(nextItems)
      setLoading(false)
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [collectionName])

  return { items, loading, setItems }
}
