import { useEffect, useState } from 'react'
import { ShieldIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { atualizarUsuario, listCollectionPage, searchCollectionByField } from '../services/firebase.js'
import { isRootSuperadminUser } from '../utils/systemConfig.js'

const initialForm = {
  nome: '',
  email: '',
  senha: '',
  perfil: 'operador',
  ativo: true,
  empresaId: '',
  empresaNome: '',
}

const PAGE_SIZE = 12

export default function Usuarios() {
  const { createUser, user } = useAuth()
  const { items: empresas } = useCollectionOnce('empresas')
  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoadingList(true)

      try {
        const result = await listCollectionPage('usuarios', {
          orderField: 'nome',
          orderDirection: 'asc',
          maxResults: PAGE_SIZE,
        })

        if (!active) {
          return
        }

        setItems(result.items)
        setCursor(result.cursor)
        setHasMore(result.hasMore)
        setSearchActive(false)
      } finally {
        if (active) {
          setLoadingList(false)
        }
      }
    }

    void carregar()

    return () => {
      active = false
    }
  }, [])

  async function carregarListaInicial() {
    setLoadingList(true)

    try {
      const result = await listCollectionPage('usuarios', {
        orderField: 'nome',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
      })

      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } finally {
      setLoadingList(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (editingId) {
        await atualizarUsuario(editingId, form, user)
      } else {
        await createUser({ ...form, actorUser: user })
      }
      await carregarListaInicial()
      setForm(initialForm)
      setEditingId('')
      setSuccess(editingId ? 'Usuario atualizado com sucesso.' : 'Login criado com sucesso.')
    } catch (submitError) {
      setError(submitError.message || 'Nao foi possivel criar o usuario.')
    } finally {
      setBusy(false)
    }
  }

  function iniciarEdicao(usuario) {
    setEditingId(usuario.id)
    setError('')
    setSuccess('')
    setForm({
      nome: usuario.nome || '',
      email: usuario.email || '',
      senha: '',
      perfil: usuario.perfil || 'operador',
      ativo: usuario.ativo !== false,
      empresaId: usuario.empresaId || '',
      empresaNome: usuario.empresaNome || '',
    })
  }

  function cancelarEdicao() {
    setEditingId('')
    setError('')
    setSuccess('')
    setForm(initialForm)
  }

  async function handleSearch(event, forcedTerm = null) {
    if (event) {
      event.preventDefault()
    }

    const term = String(forcedTerm ?? searchTerm).trim()

    if (!term) {
      await carregarListaInicial()
      return
    }

    if (term.length < 2) {
      return
    }

    setLoadingList(true)

    try {
      const result = await searchCollectionByField('usuarios', 'nome', term, 24)
      setItems(result)
      setCursor(null)
      setHasMore(false)
      setSearchActive(true)
    } finally {
      setLoadingList(false)
    }
  }

  async function limparBusca() {
    setSearchTerm('')
    await carregarListaInicial()
  }

  async function carregarMais() {
    if (!hasMore || searchActive) {
      return
    }

    setLoadingList(true)

    try {
      const result = await listCollectionPage('usuarios', {
        orderField: 'nome',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        cursor,
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingList(false)
    }
  }

  const isRoot = isRootSuperadminUser(user)
  const opcoesPerfil = isRoot
    ? [
        { value: 'operador', label: 'Operador' },
        { value: 'admin', label: 'Admin' },
      ]
    : [{ value: 'operador', label: 'Operador' }]

  return (
    <Layout
      title="Usuarios"
      subtitle="Cadastro de acessos disponivel apenas para superadmin."
      icon={<ShieldIcon className="h-6 w-6" />}
    >
      <div className="space-y-6">
        <PageShell
          title="Criar login"
          subtitle={editingId ? 'Edite nome, perfil, empresa e status do usuario selecionado.' : 'Cadastre nome, e-mail, senha inicial e perfil do novo usuario.'}
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
              disabled={Boolean(editingId)}
            />
            <Input
              label="Senha inicial"
              type="password"
              value={form.senha}
              onChange={(event) => setForm({ ...form, senha: event.target.value })}
              placeholder="Minimo de 6 caracteres"
              required={!editingId}
              disabled={Boolean(editingId)}
            />

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Perfil</span>
              <select
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                value={form.perfil}
                onChange={(event) => setForm({ ...form, perfil: event.target.value })}
              >
                {opcoesPerfil.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Empresa</span>
              <select
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                value={form.empresaId}
                onChange={(event) => {
                  const empresaSelecionada = empresas.find((item) => item.id === event.target.value)
                  setForm({
                    ...form,
                    empresaId: event.target.value,
                    empresaNome: empresaSelecionada?.nome || '',
                  })
                }}
                disabled={form.perfil !== 'operador'}
              >
                <option value="">Sem empresa</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </option>
                ))}
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
            {!isRoot ? (
              <p className="md:col-span-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Apenas o superadmin principal pode criar usuarios admin.
              </p>
            ) : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? (editingId ? 'Salvando...' : 'Criando login...') : editingId ? 'Salvar alteracoes' : 'Criar login'}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={cancelarEdicao} disabled={busy}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>
        </PageShell>

        <PageShell
          title="Acessos cadastrados"
          subtitle="Lista de usuarios com perfil e status de acesso."
          icon={<ShieldIcon className="h-6 w-6" />}
        >
          <form className="mb-4 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleSearch}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input
                className="flex-1"
                label="Buscar usuario"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Digite o nome"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={loadingList}>
                  Buscar
                </Button>
                <Button type="button" variant="secondary" onClick={limparBusca} disabled={loadingList || !searchTerm}>
                  Limpar
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {searchActive
                ? 'Exibindo resultado da busca sob demanda.'
                : 'Lista inicial reduzida para baixar o custo de leitura.'}
            </p>
          </form>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((usuario) => (
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
                <p className="mt-2 text-sm text-slate-500">Empresa: {usuario.empresaNome || 'Acesso central'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => iniciarEdicao(usuario)}
                    disabled={busy || usuario.rootSuperadmin || usuario.email === 'adm@acs.com'}
                  >
                    Editar
                  </Button>
                </div>
              </Card>
            ))}

            {items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                {loadingList ? 'Carregando usuarios...' : 'Nenhum usuario cadastrado ainda.'}
              </div>
            ) : null}
          </div>

          {!searchActive && hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="secondary" onClick={carregarMais} disabled={loadingList}>
                {loadingList ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </PageShell>
      </div>
    </Layout>
  )
}
