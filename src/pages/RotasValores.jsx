import { useEffect, useMemo, useState } from 'react'
import { RouteIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import {
  addCollectionDocument,
  deleteCollectionDocument,
  listCollectionPage,
  searchCollectionByField,
  updateCollectionDocument,
} from '../services/firebase.js'

const initialForm = {
  origem: '',
  destino: '',
  terminalOrigem: '',
  terminalDestino: '',
  valor: '',
  duracaoMinutos: '',
}

const PAGE_SIZE = 12

export default function RotasValores() {
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: terminais } = useCollectionOnce('terminais', { empresaId, empresaNome })
  const [rotas, setRotas] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

  const terminalOptions = useMemo(() => terminais.map((item) => item.nome).filter(Boolean), [terminais])

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoadingList(true)

      try {
        const result = await listCollectionPage('rotasValores', {
          orderField: 'origem',
          orderDirection: 'asc',
          maxResults: PAGE_SIZE,
          empresaId,
          empresaNome,
        })

        if (!active) {
          return
        }

        setRotas(result.items)
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
  }, [empresaId, empresaNome])

  function cancelarEdicao() {
    setEditingId(null)
    setForm(initialForm)
  }

  function iniciarEdicao(rota) {
    setEditingId(rota.id)
    setForm({
      origem: rota.origem || '',
      destino: rota.destino || '',
      terminalOrigem: rota.terminalOrigem || '',
      terminalDestino: rota.terminalDestino || '',
      valor: rota.valor || '',
      duracaoMinutos: rota.duracaoMinutos || '',
    })
  }

  async function carregarListaInicial() {
    setLoadingList(true)

    try {
      const result = await listCollectionPage('rotasValores', {
        orderField: 'origem',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        empresaId,
        empresaNome,
      })

      setRotas(result.items)
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

    try {
      const payload = {
        origem: form.origem.trim(),
        destino: form.destino.trim(),
        terminalOrigem: form.terminalOrigem,
        terminalDestino: form.terminalDestino,
        valor: Number(form.valor || 0),
        duracaoMinutos: Number(form.duracaoMinutos || 0),
        empresaId: user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      }

      if (editingId) {
        await updateCollectionDocument('rotasValores', editingId, payload)
      } else {
        await addCollectionDocument('rotasValores', payload)
      }

      if (searchActive) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }

      cancelarEdicao()
    } finally {
      setBusy(false)
    }
  }

  async function excluirRota(rota) {
    const confirmed = window.confirm(`Excluir a linha ${rota.origem || ''} - ${rota.destino || ''}?`)

    if (!confirmed) {
      return
    }

    setBusy(true)
    try {
      await deleteCollectionDocument('rotasValores', rota.id)
      if (searchActive) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }

      if (editingId === rota.id) {
        cancelarEdicao()
      }
    } finally {
      setBusy(false)
    }
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
      const result = await searchCollectionByField('rotasValores', 'linha', term, 24, { empresaId, empresaNome })
      setRotas(result)
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
      const result = await listCollectionPage('rotasValores', {
        orderField: 'origem',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        cursor,
        empresaId,
        empresaNome,
      })

      setRotas((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingList(false)
    }
  }

  return (
    <Layout title="Cadastro de rotas e valores" subtitle="Controle tarifario por linha, terminal e duracao." icon={<RouteIcon className="h-6 w-6" />}>
      <PageShell title="Rotas cadastradas" subtitle="A linha define terminal, duracao e valor padrao do frete." icon={<RouteIcon className="h-6 w-6" />}>
        <div className="space-y-6">
          <div className="rounded-[1.7rem] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(28,99,231,0.05)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1657d8]">Linha</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{editingId ? 'Editar linha' : 'Nova linha'}</h3>
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <Input
                label="Origem"
                value={form.origem}
                onChange={(event) => setForm((current) => ({ ...current, origem: event.target.value }))}
                required
              />
              <Input
                label="Destino"
                value={form.destino}
                onChange={(event) => setForm((current) => ({ ...current, destino: event.target.value }))}
                required
              />

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Terminal de origem</span>
                <select
                  value={form.terminalOrigem}
                  onChange={(event) => setForm((current) => ({ ...current, terminalOrigem: event.target.value }))}
                  className="min-h-9 w-full min-w-0 max-w-full rounded-[1rem] border border-blue-200 bg-white px-3 text-[0.85rem] text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 sm:min-h-10 sm:text-sm"
                  required
                >
                  <option value="">Selecione um terminal</option>
                  {terminalOptions.map((terminal) => (
                    <option key={terminal} value={terminal}>
                      {terminal}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Terminal de destino</span>
                <select
                  value={form.terminalDestino}
                  onChange={(event) => setForm((current) => ({ ...current, terminalDestino: event.target.value }))}
                  className="min-h-9 w-full min-w-0 max-w-full rounded-[1rem] border border-blue-200 bg-white px-3 text-[0.85rem] text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 sm:min-h-10 sm:text-sm"
                  required
                >
                  <option value="">Selecione um terminal</option>
                  {terminalOptions.map((terminal) => (
                    <option key={terminal} value={terminal}>
                      {terminal}
                    </option>
                  ))}
                </select>
              </label>

              <Input
                label="Valor padrao"
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(event) => setForm((current) => ({ ...current, valor: event.target.value }))}
              />
              <Input
                label="Duracao (min)"
                type="number"
                min="0"
                value={form.duracaoMinutos}
                onChange={(event) => setForm((current) => ({ ...current, duracaoMinutos: event.target.value }))}
              />

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <Button type="submit" disabled={busy}>
                  {editingId ? 'Atualizar linha' : 'Salvar linha'}
                </Button>
                {editingId ? (
                  <Button type="button" variant="secondary" onClick={cancelarEdicao}>
                    Cancelar edicao
                  </Button>
                ) : null}
              </div>
            </form>
          </div>

          <form className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleSearch}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input
                className="flex-1"
                label="Buscar linha"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Digite a origem"
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
                : 'Lista inicial reduzida para cortar leituras desnecessarias.'}
            </p>
          </form>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rotas.map((rota) => (
              <div
                key={rota.id}
                className="rounded-[1.6rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
              >
                <p className="font-semibold text-slate-900">
                  {rota.origem} - {rota.destino}
                </p>
                <p className="text-sm text-slate-500">Origem: {rota.terminalOrigem || 'Nao informado'}</p>
                <p className="text-sm text-slate-500">Destino: {rota.terminalDestino || 'Nao informado'}</p>
                <p className="text-sm text-slate-500">Valor padrao: R$ {Number(rota.valor || 0).toFixed(2)}</p>
                <p className="text-sm text-slate-500">Duracao: {rota.duracaoMinutos ? `${rota.duracaoMinutos} min` : 'Nao informada'}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => iniciarEdicao(rota)} disabled={busy}>
                    Editar
                  </Button>
                  <Button type="button" variant="danger" onClick={() => excluirRota(rota)} disabled={busy}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))}

            {rotas.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                {loadingList ? 'Carregando linhas...' : 'Nenhuma linha cadastrada ainda.'}
              </div>
            ) : null}
          </div>

          {!searchActive && hasMore ? (
            <div className="flex justify-center">
              <Button type="button" variant="secondary" onClick={carregarMais} disabled={loadingList}>
                {loadingList ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </div>
      </PageShell>
    </Layout>
  )
}
