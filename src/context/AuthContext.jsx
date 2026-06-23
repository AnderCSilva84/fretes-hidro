import { createContext, useEffect, useMemo, useState } from 'react'
import { criarUsuario, entrar, onAuthChange, sair } from '../services/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthChange((nextUser) => {
      setUser(nextUser)
      setReady(true)
    })

    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      login: entrar,
      logout: sair,
      createUser: criarUsuario,
    }),
    [ready, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
