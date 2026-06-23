import { useMemo, useState } from 'react'
import { ShieldIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useFirestoreCollection from '../hooks/useFirestoreCollection.js'

const initialForm = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'operador',
  ativo: true,
}

export default function Usuarios() {
  const { createUser } = useAuth()
  const { items } = useFirestoreCollection('usuarios')
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const usuarios = useMemo(
    () =>
      [...items].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''))),
    [items],
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await createUser(form)
      setForm(initialForm)
      setSuccess('Login criado com sucesso.')
    } catch (submitError) {
      setError(submitError.message || 'Nao foi possivel criar o usuario.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout
      title="Usuarios"
      subtitle="Cadastro de acessos disponivel apenas para superadmin."
      icon={<ShieldIcon className="h-6 w-6" />}
    >
      <div className="space-y-6">
        <PageShell
          title="Criar login"
          subtitle="Cadastre nome, e-mail, senha inicial e perfil do novo usuario."
          icon={<ShieldIcon className="h-6 w-6" />}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              label="Nome"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              placeholder="Nome completo"
              required
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="usuario@empresa.com"
              required
            />
            <Input
              label="Senha inicial"
              type="password"
              value={form.senha}
              onChange={(event) => setForm({ ...form, senha: event.target.value })}
              placeholder="Minimo de 6 caracteres"
              required
            />

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Perfil</span>
              <select
                className="min-h-12 rounded-2xl border border-blue-200 bg-white px-4 text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                value={form.perfil}
                onChange={(event) => setForm({ ...form, perfil: event.target.value })}
              >
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </label>

            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
              />
              Usuario ativo e liberado para login
            </label>

            {error ? <p className="md:col-span-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="md:col-span-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Criando login...' : 'Criar login'}
              </Button>
            </div>
          </form>
        </PageShell>

        <PageShell
          title="Acessos cadastrados"
          subtitle="Lista de usuarios com perfil e status de acesso."
          icon={<ShieldIcon className="h-6 w-6" />}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {usuarios.map((usuario) => (
              <Card key={usuario.id} className="border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{usuario.nome || 'Sem nome'}</p>
                    <p className="mt-1 text-sm text-slate-500">{usuario.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                      usuario.ativo === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {usuario.ativo === false ? 'Inativo' : 'Ativo'}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-slate-700">
                  Perfil: <span className="font-semibold uppercase">{usuario.perfil || 'operador'}</span>
                </div>
              </Card>
            ))}

            {usuarios.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                Nenhum usuario cadastrado ainda.
              </div>
            ) : null}
          </div>
        </PageShell>
      </div>
    </Layout>
  )
}
