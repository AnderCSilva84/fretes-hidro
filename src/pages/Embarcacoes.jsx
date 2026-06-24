import { useEffect, useState } from 'react'
import { BoatIcon } from '../components/AppIcons.jsx'
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
  nome: '',
  identificacao: '',
  capacidade: '',
  empresaId: '',
  empresaNome: '',
  horariosPartida: [''],
}

const PAGE_SIZE = 12

function normalizarHorarios(horarios = []) {
  return horarios.map((item) => String(item || '').trim()).filter(Boolean)
}

export default function Embarcacoes() {
  const { user } = useAuth()
  const { items: empresas } = useCollectionOnce('empresas')
  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregar() {
      setLoadingList(true)

      try {
        const result = await listCollectionPage('embarcacoes', {
          orderField: 'nome',
          orderDirection: 'asc',
          maxResults: PAGE_SIZE,
          empresaId,
          empresaNome,
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
  }, [user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  function atualizarHorario(index, value) {
    setForm((current) => ({
      ...current,
      horariosPartida: current.horariosPartida.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }))
  }

  function adicionarHorario() {
    setForm((current) => ({
      ...current,
      horariosPartida: [...current.horariosPartida, ''],
    }))
  }

  function removerHorario(index) {
    setForm((current) => {
      const proximos = current.horariosPartida.filter((_, itemIndex) => itemIndex !== index)

      return {
        ...current,
        horariosPartida: proximos.length ? proximos : [''],
      }
    })
  }

  function cancelarEdicao() {
    setEditingId(null)
    setForm(initialForm)
  }

  function iniciarEdicao(item) {
    setEditingId(item.id)
    setForm({
      nome: item.nome || '',
      identificacao: item.identificacao || '',
      capacidade: item.capacidade || '',
      empresaId: item.empresaId || '',
      empresaNome: item.empresaNome || '',
      horariosPartida: item.horariosPartida?.length ? item.horariosPartida : item.horarioPartidaPadrao ? [item.horarioPartidaPadrao] : [''],
    })
  }

  async function carregarListaInicial() {
    setLoadingList(true)
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const result = await listCollectionPage('embarcacoes', {
        orderField: 'nome',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        empresaId,
        empresaNome,
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

    try {
      const horariosPartida = normalizarHorarios(form.horariosPartida).sort()
      const payload = {
        nome: form.nome.trim(),
        identificacao: form.identificacao.trim(),
        capacidade: form.capacidade.trim(),
        empresaId: form.empresaId,
        empresaNome: form.empresaNome,
        horariosPartida,
        horarioPartidaPadrao: horariosPartida[0] || '',
      }

      if (editingId) {
        await updateCollectionDocument('embarcacoes', editingId, payload)
      } else {
        await addCollectionDocument('embarcacoes', payload)
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

  async function excluir(item) {
    const confirmed = window.confirm(`Excluir a embarcacao ${item.nome || 'sem nome'}?`)

    if (!confirmed) {
      return
    }

    setBusy(true)
    try {
      await deleteCollectionDocument('embarcacoes', item.id)
      if (searchActive) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }

      if (editingId === item.id) {
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
      const result = await searchCollectionByField('embarcacoes', 'nome', term, 24, {
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })
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
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const result = await listCollectionPage('embarcacoes', {
        orderField: 'nome',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        cursor,
        empresaId,
        empresaNome,
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingList(false)
    }
  }

  return (
    <Layout title="Cadastro de embarcacoes" subtitle="Cadastro da frota usada nas rotas hidroviarias." icon={<BoatIcon className="h-6 w-6" />}>
      <PageShell title="Embarcacoes cadastradas" subtitle="Frota com multiplos horarios de partida para agilizar a comanda." icon={<BoatIcon className="h-6 w-6" />}>
        <div className="space-y-6">
          <div className="rounded-[1.7rem] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(28,99,231,0.05)] md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1657d8]">Cadastro</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{editingId ? 'Editar embarcacao' : 'Nova embarcacao'}</h3>
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <Input
                className="md:col-span-2"
                label="Nome"
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                required
              />
              <Input
                label="Identificacao"
                value={form.identificacao}
                onChange={(event) => setForm((current) => ({ ...current, identificacao: event.target.value }))}
              />
              <Input
                label="Capacidade"
                value={form.capacidade}
                onChange={(event) => setForm((current) => ({ ...current, capacidade: event.target.value }))}
              />
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Empresa</span>
                <select
                  value={form.empresaId}
                  onChange={(event) => {
                    const empresaSelecionada = empresas.find((item) => item.id === event.target.value)
                    setForm((current) => ({
                      ...current,
                      empresaId: event.target.value,
                      empresaNome: empresaSelecionada?.nome || '',
                    }))
                  }}
                  className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Sem empresa</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Horarios de partida</p>
                    <p className="text-xs text-slate-500">Adicione quantos horarios quiser para a mesma embarcacao.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={adicionarHorario} className="min-h-10 px-3 py-2 text-xs">
                    + Horario
                  </Button>
                </div>

                <div className="space-y-3">
                  {form.horariosPartida.map((horario, index) => (
                    <div key={`${editingId || 'novo'}-${index}`} className="flex items-center gap-3">
                      <Input
                        label={index === 0 ? 'Horario' : ''}
                        type="time"
                        value={horario}
                        onChange={(event) => atualizarHorario(index, event.target.value)}
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" onClick={() => removerHorario(index)} className="min-h-10 px-3 py-2 text-xs">
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <Button type="submit" disabled={busy}>
                  {editingId ? 'Atualizar embarcacao' : 'Salvar embarcacao'}
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
                label="Buscar embarcacao"
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
                : 'Lista inicial reduzida para diminuir leituras da colecao.'}
            </p>
          </form>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((embarcacao) => {
              const horarios = normalizarHorarios(
                embarcacao.horariosPartida?.length ? embarcacao.horariosPartida : [embarcacao.horarioPartidaPadrao],
              )

              return (
                <div
                  key={embarcacao.id}
                  className="rounded-[1.6rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                >
                  <p className="font-semibold text-slate-900">{embarcacao.nome}</p>
                  <p className="text-sm text-slate-500">{embarcacao.empresaNome || 'Sem empresa'}</p>
                  <p className="text-sm text-slate-500">{embarcacao.identificacao || 'Sem identificacao'}</p>
                  <p className="text-sm text-slate-500">{embarcacao.capacidade || 'Sem capacidade'}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[#1657d8]">Partidas</p>
                  <p className="mt-1 text-sm text-slate-600">{horarios.length ? horarios.join(' • ') : 'Sem horarios cadastrados'}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => iniciarEdicao(embarcacao)} disabled={busy}>
                      Editar
                    </Button>
                    <Button type="button" variant="danger" onClick={() => excluir(embarcacao)} disabled={busy}>
                      Excluir
                    </Button>
                  </div>
                </div>
              )
            })}

            {items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                {loadingList ? 'Carregando embarcacoes...' : 'Nenhuma embarcacao cadastrada ainda.'}
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
