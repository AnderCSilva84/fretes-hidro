import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { buscarPassagens, cancelarPassagem, deleteHistoricoCaixaPassagem, listarHistoricoCaixasPassagem, listarPassagensPage, obterResumoVendaPassagemHorario } from '../services/firebase.js'
import { abrirBilhetePassagem } from '../utils/bilhetePassagemPdf.js'
import { abrirJanelaImpressaoTermica } from '../utils/bilheteTermico.js'
import { formatDateAndTimeBR, formatDateTimeBR } from '../utils/date.js'
import { abrirResumoVendaHorarioPdf } from '../utils/resumoVendaHorarioPdf.js'
import { isRootSuperadminUser } from '../utils/systemConfig.js'

const PAGE_SIZE = 12

function formatarDataHora(valor) {
  return formatDateTimeBR(valor)
}

export default function Passagens() {
  const { user } = useAuth()
  const isRoot = isRootSuperadminUser(user)
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: viagens } = useCollectionOnce('viagens', { empresaId, empresaNome })
  const [items, setItems] = useState([])
  const [filtros, setFiltros] = useState({ searchTerm: '', viagemId: '', dataViagem: '', status: '' })
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [erroTela, setErroTela] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [historicoCaixas, setHistoricoCaixas] = useState([])
  const [exportingHistoryId, setExportingHistoryId] = useState('')

  useEffect(() => {
    let active = true

    async function carregarHistorico() {
      try {
        const items = await listarHistoricoCaixasPassagem({ empresaId, empresaNome })

        if (active) {
          setHistoricoCaixas(items)
        }
      } catch {
        if (active) {
          setHistoricoCaixas([])
        }
      }
    }

    void carregarHistorico()

    return () => {
      active = false
    }
  }, [empresaId, empresaNome])

  async function carregarListaInicial() {
    setLoading(true)
    setErroTela('')

    try {
      const result = await listarPassagensPage({
        empresaId,
        empresaNome,
        viagemId: filtros.viagemId,
        dataViagem: filtros.dataViagem,
        status: filtros.status,
        maxResults: PAGE_SIZE,
      })

      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } catch {
      setItems([])
      setErroTela('Nao foi possivel carregar as passagens.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoading(true)
      setErroTela('')

      try {
        const result = await listarPassagensPage({
          empresaId,
          empresaNome,
          maxResults: PAGE_SIZE,
        })

        if (!active) {
          return
        }

        setItems(result.items)
        setCursor(result.cursor)
        setHasMore(result.hasMore)
        setSearchActive(false)
      } catch {
        if (active) {
          setItems([])
          setErroTela('Nao foi possivel carregar as passagens.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void carregar()

    return () => {
      active = false
    }
  }, [empresaId, empresaNome])

  async function aplicarFiltros(event) {
    event.preventDefault()

    if (String(filtros.searchTerm || '').trim()) {
      setLoading(true)
      setErroTela('')

      try {
        const result = await buscarPassagens(filtros.searchTerm, {
          empresaId,
          empresaNome,
          viagemId: filtros.viagemId,
          dataViagem: filtros.dataViagem,
          status: filtros.status,
          maxResults: 24,
        })
        setItems(result)
        setCursor(null)
        setHasMore(false)
        setSearchActive(true)
      } catch {
        setItems([])
        setErroTela('Nao foi possivel concluir a busca de passagens.')
      } finally {
        setLoading(false)
      }

      return
    }

    await carregarListaInicial()
  }

  async function limpar() {
    const next = { searchTerm: '', viagemId: '', dataViagem: '', status: '' }
    setFiltros(next)
    setLoading(true)
    setErroTela('')

    try {
      const result = await listarPassagensPage({
        empresaId,
        empresaNome,
        maxResults: PAGE_SIZE,
      })
      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } catch {
      setItems([])
      setErroTela('Nao foi possivel limpar os filtros.')
    } finally {
      setLoading(false)
    }
  }

  async function carregarMais() {
    if (!hasMore || searchActive) {
      return
    }

    setLoading(true)
    setErroTela('')

    try {
      const result = await listarPassagensPage({
        empresaId,
        empresaNome,
        viagemId: filtros.viagemId,
        dataViagem: filtros.dataViagem,
        status: filtros.status,
        maxResults: PAGE_SIZE,
        cursor,
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } catch {
      setErroTela('Nao foi possivel carregar mais passagens.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelar(item) {
    setBusyId(item.id)

    try {
      await cancelarPassagem(item, user)

      if (searchActive && String(filtros.searchTerm || '').trim()) {
        await aplicarFiltros({ preventDefault() {} })
      } else {
        await carregarListaInicial()
      }
    } finally {
      setBusyId('')
    }
  }

  async function handleExportarHistorico(viagemId) {
    setExportingHistoryId(viagemId)

    try {
      const payload = await obterResumoVendaPassagemHorario(viagemId, { empresaId, empresaNome })
      await abrirResumoVendaHorarioPdf(payload)
    } finally {
      setExportingHistoryId('')
    }
  }

  async function handleExcluirHistorico(item) {
    if (!isRoot) {
      return
    }

    const confirmed = window.confirm(`Excluir o historico do caixa ${item.embarcacaoNome || 'sem embarcacao'} em ${item.dataViagem || '-'}?`)

    if (!confirmed) {
      return
    }

    setExportingHistoryId(item.id)

    try {
      await deleteHistoricoCaixaPassagem(item.id, user)
      setHistoricoCaixas((current) => current.filter((registro) => registro.id !== item.id))
    } finally {
      setExportingHistoryId('')
    }
  }

  return (
    <Layout title="Passagens" subtitle="Consulta, reimpressao, filtros e cancelamento com leitura reduzida." icon={<ListIcon className="h-6 w-6" />}>
      <div className="space-y-6">
      <PageShell title="Historico de caixas de venda" subtitle="Consulte apenas caixas de passagens ja fechados e reexporte o resumo em PDF." icon={<ListIcon className="h-6 w-6" />}>
        <div className="space-y-3">
          {historicoCaixas.map((item) => (
            <div key={item.id} className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-950">{item.embarcacaoNome || 'Embarcacao nao informada'}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.origem || '-'} - {item.destino || '-'} | {formatDateAndTimeBR(item.dataViagem, item.horarioSaida)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Abertura: {formatarDataHora(item.caixaAbertoEm)} | Fechamento: {formatarDataHora(item.caixaFechadoEm)}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                    item.status === 'Fechada' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {item.status || 'Aberta'}
                  </span>
                  <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                    <Button type="button" variant="secondary" onClick={() => handleExportarHistorico(item.id)} disabled={exportingHistoryId === item.id} className="w-full sm:w-auto">
                      {exportingHistoryId === item.id ? 'Gerando PDF...' : 'Exportar PDF'}
                    </Button>
                    {isRoot ? (
                      <Button type="button" variant="danger" onClick={() => handleExcluirHistorico(item)} disabled={exportingHistoryId === item.id} className="w-full sm:w-auto">
                        {exportingHistoryId === item.id ? 'Excluindo...' : 'Excluir historico'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {historicoCaixas.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
              Nenhum caixa de venda fechado encontrado para consulta.
            </div>
          ) : null}
        </div>
      </PageShell>

      <PageShell title="Bilhetes vendidos" subtitle="Busca sob demanda e pagina reduzida para economizar leituras." icon={<ListIcon className="h-6 w-6" />}>
        <form className="mb-5 grid gap-3 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={aplicarFiltros}>
          <Input
            label="Busca"
            value={filtros.searchTerm}
            onChange={(event) => setFiltros((current) => ({ ...current, searchTerm: event.target.value }))}
            placeholder="Codigo, nome ou documento"
          />
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            <span>Viagem</span>
            <select
              value={filtros.viagemId}
              onChange={(event) => setFiltros((current) => ({ ...current, viagemId: event.target.value }))}
              className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Todas</option>
              {viagens.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.origem} - {item.destino} • {item.dataViagem}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Data"
            type="date"
            value={filtros.dataViagem}
            onChange={(event) => setFiltros((current) => ({ ...current, dataViagem: event.target.value }))}
          />
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            <span>Status</span>
            <select
              value={filtros.status}
              onChange={(event) => setFiltros((current) => ({ ...current, status: event.target.value }))}
              className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Todos</option>
              {['Vendida', 'Check-in', 'Embarcado', 'Cancelada', 'No-show'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Buscando...' : 'Aplicar filtros'}
            </Button>
            <Button type="button" variant="secondary" onClick={limpar} disabled={loading}>
              Limpar
            </Button>
          </div>
        </form>

        {erroTela ? (
          <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {erroTela}
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-950">{item.codigo}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.passageiroNome} • {item.passageiroDocumento || 'Sem documento'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.origem} - {item.destino} • {item.dataViagem} {item.horarioSaida || ''}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#1657d8]">{item.status}</span>
                  <p className={`text-lg font-bold ${Number(item.valor || 0) < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                    R$ {Number(item.valor || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                <Button type="button" variant="secondary" onClick={() => abrirBilhetePassagem(item)} className="w-full sm:w-auto">
                  Abrir PDF
                </Button>
                <Button type="button" variant="ghost" onClick={() => abrirJanelaImpressaoTermica(item)} className="w-full sm:w-auto">
                  Reimprimir
                </Button>
                <Link
                  to={`/manifesto/${item.viagemId}`}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-[#1657d8] sm:w-auto"
                >
                  Manifesto
                </Link>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => handleCancelar(item)}
                  disabled={busyId === item.id || item.status === 'Cancelada' || item.status === 'Embarcado'}
                  className="w-full sm:w-auto"
                >
                  {busyId === item.id ? 'Cancelando...' : 'Cancelar'}
                </Button>
              </div>
            </div>
          ))}

          {!loading && items.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
              Nenhuma passagem encontrada.
            </div>
          ) : null}

          {!searchActive && hasMore ? (
            <div className="flex justify-center">
              <Button type="button" variant="secondary" onClick={carregarMais} disabled={loading}>
                {loading ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </div>
      </PageShell>
      </div>
    </Layout>
  )
}
