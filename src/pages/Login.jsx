import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Input from '../components/Input.jsx'
import useAuth from '../context/useAuth.js'

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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-5xl overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-gradient-to-br from-[#1657d8] via-[#0f4da5] to-[#0a2d61] p-8 text-white lg:p-12">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">LUZ DA AURORA III</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight lg:text-5xl">Controle de fretes com foco em operacao de balcao.</h1>
            <p className="mt-5 max-w-xl text-sm text-white/80 lg:text-base">
              Sistema PWA para registrar encomendas, gerar QR Code, emitir etiqueta em PDF e acompanhar o rastreio em terminais hidroviarios do Para.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                'Acesso mobile e desktop',
                'Leitura rapida de codigos',
                'Caixa e movimentacoes',
                'Pronto para Firebase Hosting',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form className="space-y-5 p-8 lg:p-12" onSubmit={handleSubmit}>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Entrar no sistema</h2>
              <p className="mt-2 text-sm text-slate-500">
                Use suas credenciais do Firebase ou os acessos criados pelo superadmin em modo demonstracao.
              </p>
            </div>

            <Input
              label="E-mail"
              type="email"
              placeholder="superadmin@fretes.local"
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

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Ambiente local</p>
              <p className="mt-1">Usuario demo inicial: superadmin@fretes.local com senha 123456.</p>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}
