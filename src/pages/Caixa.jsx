import { useEffect, useState } from 'react'
import Button from '../components/Button.jsx'
import { ListIcon, MoneyIcon } from '../components/AppIcons.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { deleteCollectionDocument, deleteHistoricoCaixaPassagem, getCollectionCount, listCaixaEntries, listCollectionOnce, listCollectionPage, listarHistoricoCaixasPassagem, listarPassagensPorViagem, obterResumoVendaPassagemHorario } from '../services/firebase.js'
import { hasFreteAccess, hasPassagemAccess } from '../utils/accessControl.js'
import { filterCaixaItemsByModuleAccess, getCaixaCategoria, getCaixaResumoFromItems, resumirCaixaPorCategoria } from '../utils/caixaAccess.js'
import { gerarCaixaPdf } from '../utils/gerarCaixaPdf.js'
import { abrirResumoVendaHorarioPdf } from '../utils/resumoVendaHorarioPdf.js'
import { reportRuntimeError } from '../utils/runtimeDiagnostics.js'
import { isRootSuperadminUser } from '../utils/systemConfig.js'

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

function formatarInputDataBrasil(valor) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 8)

  if (numeros.length <= 2) {
    return numeros
  }

  if (numeros.length <= 4) {
    return `${numeros.slice(0, 2)}/${numeros.slice(2)}`
  }

  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`
}

function converterDataBrasilParaIso(valor) {
  const normalizado = String(valor || '').trim()

  if (!normalizado) {
    return ''
  }

  const match = normalizado.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) {
    return ''
  }

  const [, dia, mes, ano] = match
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00`)

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  return `${ano}-${mes}-${dia}`
}

function subtrairDias(dataBase, quantidadeDias) {
  const data = new Date(dataBase)
  data.setHours(0, 0, 0, 0)
  data.setDate(data.getDate() - quantidadeDias)
  return data
}

function parseIsoDateOnly(valor) {
  if (!valor) {
    return null
  }

  const [ano, mes, dia] = String(valor).split('-').map(Number)

  if (!ano || !mes || !dia) {
    return null
  }

  return new Date(ano, mes - 1, dia, 0, 0, 0, 0)
}

function filtrarCaixaPorOrigem(items, filtro) {
  if (filtro === 'todos') {
    return items
  }

  return (items || []).filter((item) => getCaixaCategoria(item) === filtro)
}

function formatarPassagemHistorico(item) {
  const passageiro = item?.passageiroNome || 'Passageiro nao informado'
  const tarifa = item?.tarifaTipo || 'Tarifa'
  const pagamento = item?.formaPagamento || 'Nao informado'
  const valor = Number(item?.valor || 0) > 0 ? `R$ ${Number(item.valor || 0).toFixed(2)}` : 'Isento'
  return `${passageiro} | ${tarifa} | ${pagamento} | ${valor}`
}

