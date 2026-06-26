import { createContext, useEffect, useMemo, useState } from 'react'
import { criarUsuario, entrar, onAuthChange, sair } from '../services/firebase.js'
import { enrichUserModuleAccess } from '../utils/accessControl.js'
import { normalizeEmail } from '../utils/systemConfig.js'

const AuthContext = createContext(null)
const IMPERSONATION_STORAGE_KEY = 'acs-auth-impersonation'

function readStoredImpersonation() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY)
    return rawValue ? JSON.parse(rawValue) : null
  } catch {
    return null
  }
}

function writeStoredImpersonation(value) {
  if (typeof window === 'undefined') {
    return
  }

  if (!value) {
    window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(value))
}

function buildImpersonatedUser(sessionUser, targetUser) {
  if (!sessionUser || !targetUser) {
    return sessionUser
  }

  const normalizedTarget = enrichUserModuleAccess(targetUser)
  const targetEmail = normalizeEmail(normalizedTarget.email)
  const targetName = normalizedTarget.nome || normalizedTarget.displayName || targetEmail || 'Usuario'

  return {
    ...normalizedTarget,
    uid: normalizedTarget.uid || normalizedTarget.id || targetEmail,
    id: normalizedTarget.id || normalizedTarget.uid || targetEmail,
    email: targetEmail,
    displayName: normalizedTarget.displayName || normalizedTarget.nome || targetEmail,
    nome: targetName,
    ativo: normalizedTarget.ativo !== false,
    impersonationActive: true,
    impersonatedBy: {
      uid: sessionUser.uid || '',
      email: sessionUser.email || '',
      nome: sessionUser.nome || sessionUser.displayName || sessionUser.email || 'Superadmin',
    },
    impersonationTarget: {
      id: normalizedTarget.id || normalizedTarget.uid || targetEmail,
      email: targetEmail,
      nome: targetName,
      perfil: normalizedTarget.perfil || 'operador',
      empresaNome: normalizedTarget.empresaNome || '',
      ativo: normalizedTarget.ativo !== false,
    },
  }
}

export function AuthProvider({ children }) {
  const [sessionUser, setSessionUser] = useState(null)
  const [impersonationTarget, setImpersonationTarget] = useState(() => readStoredImpersonation())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthChange((nextUser) => {
      setSessionUser(nextUser)

      if (!nextUser?.rootSuperadmin) {
        setImpersonationTarget(null)
        writeStoredImpersonation(null)
      }

      setReady(true)
    })

    return unsubscribe
  }, [])

  const user = useMemo(() => {
    if (!sessionUser) {
      return null
    }

    if (!sessionUser.rootSuperadmin || !impersonationTarget) {
      return sessionUser
    }

    return buildImpersonatedUser(sessionUser, impersonationTarget)
  }, [impersonationTarget, sessionUser])

  const value = useMemo(
    () => ({
      user,
      sessionUser,
      ready,
      login: entrar,
      logout: async () => {
        setImpersonationTarget(null)
        writeStoredImpersonation(null)
        await sair()
      },
      createUser: criarUsuario,
      isImpersonating: Boolean(sessionUser?.rootSuperadmin && impersonationTarget),
      impersonationTarget,
      startImpersonation: (targetUser) => {
        if (!sessionUser?.rootSuperadmin || !targetUser) {
          return
        }

        const normalizedEmail = normalizeEmail(targetUser.email)
        if (!normalizedEmail || normalizedEmail === normalizeEmail(sessionUser.email)) {
          setImpersonationTarget(null)
          writeStoredImpersonation(null)
          return
        }

        const payload = {
          ...targetUser,
          id: targetUser.id || targetUser.uid || normalizedEmail,
          uid: targetUser.uid || targetUser.id || normalizedEmail,
          email: normalizedEmail,
        }

        setImpersonationTarget(payload)
        writeStoredImpersonation(payload)
      },
      stopImpersonation: () => {
        setImpersonationTarget(null)
        writeStoredImpersonation(null)
      },
    }),
    [impersonationTarget, ready, sessionUser, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
