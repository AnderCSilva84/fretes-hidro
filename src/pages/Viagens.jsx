import { useEffect, useMemo, useState } from 'react'
import { BoatIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { criarProgramacaoViagem, listarProgramacoesViagemPage } from '../services/firebase.js'

const initialForm = {
  rotaId: '',
  embarcacaoId: '',
  horariosSaida: '',
  capacidadeTotal: '',
  valorPadrao: '',
  ativo: true,
}

function parseCapacidade(embarcacao) {
  const bruto = String(embarcacao?.capacidadePassageiros || embarcacao?.capacidade || '').match(/\d+/)
  return bruto ? Number(bruto[0]) : 0
}

export default function Viagens() {
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: rotas } = useCollectionOnce('rotasValores', { empresaId, empresaNome })
  const { items: embarcacoes } = useCollectionOnce('embarcacoes', { empresaId, empresaNome })
  const [form, setForm] = useState(initialForm)
  const [queryState, setQueryState] = useState({
    items: [],
    cursor: null,
    hasMore: false,
    loading: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const rotaSelecionada = useMemo(
    () => rotas.find((item) => item.id === form.rotaId) || null,
    [form.rotaId, rotas],
  )

  useEffect(() => {
    let active = true

    async function carregar() {
      setQueryState((current) => ({ ...current, loading: true }))

      try {
        const result = await listarProgramacoesViagemPage({
          empresaId,
          empresaNome,
          maxResults: 12,
        })

        if (!active) {
          return
        }

        setQueryState({
          items: result.items,
          cursor: result.cursor,
          hasMore: result.hasMore,
          loading: false,
        })
      } catch (runtimeError) {
        if (!active) {
          return
        }

        setError(runtimeError.message || 'Nao foi possivel carregar as programacoes.')
        setQueryState((current) => ({ ...current, loading: false }))
      }
    }

    void carregar()

    return () => {
      active = false
    }
  }, [empresaId, empresaNome])

  function handleSelectEmbarcacao(embarcacaoId) {
    const embarcacao = embarcacoes.find((item) => item.id === embarcacaoId) || null
    setForm((current) => ({
      ...current,
      embarcacaoId,
      capacidadeTotal: current.capacidadeTotal || String(parseCapacidade(embarcacao) || ''),
      horariosSaida: current.horariosSaida || String((embarcacao?.horariosPartida || []).join(', ') || embarcacao?.horarioPartidaPadrao || ''),
    }))
  }

  async function carregarMais() {
    if (!queryState.hasMore) {
      return
    }

    setQueryState((current) => ({ ...current, loading: true }))

    try {
      const result = await listarProgramacoesViagemPage({
        empresaId,
        empresaNome,
        maxResults: 12,
        cursor: queryState.cursor,
      })

      setQueryState((current) => ({
        items: [...current.items, ...result.items],
        cursor: result.cursor,
        hasMore: result.hasMore,
        loading: false,
      }))
    } catch (runtimeError) {
      setError(runtimeError.message || 'Nao foi possivel carregar mais programacoes.')
      setQueryState((current) => ({ ...current, loading: false }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const embarcacao = embarcacoes.find((item) => item.id === form.embarcacaoId) || null

      if (!rotaSelecionada || !embarcacao) {
        throw new Error('Selecione rota e embarcacao.')
      }

      await criarProgramacaoViagem({
        empresaId,
        empresaNome,
        rotaId: rotaSelecionada.id,
        origem: rotaSelecionada.origem || '',
        destino: rotaSelecionada.destino || '',
        terminalOrigem: rotaSelecionada.terminalOrigem || '',
        terminalDestino: rotaSelecionada.terminalDestino || '',
        embarcacaoId: embarcacao.id,
        embarcacaoNome: embarcacao.nome || '',
        horariosSaida: form.horariosSaida,
        capacidadeTotal: Number(form.capacidadeTotal || 0),
        valorPadrao: Number(form.valorPadrao || rotaSelecionada.valor || 0),
        duracaoMinutos: Number(rotaSelecionada.duracaoMinutos || 0),
        ativo: form.ativo,
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
        operadorEmail: user?.email || '',
      })

      const result = await listarProgramacoesViagemPage({
        empresaId,
        empresaNome,
        maxResults: 12,
      })

      setQueryState({
        items: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
        loading: false,
      })
      setForm(initialForm)
      setSuccess('Programacao fixa salva com sucesso.')
    } catch (runtimeError) {
      setError(runtimeError.message || 'Nao foi possivel salvar a programacao.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Programacao de viagens" subtitle="Cadastre a embarcacao fixa por linha e seus horarios recorrentes." icon={<BoatIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <PageShell title="Linha fixa com embarcacao" subtitle="A viagem do dia passa a ser aberta automaticamente na venda." icon={<BoatIcon className="h-6 w-6" />}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Rota</span>
              <select
                value={form.rotaId}
                onChange={(event) => setForm((current) => ({ ...current, rotaId: event.target.value, valorPadrao: String(rotas.find((item) => item.id === event.target.value)?.valor || current.valorPadrao) }))}
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                required
              >
                <option value="">Selecione a rota</option>
                {rotas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.origem} - {item.destino}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Embarcacao</span>
              <select
                value={form.embarcacaoId}
                onChange={(event) => handleSelectEmbarcacao(event.target.value)}
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                required
              >
                <option value="">Selecione a embarcacao</option>
                {embarcacoes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Horarios de saida"
              value={form.horariosSaida}
              onChange={(event) => setForm((current) => ({ ...current, horariosSaida: event.target.value }))}
              placeholder="Ex.: 06:00, 12:00, 18:00"
              required
            />
            <Input label="Capacidade total" type="number" min="1" value={form.capacidadeTotal} onChange={(event) => setForm((current) => ({ ...current, capacidadeTotal: event.target.value }))} required />
            <Input label="Valor padrao" type="number" min="0" step="0.01" value={form.valorPadrao} onChange={(event) => setForm((current) => ({ ...current, valorPadrao: event.target.value }))} required />

            <label className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
              />
              Programacao ativa para venda
            </label>

            {error ? <p className="md:col-span-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="md:col-span-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Salvando programacao...' : 'Salvar programacao fixa'}
              </Button>
            </div>
          </form>
        </PageShell>

        <PageShell title="Programacoes cadastradas" subtitle="Base fixa usada para abrir as viagens do dia automaticamente." icon={<BoatIcon className="h-6 w-6" />}>
          <div className="space-y-3">
            {queryState.items.map((item) => (
              <div key={item.id} className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-950">
                      {item.origem} - {item.destino}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.embarcacaoNome || 'Sem embarcacao'} | Horarios: {(item.horariosSaida || []).join(', ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className={`rounded-full px-3 py-1 font-bold ${item.ativo === false ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-[#1657d8]'}`}>
                      {item.ativo === false ? 'Inativa' : 'Ativa'}
                    </span>
                    <span>Cap.: {item.capacidadeTotal}</span>
                    <span>R$ {Number(item.valorPadrao || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}

            {!queryState.loading && queryState.items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
                Nenhuma programacao fixa cadastrada ainda.
              </div>
            ) : null}

            {queryState.hasMore ? (
              <div className="pt-2">
                <Button type="button" variant="secondary" onClick={carregarMais} disabled={queryState.loading}>
                  {queryState.loading ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            ) : null}
          </div>
        </PageShell>
      </div>
    </Layout>
  )
}