export default function Caixa() {
  const { user } = useAuth()
  const isRoot = isRootSuperadminUser(user)
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)
  const [caixaBase, setCaixaBase] = useState([])
  const [movimentacoesCount, setMovimentacoesCount] = useState(0)
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [deletingId, setDeletingId] = useState(null)
  const [loadingList, setLoadingList] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [filtroAtivo, setFiltroAtivo] = useState(false)
  const [periodoResumo, setPeriodoResumo] = useState({ totalEntrada: 0, totalRegistros: 0 })
  const [erroTela, setErroTela] = useState('')
  const [historicoViagens, setHistoricoViagens] = useState([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState('')
  const [passageirosPorViagem, setPassageirosPorViagem] = useState({})
  const [viagemExpandidaId, setViagemExpandidaId] = useState('')
  const [loadingPassageirosId, setLoadingPassageirosId] = useState('')
  const [exportingHistoryId, setExportingHistoryId] = useState('')
  const caixa = filtrarCaixaPorOrigem(caixaBase, filtroOrigem)
  const resumoCategorias = resumirCaixaPorCategoria(caixa)
  const resumoCaixaFiltrado = getCaixaResumoFromItems(caixa)
  const periodoResumoFiltrado = filtroOrigem === 'todos' ? periodoResumo : resumoCaixaFiltrado

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregarResumo() {
      setLoadingList(true)
      setErroTela('')

      try {
        const [totalResult, resumoResult, paginaResult] = await Promise.allSettled([
          getCollectionCount('movimentacoes', { empresaId, empresaNome }),
          listCollectionOnce('caixa', { empresaId, empresaNome }),
          listCollectionPage('caixa', {
            orderField: 'criadoEm',
            orderDirection: 'desc',
            maxResults: 20,
            empresaId,
            empresaNome,
          }),
        ])

        if (totalResult.status === 'rejected') {
          reportRuntimeError('Caixa.getCollectionCount.movimentacoes', totalResult.reason, { empresaId, empresaNome })
        }

        if (resumoResult.status === 'rejected') {
          reportRuntimeError('Caixa.getCaixaResumo', resumoResult.reason, { empresaId, empresaNome })
        }

        if (paginaResult.status === 'rejected') {
          reportRuntimeError('Caixa.listCollectionPage', paginaResult.reason, { empresaId, empresaNome })
        }

        let paginaInicial = paginaResult.status === 'fulfilled'
          ? paginaResult.value
          : { items: [], cursor: null, hasMore: false }
        const resumo = resumoResult.status === 'fulfilled'
          ? getCaixaResumoFromItems(filterCaixaItemsByModuleAccess(resumoResult.value, user))
          : { totalEntrada: 0, totalRegistros: 0 }
        const total = totalResult.status === 'fulfilled' ? totalResult.value : 0
        const itensPaginaVisiveis = filterCaixaItemsByModuleAccess(paginaInicial.items, user)
        const precisaFallbackLista = Number(resumo?.totalRegistros || 0) > 0 && itensPaginaVisiveis.length === 0

        if (precisaFallbackLista) {
          try {
            const itens = await listCollectionOnce('caixa', { empresaId, empresaNome })
            const itensVisiveis = filterCaixaItemsByModuleAccess(itens, user)
            paginaInicial = {
              items: itensVisiveis
                .sort((a, b) => {
                  const left = typeof a?.criadoEm?.toDate === 'function' ? a.criadoEm.toDate().getTime() : new Date(a?.criadoEm || 0).getTime()
                  const right = typeof b?.criadoEm?.toDate === 'function' ? b.criadoEm.toDate().getTime() : new Date(b?.criadoEm || 0).getTime()
                  return right - left
                })
                .slice(0, 20),
              cursor: null,
              hasMore: itensVisiveis.length > 20,
            }
          } catch (error) {
            reportRuntimeError('Caixa.listCollectionOnceFallback', error, { empresaId, empresaNome })
          }
        }

        if (active) {
          setMovimentacoesCount(canAccessFretes ? total : 0)
          setCaixaBase(filterCaixaItemsByModuleAccess(paginaInicial.items, user))
          setCursor(paginaInicial.cursor)
          setHasMore(paginaInicial.hasMore)
          setPeriodoResumo({
            ...getCaixaResumoFromItems(filterCaixaItemsByModuleAccess(paginaInicial.items, user)),
          })

          if (
            totalResult.status === 'rejected' &&
            resumoResult.status === 'rejected' &&
            paginaResult.status === 'rejected'
          ) {
            setErroTela('Nao foi possivel carregar o caixa desta empresa agora.')
          }
        }
      } catch (error) {
        reportRuntimeError('Caixa.carregarResumo', error, { empresaId, empresaNome })
        if (active) {
          setErroTela('Nao foi possivel carregar o caixa desta empresa agora.')
          setCaixaBase([])
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
  }, [canAccessFretes, user, user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregarHistoricoViagens() {
      if (!canAccessPassagens) {
        if (active) {
          setHistoricoViagens([])
        }
        return
      }

      setLoadingHistorico(true)
      setErroHistorico('')

      try {
        const items = await listarHistoricoCaixasPassagem({ empresaId, empresaNome })

        if (active) {
          setHistoricoViagens(items)
        }
      } catch (error) {
        reportRuntimeError('Caixa.listarHistoricoCaixasPassagem', error, { empresaId, empresaNome })

        if (active) {
          setHistoricoViagens([])
          setErroHistorico('Nao foi possivel carregar o historico de viagens agora.')
        }
      } finally {
        if (active) {
          setLoadingHistorico(false)
        }
      }
    }

    void carregarHistoricoViagens()

    return () => {
      active = false
    }
  }, [canAccessPassagens, user, user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  async function carregarPaginaInicial() {
    setLoadingList(true)
    setErroTela('')
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
      let itensVisiveis = filterCaixaItemsByModuleAccess(paginaInicial.items, user)
      let hasMoreAtual = paginaInicial.hasMore
      let cursorAtual = paginaInicial.cursor

      if (!itensVisiveis.length) {
        const todosItens = await listCollectionOnce('caixa', { empresaId, empresaNome })
        const itensFiltrados = filterCaixaItemsByModuleAccess(todosItens, user)
          .sort((a, b) => {
            const left = typeof a?.criadoEm?.toDate === 'function' ? a.criadoEm.toDate().getTime() : new Date(a?.criadoEm || 0).getTime()
            const right = typeof b?.criadoEm?.toDate === 'function' ? b.criadoEm.toDate().getTime() : new Date(b?.criadoEm || 0).getTime()
            return right - left
          })
        itensVisiveis = itensFiltrados.slice(0, 20)
        hasMoreAtual = itensFiltrados.length > 20
        cursorAtual = null
      }

      setCaixaBase(itensVisiveis)
      setCursor(cursorAtual)
      setHasMore(hasMoreAtual)
      setFiltroAtivo(false)
      setPeriodoResumo({
        ...getCaixaResumoFromItems(itensVisiveis),
      })
    } catch (error) {
      reportRuntimeError('Caixa.carregarPaginaInicial', error, { empresaId, empresaNome })
      setErroTela('Nao foi possivel recarregar os lancamentos do caixa.')
    } finally {
      setLoadingList(false)
    }
  }

  async function aplicarFiltroPeriodo() {
    setLoadingList(true)
    setErroTela('')
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''
    const dataInicialIso = converterDataBrasilParaIso(dataInicial)
    const dataFinalIso = converterDataBrasilParaIso(dataFinal)

    try {
      const itens = await listCaixaEntries({
        dataInicial: dataInicialIso,
        dataFinal: dataFinalIso,
        maxResults: 300,
        empresaId,
        empresaNome,
      })
      const itensVisiveis = filterCaixaItemsByModuleAccess(itens, user)

      setCaixaBase(itensVisiveis)
      setCursor(null)
      setHasMore(false)
      setFiltroAtivo(Boolean(dataInicial || dataFinal))
      setPeriodoResumo({
        ...getCaixaResumoFromItems(itensVisiveis),
      })
    } catch (error) {
      reportRuntimeError('Caixa.aplicarFiltroPeriodo', error, { empresaId, empresaNome, dataInicial: dataInicialIso, dataFinal: dataFinalIso })
      setErroTela('Nao foi possivel aplicar o filtro de periodo.')
    } finally {
      setLoadingList(false)
    }
  }

  async function exportarPdf() {
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''
    const dataInicialIso = converterDataBrasilParaIso(dataInicial)
    const dataFinalIso = converterDataBrasilParaIso(dataFinal)
    const itens = await listCaixaEntries({
      dataInicial: dataInicialIso,
      dataFinal: dataFinalIso,
      maxResults: 1000,
      empresaId,
      empresaNome,
    })
    const itensVisiveis = filterCaixaItemsByModuleAccess(itens, user)
    const totalEntrada = itensVisiveis
      .filter((item) => item.tipo === 'entrada')
      .reduce((sum, item) => sum + Number(item.valor || 0), 0)

    await gerarCaixaPdf({
      itens: itensVisiveis,
      dataInicial: dataInicialIso,
      dataFinal: dataFinalIso,
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
      if (filtroAtivo) {
        await aplicarFiltroPeriodo()
      } else {
        await carregarPaginaInicial()
      }
      setErroTela('')
    } catch (error) {
      reportRuntimeError('Caixa.excluirLancamento', error, { id: item.id, empresaId: item.empresaId, empresaNome: item.empresaNome })
      setErroTela('Nao foi possivel excluir este lancamento.')
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
    setErroTela('')
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
      const nextItems = [...caixaBase, ...filterCaixaItemsByModuleAccess(result.items, user)]
      setCaixaBase(nextItems)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setPeriodoResumo({
        ...getCaixaResumoFromItems(nextItems),
      })
    } catch (error) {
      reportRuntimeError('Caixa.carregarMais', error, { empresaId, empresaNome, cursorId: cursor?.id || '' })
      setErroTela('Nao foi possivel carregar mais lancamentos do caixa.')
    } finally {
      setLoadingList(false)
    }
  }

  async function togglePassageirosViagem(viagem) {
    if (viagemExpandidaId === viagem.id) {
      setViagemExpandidaId('')
      return
    }

    setViagemExpandidaId(viagem.id)

    if (passageirosPorViagem[viagem.id]) {
      return
    }

    setLoadingPassageirosId(viagem.id)

    try {
      const items = await listarPassagensPorViagem(viagem.id, {
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })

      setPassageirosPorViagem((current) => ({
        ...current,
        [viagem.id]: items,
      }))
    } catch (error) {
      reportRuntimeError('Caixa.listarPassagensPorViagem', error, { viagemId: viagem.id })
      setPassageirosPorViagem((current) => ({
        ...current,
        [viagem.id]: [],
      }))
    } finally {
      setLoadingPassageirosId('')
    }
  }

  async function exportarHistoricoViagem(viagemId) {
    setExportingHistoryId(viagemId)

    try {
      const payload = await obterResumoVendaPassagemHorario(viagemId, {
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })

      await abrirResumoVendaHorarioPdf(payload)
    } catch (error) {
      reportRuntimeError('Caixa.exportarHistoricoViagem', error, { viagemId })
      setErroHistorico('Nao foi possivel exportar o PDF desta viagem.')
    } finally {
      setExportingHistoryId('')
    }
  }

  async function excluirHistoricoViagem(item) {
    if (!isRoot) {
      return
    }

    const confirmed = window.confirm(`Excluir o historico do caixa ${item.origem || '-'} - ${item.destino || '-'} em ${item.dataViagem || '-'}?`)

    if (!confirmed) {
      return
    }

    setExportingHistoryId(item.id)

    try {
      await deleteHistoricoCaixaPassagem(item.id, user)
      setHistoricoViagens((current) => current.filter((viagem) => viagem.id !== item.id))
      setPassageirosPorViagem((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      if (viagemExpandidaId === item.id) {
        setViagemExpandidaId('')
      }
      await carregarPaginaInicial()
      setErroHistorico('')
    } catch (error) {
      reportRuntimeError('Caixa.excluirHistoricoViagem', error, { viagemId: item.id })
      setErroHistorico('Nao foi possivel excluir este historico de caixa.')
    } finally {
      setExportingHistoryId('')
    }
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limiteHistorico = subtrairDias(hoje, 7)
  const dataInicialIso = converterDataBrasilParaIso(dataInicial)
  const dataFinalIso = converterDataBrasilParaIso(dataFinal)
  const dataInicialHistorico = dataInicialIso ? parseIsoDateOnly(dataInicialIso) : limiteHistorico
  const dataFinalHistorico = dataFinalIso ? parseIsoDateOnly(dataFinalIso) : hoje
  const historicoViagensFiltrado = historicoViagens.filter((item) => {
    const dataViagem = parseIsoDateOnly(item?.dataViagem)

    if (!dataViagem) {
      return false
    }

    if (dataViagem < limiteHistorico) {
      return false
    }

    if (dataInicialHistorico && dataViagem < dataInicialHistorico) {
      return false
    }

    if (dataFinalHistorico && dataViagem > dataFinalHistorico) {
      return false
    }

    return true
  })

  return (
    <Layout title="Tela de caixa" subtitle="Acompanhamento financeiro e entradas operacionais." icon={<MoneyIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <PageShell
          title="Filtro por periodo"
          subtitle="Defina o intervalo antes de analisar o resumo e as movimentacoes."
          icon={<ListIcon className="h-6 w-6" />}
        >
          <div className="grid gap-3 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Data inicial</span>
              <input
                type="text"
                value={dataInicial}
                onChange={(event) => setDataInicial(formatarInputDataBrasil(event.target.value))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                className="min-h-10 w-full rounded-[1.1rem] border border-blue-200 bg-white px-3 text-[0.9rem] text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Data final</span>
              <input
                type="text"
                value={dataFinal}
                onChange={(event) => setDataFinal(formatarInputDataBrasil(event.target.value))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                className="min-h-10 w-full rounded-[1.1rem] border border-blue-200 bg-white px-3 text-[0.9rem] text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1657d8]">Periodo</p>
              <p className="mt-2 text-xl font-bold text-slate-950">R$ {Number(periodoResumoFiltrado.totalEntrada || 0).toFixed(2)}</p>
              <p className="text-sm text-slate-500">{periodoResumoFiltrado.totalRegistros} registro(s)</p>
              <p className="mt-1 text-xs text-slate-400">
                {dataInicial || dataFinal
                  ? `${dataInicial || '--/--/----'} ate ${dataFinal || '--/--/----'}`
                  : 'Sem filtro por data'}
              </p>
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
        </PageShell>

        <PageShell title="Resumo financeiro" icon={<MoneyIcon className="h-6 w-6" />}>
          {erroTela ? (
            <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {erroTela}
            </div>
          ) : null}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[15rem] flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Origem financeira</span>
              <select
                value={filtroOrigem}
                onChange={(event) => setFiltroOrigem(event.target.value)}
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              >
                <option value="todos">Tudo</option>
                {canAccessFretes ? <option value="fretes">Somente frete</option> : null}
                {canAccessPassagens ? <option value="passagens">Somente passagem</option> : null}
                <option value="outros">Outros</option>
              </select>
            </label>
            <p className="text-xs font-medium text-slate-500">
              O resumo e a lista abaixo acompanham esse filtro.
            </p>
          </div>
          <div className={`grid gap-4 md:grid-cols-2 ${canAccessPassagens ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Entradas</p>
              <p className="mt-2 text-2xl font-bold text-[#1657d8]">R$ {Number(resumoCaixaFiltrado.totalEntrada || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Registros</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumoCaixaFiltrado.totalRegistros}</p>
            </div>
            {canAccessFretes ? (
              <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
                <p className="text-sm text-slate-500">Movimentacoes</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{movimentacoesCount}</p>
              </div>
            ) : null}
            {canAccessFretes ? (
              <div className="rounded-[1.5rem] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f3fff9_100%)] p-4">
                <p className="text-sm text-slate-500">Fretes exibidos</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">R$ {Number(resumoCategorias.fretes.total || 0).toFixed(2)}</p>
                <p className="mt-1 text-sm text-slate-500">{resumoCategorias.fretes.registros} registro(s)</p>
              </div>
            ) : null}
            {canAccessPassagens ? (
              <div className="rounded-[1.5rem] border border-violet-100 bg-[linear-gradient(180deg,#ffffff_0%,#faf5ff_100%)] p-4">
                <p className="text-sm text-slate-500">Passagens exibidas</p>
                <p className="mt-2 text-2xl font-bold text-violet-700">R$ {Number(resumoCategorias.passagens.total || 0).toFixed(2)}</p>
                <p className="mt-1 text-sm text-slate-500">{resumoCategorias.passagens.registros} registro(s)</p>
              </div>
            ) : null}
            <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
              <p className="text-sm text-slate-500">Outros exibidos</p>
              <p className="mt-2 text-2xl font-bold text-slate-700">R$ {Number(resumoCategorias.outros.total || 0).toFixed(2)}</p>
              <p className="mt-1 text-sm text-slate-500">{resumoCategorias.outros.registros} registro(s)</p>
            </div>
          </div>
        </PageShell>

        {canAccessPassagens ? (
          <PageShell
            title="Historico de viagens"
            subtitle="Exibe apenas caixas de passagens ja fechados, com acesso rapido a lista de passageiros."
            icon={<ListIcon className="h-6 w-6" />}
          >
            {erroHistorico ? (
              <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {erroHistorico}
              </div>
            ) : null}

            <div className="space-y-3">
              {historicoViagensFiltrado.map((item) => {
                const passageiros = passageirosPorViagem[item.id] || []
                const expandido = viagemExpandidaId === item.id

                return (
                  <div key={item.id} className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-lg font-bold text-slate-950">
                          {(item.origem || '-') + ' - ' + (item.destino || '-')}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.embarcacaoNome || 'Embarcacao nao informada'} | {item.dataViagem || '-'} {item.horarioSaida || ''}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Abertura: {formatarData(item.caixaAbertoEm)} | Fechamento: {formatarData(item.caixaFechadoEm)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-9 px-3 py-2 text-xs"
                          onClick={() => togglePassageirosViagem(item)}
                          disabled={loadingPassageirosId === item.id}
                        >
                          {loadingPassageirosId === item.id ? 'Carregando...' : expandido ? 'Ocultar passageiros' : 'Ver passageiros'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 px-3 py-2 text-xs"
                          onClick={() => exportarHistoricoViagem(item.id)}
                          disabled={exportingHistoryId === item.id}
                        >
                          {exportingHistoryId === item.id ? 'Gerando PDF...' : 'Exportar PDF'}
                        </Button>
                        {isRoot ? (
                          <Button
                            type="button"
                            variant="danger"
                            className="min-h-9 px-3 py-2 text-xs"
                            onClick={() => excluirHistoricoViagem(item)}
                            disabled={exportingHistoryId === item.id}
                          >
                            {exportingHistoryId === item.id ? 'Excluindo...' : 'Excluir historico'}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {expandido ? (
                      <div className="mt-4 rounded-[1.2rem] border border-blue-100 bg-blue-50/60 p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#1657d8]">
                          Lista de passageiros
                        </p>

                        {passageiros.length > 0 ? (
                          <div className="space-y-2">
                            {passageiros.map((passagem) => (
                              <div key={passagem.id} className="rounded-[1rem] border border-white bg-white px-3 py-2 text-sm text-slate-700">
                                {formatarPassagemHistorico(passagem)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">
                            {loadingPassageirosId === item.id ? 'Carregando passageiros...' : 'Nenhuma passagem encontrada para esta viagem.'}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {historicoViagensFiltrado.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
                  {loadingHistorico ? 'Carregando historico de viagens...' : 'Nenhum caixa de passagens fechado encontrado dentro do periodo exibido. Historicos com mais de 7 dias ficam ocultos aqui.'}
                </div>
              ) : null}
            </div>
          </PageShell>
        ) : null}

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
          <div className="space-y-3">
            {caixa.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{item.origem}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                        getCaixaCategoria(item) === 'fretes'
                          ? 'bg-emerald-100 text-emerald-700'
                          : getCaixaCategoria(item) === 'passagens'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {getCaixaCategoria(item) === 'fretes' ? 'Frete' : getCaixaCategoria(item) === 'passagens' ? 'Passagem' : 'Outro'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{item.encomendaCodigo || 'Sem codigo'}</p>
                  {item.passagemCodigo ? <p className="text-sm text-slate-500">{item.passagemCodigo}</p> : null}
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
