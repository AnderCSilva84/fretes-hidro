import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Input from '../components/Input.jsx'
import SystemFooter from '../components/SystemFooter.jsx'
import useAuth from '../context/useAuth.js'
import { ROOT_SUPERADMIN_EMAIL, SYSTEM_ICON_SRC, SYSTEM_NAME } from '../utils/systemConfig.js'
import { canUseEnvironment, getDefaultHomeRoute } from '../utils/accessControl.js'
import { APP_ENVIRONMENTS, readAppEnvironment, writeAppEnvironment } from '../utils/appEnvironment.js'

export default function Login({ environment = null }) {
  const { login, logout, ready, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (environment) {
      writeAppEnvironment(environment)
    }
  }, [environment])

  useEffect(() => {
    if (ready && user) {
      const currentEnvironment = environment || readAppEnvironment()
      if (canUseEnvironment(user, currentEnvironment)) {
        navigate(getDefaultHomeRoute(user, currentEnvironment), { replace: true })
      } else {
        void logout()
      }
    }
  }, [environment, logout, navigate, ready, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const loggedUser = await login(form.email, form.password)
      const currentEnvironment = environment || readAppEnvironment()

      if (!canUseEnvironment(loggedUser, currentEnvironment)) {
        await logout()
        throw new Error('O perfil gestor deve acessar pelo computador.')
      }

      navigate(getDefaultHomeRoute(loggedUser, currentEnvironment))
    } catch (submitError) {
      setError(submitError.message || 'Nao foi possivel entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.2),transparent_30%),linear-gradient(180deg,#eef5ff_0%,#dbeafe_100%)] px-4 py-10">
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md p-8 lg:p-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <div className="flex items-center gap-3">
                <img
                  src={SYSTEM_ICON_SRC}
                  alt={SYSTEM_NAME}
                  className="h-11 w-11 scale-[1.15] rounded-2xl border border-[#d5e5ff] bg-white object-cover p-1 shadow-[0_18px_38px_rgba(22,87,216,0.14)]"
                />
                <p className="text-xs uppercase tracking-[0.35em] text-[#1657d8]">{SYSTEM_NAME}</p>
              </div>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">
                {environment === APP_ENVIRONMENTS.TERMINAL ? 'Entrar na maquineta' : 'Entrar no sistema'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Use suas credenciais do Firebase ou os acessos criados pelo superadmin em modo demonstracao.
              </p>
              <p className="mt-2 text-xs text-slate-400">Superadmin principal: {ROOT_SUPERADMIN_EMAIL}</p>
            </div>

            <Input
              label="E-mail"
              type="email"
              placeholder="adm@adm.com"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />

            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {!error && location.state?.environmentError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{location.state.environmentError}</p> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Acessar painel'}
            </Button>
          </form>
        </Card>
      </div>
      <SystemFooter className="pt-6" />
    </div>
  )
}
