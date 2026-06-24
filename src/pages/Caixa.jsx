import { useEffect, useState } from 'react'
import Button from '../components/Button.jsx'
import { ListIcon, MoneyIcon } from '../components/AppIcons.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { deleteCollectionDocument, getCaixaResumo, getCollectionCount, listCaixaEntries, listCollectionPage } from '../services/firebase.js'
import { gerarCaixaPdf } from '../utils/gerarCaixaPdf.js'

function normalizarData(valor) {
  if (!valor) {
    return null
  }

  if (typeof valor?.toDate === 'function') {
    return valor.toDate()
  }

  const date = new Date(valor)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatarData(valor) {
  const data = normalizarData(valor)

  if (!data) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

export default function Caixa() {
  const { user } = useAuth()
  const [caixa, setCaixa] = useState([])
  const [movimentacoesCount, setMovimentacoesCount] = useState(0)
  const [caixaResumo, setCaixaResumo] = useState({ totalEntrada: 0, totalRegistros: 0 })
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [loadingList, setLoadingList] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [filtroAtivo, setFiltroAtivo] = useState(false)
  const [periodoResumo, setPeriodoResumo] = useState({ totalEntrada: 0, totalRegistros: 0 })

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregarResumo() {
      setLoadingList(true)

      try {
        const [total, resumo, paginaInicial] = await Promise.all([
          getCollectionCount('movimentacoes', { empresaId, empresaNome }),
          getCaixaResumo({ empresaId, empresaNome }),
          listCollectionPage('caixa', {
            orderField: 'criadoEm',
            orderDirection: 'desc',
            maxResults: 20,
            empresaId,
            empresaNome,
          }),
        ])

        if (active) {
          setMovimentacoesCount(total)
          setCaixaResumo({
            totalEntrada: Number(resumo?.totalEntrada || 0),
            totalRegistros: Number(resumo?.totalRegistros || 0),
          })
          setCaixa(paginaInicial.items)
          setCursor(paginaInicial.cursor)
          setHasMore(paginaInicial.hasMore)
          setPeriodoResumo({
            totalEntrada: paginaInicial.items
              .filter((item) => item.tipo === 'entrada')
              .reduce((sum, item) => sum + Number(item.valor || 0), 0),
            totalRegistros: paginaInicial.items.length,
          })
        }
      } finally {
        if (active) {
          setLoadingList(false)
        }
      }
    }

    void carregarResumo()

    return () => {
      active = false
    }
  }, [user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  async function carregarPaginaInicial() {
    setLoadingList(true)
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const paginaInicial = await listCollectionPage('caixa', {
        orderField: 'criadoEm',
        orderDirection: 'desc',
        maxResults: 20,
        empresaId,
        empresaNome,
      })

      setCaixa(paginaInicial.items)
      setCursor(paginaInicial.cursor)
      setHasMore(paginaInicial.hasMore)
      setFiltroAtivo(false)
      setPeriodoResumo({
        totalEntrada: paginaInicial.items
          .filter((item) => item.tipo === 'entrada')
          .reduce((sum, item) => sum + Number(item.valor || 0), 0),
        totalRegistros: paginaInicial.items.length,
      })
    } finally {
      setLoadingList(false)
    }
  }

  async function aplicarFiltroPeriodo() {
    setLoadingList(true)
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const itens = await listCaixaEntries({
        dataInicial,
        dataFinal,
        maxResults: 300,
        empresaId,
        empresaNome,
      })

      setCaixa(itens)
      setCursor(null)
      setHasMore(false)
      setFiltroAtivo(Boolean(dataInicial || dataFinal))
      setPeriodoResumo({
        totalEntrada: itens
          .filter((item) => item.tipo === 'entrada')
          .reduce((sum, item) => sum + Number(item.valor || 0), 0),
        totalRegistros: itens.length,
      })
    } finally {
      setLoadingList(false)
    }
  }

  async function exportarPdf() {
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''
    const itens = await listCaixaEntries({
      dataInicial,
      dataFinal,
      maxResults: 1000,
      empresaId,
      empresaNome,
    })
    const totalEntrada = itens
      .filter((item) => item.tipo === 'entrada')
      .reduce((sum, item) => sum + Number(item.valor || 0), 0)

    await gerarCaixaPdf({
      itens,
      dataInicial,
      dataFinal,
      totalEntrada,
      valorFaturado: totalEntrada,
    })
  }

  async function excluirLancamento(item) {
    const confirmed = window.confirm(`Excluir o lancamento ${item.origem || 'sem descricao'}?`)

    if (!confirmed) {
      return
    }

    setDeletingId(item.id)
    try {
      await deleteCollectionDocument('caixa', item.id)
      const resumo = await getCaixaResumo({
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })
      setCaixaResumo({
        totalEntrada: Number(resumo?.totalEntrada || 0),
        totalRegistros: Number(resumo?.totalRegistros || 0),
      })

      if (filtroAtivo) {
        await aplicarFiltroPeriodo()
      } else {
        await carregarPaginaInicial()
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function limparFiltro() {
    setDataInicial('')
    setDataFinal('')
    await carregarPaginaInicial()
  }

  async function carregarMais() {
    if (!hasMore || filtroAtivo) {
      return
    }

    setLoadingList(true)
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const result = await listCollectionPage('caixa', {
        orderField: 'criadoEm',
        orderDirection: 'desc',
        maxResults: 20,
        cursor,
        empresaId,
        empresaNome,
      })

      const nextItems = [...caixa, ...result.items]
      setCaixa(nextItems)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setPeriodoResumo({
        totalEntrada: nextItems
          .filter((item) => item.tipo === 'entrada')
          .reduce((sum, item) => sum + Number(item.valor || 0), 0),
        totalRegistros: nextItems.length,
      })
    } finally {
      setLoadingList(false)
    }
  }

  return (
    <Layout title="Tela de caixa" subtitle="Acompanhamento financeiro e entradas operacionais." icon={<MoneyIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <PageShell title="Resumo financeiro" icon={<MoneyIcon className="h-6 w-6" />}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Entradas</p>
              <p className="mt-2 text-2xl font-bold text-[#1657d8]">R$ {Number(caixaResumo.totalEntrada || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Registros</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{caixaResumo.totalRegistros}</p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Movimentacoes</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{movimentacoesCount}</p>
            </div>
          </div>
        </PageShell>

        <PageShell
          title="Movimentacoes do caixa"
          subtitle="Filtre por periodo e exporte um PDF das entradas exibidas abaixo."
          icon={<ListIcon className="h-6 w-6" />}
          actions={[
            <Button key="exportar" type="button" onClick={exportarPdf} disabled={caixa.length === 0}>
              Exportar PDF
            </Button>,
          ]}
        >
          <div className="mb-5 grid gap-3 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Data inicial</span>
              <input
                type="date"
                value={dataInicial}
                onChange={(event) => setDataInicial(event.target.value)}
                className="min-h-10 w-full rounded-[1.1rem] border border-blue-200 bg-white px-3 text-[0.9rem] text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Data final</span>
              <input
                type="date"
                value={dataFinal}
                onChange={(event) => setDataFinal(event.target.value)}
                className="min-h-10 w-full rounded-[1.1rem] border border-blue-200 bg-white px-3 text-[0.9rem] text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1657d8]">Periodo</p>
              <p className="mt-2 text-xl font-bold text-slate-950">R$ {Number(periodoResumo.totalEntrada || 0).toFixed(2)}</p>
              <p className="text-sm text-slate-500">{periodoResumo.totalRegistros} registro(s)</p>
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-2">
              <Button type="button" onClick={aplicarFiltroPeriodo} disabled={loadingList}>
                {loadingList ? 'Carregando...' : 'Aplicar filtro'}
              </Button>
              <Button type="button" variant="secondary" onClick={limparFiltro} disabled={loadingList || (!dataInicial && !dataFinal && !filtroAtivo)}>
                Limpar filtro
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {caixa.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.origem}</p>
                  <p className="text-sm text-slate-500">{item.encomendaCodigo || 'Sem codigo'}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatarData(item.criadoEm)}</p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <p className="text-lg font-bold text-slate-900">R$ {Number(item.valor || 0).toFixed(2)}</p>
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-10 px-3 py-2 text-xs"
                    disabled={deletingId === item.id}
                    onClick={() => excluirLancamento(item)}
                  >
                    {deletingId === item.id ? 'Excluindo...' : 'Excluir'}
                  </Button>
                </div>
              </div>
            ))}

            {caixa.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
                {loadingList ? 'Carregando movimentacoes...' : 'Nenhuma movimentacao encontrada para o periodo selecionado.'}
              </div>
            ) : null}

            {!filtroAtivo && hasMore ? (
              <div className="flex justify-center">
                <Button type="button" variant="secondary" onClick={carregarMais} disabled={loadingList}>
                  {loadingList ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            ) : null}
          </div>
        </PageShell>
      </div>
    </Layout>
  )
}
