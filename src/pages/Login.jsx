import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Input from '../components/Input.jsx'
import useAuth from '../context/useAuth.js'
import { ROOT_SUPERADMIN_EMAIL, SYSTEM_NAME } from '../utils/systemConfig.js'

export default function Login() {
  const { login, ready, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ready && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, ready, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (submitError) {
      setError(submitError.message || 'Nao foi possivel entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-10">
      <Card className="w-full max-w-md p-8 lg:p-10">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#1657d8]">{SYSTEM_NAME}</p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Entrar no sistema</h2>
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Acessar painel'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
