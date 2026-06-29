const queueStorageKey = 'fretes-pwa-offline-queue'
const queueEventName = 'fretes-pwa-offline-queue-change'

function readQueue() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(queueStorageKey) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function notifyQueue(queue) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(queueEventName, {
    detail: {
      queue,
      summary: getOfflineQueueSummary(queue),
    },
  }))
}

function writeQueue(queue) {
  if (typeof window === 'undefined') {
    return queue
  }

  window.localStorage.setItem(queueStorageKey, JSON.stringify(queue))
  notifyQueue(queue)
  return queue
}

export function enqueueOfflineAction(action) {
  const queue = readQueue()
  const nextQueue = [
    ...queue,
    {
      id: action.id || `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: action.type || 'acao_offline',
      createdAt: action.createdAt || new Date().toISOString(),
      status: action.status || 'pending',
      conflictMessage: action.conflictMessage || '',
      details: action.details || '',
      payload: action.payload || {},
    },
  ]

  writeQueue(nextQueue)
  return nextQueue.at(-1)
}

export function updateOfflineAction(actionId, updates = {}) {
  const queue = readQueue()
  const nextQueue = queue.map((item) => (
    item.id === actionId
      ? {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      : item
  ))

  writeQueue(nextQueue)
  return nextQueue.find((item) => item.id === actionId) || null
}

export function pruneOfflineQueue() {
  const queue = readQueue()
  const nextQueue = queue
    .filter((item) => item.status !== 'synced')
    .slice(-200)

  writeQueue(nextQueue)
  return nextQueue
}

export function listOfflineQueue() {
  return readQueue()
}

export function getOfflineQueueSummary(queue = readQueue()) {
  return queue.reduce((summary, item) => {
    summary.total += 1

    if (item.status === 'pending' || item.status === 'syncing') {
      summary.pending += 1
    }

    if (item.status === 'conflict') {
      summary.conflicts += 1
    }

    if (item.status === 'error') {
      summary.errors += 1
    }

    return summary
  }, {
    total: 0,
    pending: 0,
    conflicts: 0,
    errors: 0,
  })
}

export function subscribeOfflineQueue(callback) {
  if (typeof window === 'undefined') {
    callback(getOfflineQueueSummary([]))
    return () => {}
  }

  const emitCurrent = () => {
    callback(getOfflineQueueSummary(readQueue()))
  }

  const handleChange = () => {
    emitCurrent()
  }

  emitCurrent()
  window.addEventListener(queueEventName, handleChange)
  window.addEventListener('storage', handleChange)

  return () => {
    window.removeEventListener(queueEventName, handleChange)
    window.removeEventListener('storage', handleChange)
  }
}
