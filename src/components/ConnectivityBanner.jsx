import { useEffect, useState } from 'react'
import { getOfflineCapabilities, getOfflineSyncSummary, subscribeOfflineSync, syncOfflineActions } from '../services/firebase.js'
import Button from './Button.jsx'
import useNetworkStatus from '../hooks/useNetworkStatus.js'

export default function ConnectivityBanner() {
  const isOnline = useNetworkStatus()
  const capabilities = getOfflineCapabilities()
  const [summary, setSummary] = useState(() => getOfflineSyncSummary())
  const [syncing, setSyncing] = useState(false)

  useEffect(() => subscribeOfflineSync(setSummary), [])

  useEffect(() => {
    if (!isOnline || !capabilities.supportsQueuedWrites || summary.pending === 0 || syncing) {
      return
    }

    let active = true

    async function processarFila() {
      setSyncing(true)

      try {
        await syncOfflineActions()
      } finally {
        if (active) {
          setSyncing(false)
        }
      }
    }

    void processarFila()

    return () => {
      active = false
    }
  }, [capabilities.supportsQueuedWrites, isOnline, summary.pending, syncing])

  if (isOnline && !capabilities.usesLocalStore && summary.total === 0) {
    return null
  }

  const visual = getBannerVisual({ isOnline, capabilities, summary, syncing })

  return (
    <div className={`mx-auto mt-4 flex w-full items-start gap-3 rounded-[1.4rem] border px-4 py-3 text-sm shadow-sm xl:max-w-[80vw] ${visual.className}`}>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70">
        {isOnline ? <SyncIcon /> : <OfflineIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{visual.title}</p>
        <p className="mt-1 text-[0.92rem] opacity-90">{visual.message}</p>
        {summary.total > 0 ? (
          <p className="mt-1 text-xs font-semibold opacity-90">
            Fila offline: {summary.pending} pendente(s), {summary.conflicts} conflito(s), {summary.errors} erro(s).
          </p>
        ) : null}
      </div>
      {isOnline && capabilities.supportsQueuedWrites && summary.total > 0 ? (
        <Button type="button" variant="ghost" onClick={() => void syncOfflineActions()} disabled={syncing} className="min-h-10 shrink-0 border-white/20 bg-white/25 px-3 py-2 text-xs text-current hover:bg-white/40">
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      ) : null}
    </div>
  )
}

function getBannerVisual({ isOnline, capabilities, summary, syncing }) {
  if (capabilities.usesLocalStore) {
    return {
      className: 'border-sky-200 bg-sky-50 text-sky-900',
      title: 'Modo local ativo',
      message: 'Este aparelho consegue continuar operando com os dados salvos localmente.',
    }
  }

  if (!isOnline && capabilities.supportsQueuedWrites) {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      title: 'Sem internet, mas com operacao offline',
      message: 'Os dados em cache continuam acessiveis e a fila offline vai aguardar a sincronizacao com validacao de conflito.',
    }
  }

  if (summary.conflicts > 0) {
    return {
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      title: 'Sincronizacao exige revisao',
      message: 'Algumas acoes offline bateram em conflito de capacidade ou confirmacao. Revise os registros antes de seguir.',
    }
  }

  if (syncing || summary.pending > 0 || summary.errors > 0) {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      title: syncing ? 'Sincronizando fila offline' : 'Conexao restaurada',
      message: syncing
        ? 'As acoes offline estao sendo conferidas e reconciliadas com a base principal.'
        : 'A fila offline ficou disponivel para sincronizacao manual ou automatica.',
    }
  }

  if (!isOnline) {
    return {
      className: 'border-rose-200 bg-rose-50 text-rose-900',
      title: 'Sem internet',
      message: 'Algumas acoes podem falhar ate a conexao voltar porque este navegador nao habilitou sincronizacao local completa.',
    }
  }

  return {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    title: 'Conexao restaurada',
    message: 'A sincronizacao foi retomada e o app voltou ao modo online.',
  }
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.5 6.4" />
      <path d="M3 12A9 9 0 0 1 18.5 5.6" />
      <path d="M8 17H5v3" />
      <path d="M16 7h3V4" />
    </svg>
  )
}

function OfflineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5 12.5a10 10 0 0 1 4.2-2.8" />
      <path d="M14.8 9.7A10 10 0 0 1 19 12.5" />
      <path d="M12 20h.01" />
    </svg>
  )
}
