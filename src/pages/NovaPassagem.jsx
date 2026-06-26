import { useEffect, useMemo, useRef, useState } from 'react'
import { BoatIcon, PeopleIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { abrirVendaPassagemHorario, buscarPassageiros, cancelarPassagem, encerrarVendaPassagemHorario, gerarViagemOperacionalId, obterCaixaPassagemAberto, listarPassagensPorViagem, listarViagens, venderPassagem } from '../services/firebase.js'
import { abrirBilhetePassagem } from '../utils/bilhetePassagemPdf.js'
import { abrirJanelaImpressaoTermica } from '../utils/bilheteTermico.js'
import { abrirResumoVendaHorarioPdf } from '../utils/resumoVendaHorarioPdf.js'
import { calcularValorTarifa, isTarifaAntecipada } from '../utils/tarifaUtils.js'

function createTarifaItem(id = Date.now()) {
  return {
    id: `tarifa-${id}`,
    quantidade: 1,
    tarifaTipo: 'Inteira',
    valor: '',
  }
}

const initialForm = {
  dataViagem: new Date().toISOString().slice(0, 10),
  rotaId: '',
  embarcacaoId: '',
  horarioSaida: '',
  passageiroNome: '',
  passageiroDocumento: '',
  passageiroTelefone: '',
  formaPagamento: 'Dinheiro',
  itensVenda: [createTarifaItem('inicial')],
}

function parseDateTimeLocal(dataViagem, horario) {
  if (!dataViagem || !horario) {
    return null
  }

  const [ano, mes, dia] = String(dataViagem).split('-').map(Number)
  const [hora, minuto] = String(horario).split(':').map(Number)

  if (!ano || !mes || !dia || Number.isNaN(hora) || Number.isNaN(minuto)) {
    return null
  }

  return new Date(ano, mes - 1, dia, hora, minuto, 0, 0)
}

function formatarDataHora(valor) {
  if (!valor) {
    return '-'
  }

  const data = typeof valor?.toDate === 'function' ? valor.toDate() : new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

function formatarValorLista(item) {
  if (Number(item?.valor || 0) <= 0) {
    return 'Isento de tarifa'
  }

  return `R$ ${Number(item.valor || 0).toFixed(2)}`
}

function formatarHoraMinuto(valor) {
  if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(valor)
}

function getJanelaVendaStatus(agora, horarioAberturaVenda, horarioSaidaDate) {
  if (!horarioSaidaDate || !horarioAberturaVenda) {
    return {
      podeOperar: false,
      badgeClassName: 'bg-slate-100 text-slate-700',
      label: 'Selecione uma saida',
    }
  }

  if (agora < horarioAberturaVenda) {
    return {
      podeOperar: false,
      badgeClassName: 'bg-amber-100 text-amber-800',
      label: 'Aguardando abertura da janela',
    }
  }

  if (agora >= horarioSaidaDate) {
    return {
      podeOperar: false,
      badgeClassName: 'bg-rose-100 text-rose-700',
      label: 'Horario de venda encerrado',
    }
  }

  return {
    podeOperar: true,
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    label: 'Janela de venda aberta',
  }
}

function getTarifaLineTotal(item) {
  return Number(item?.quantidade || 0) * Number(item?.valor || 0)
}

function getTarifaHistoricoStyle(tarifaTipo = '') {
  const normalized = String(tarifaTipo || '').trim().toLowerCase()

  if (normalized === 'inteira') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (normalized === 'meia') {
    return 'border-amber-200 bg-amber-50 text-amber-800'
  }

  if (normalized === 'gratuidade') {
    return 'border-rose-200 bg-rose-50 text-rose-800'
  }

  if (normalized === 'crianca de colo') {
    return 'border-sky-200 bg-sky-50 text-sky-800'
  }

  if (normalized === 'passagem antecipada') {
    return 'border-slate-300 bg-slate-100 text-slate-700'
  }

  if (normalized === 'idoso') {
    return 'border-orange-200 bg-orange-50 text-orange-800'
  }

  return 'border-blue-100 bg-blue-50 text-[#1657d8]'
}

function parseCapacidade(embarcacao) {
  const bruto = String(embarcacao?.capacidadePassageiros || embarcacao?.capacidade || '').match(/\d+/)
  return bruto ? Number(bruto[0]) : 0
}

function linhaDisponivelNoModulo(linha, modulo) {
  const exibirEm = String(linha?.exibirEm || 'ambos').trim().toLowerCase()
  return exibirEm === 'ambos' || exibirEm === modulo
}

function countGratuidadesOfertadas(passagens = []) {
  return passagens.reduce((total, item) => {
    const normalizedTarifa = String(item?.tarifaTipo || '').trim().toLowerCase()
    const normalizedStatus = String(item?.status || '').trim().toLowerCase()
    if (normalizedTarifa !== 'gratuidade' || normalizedStatus === 'cancelada') {
      return total
    }

    return total + 1
  }, 0)
}

function sumPassagensVendidas(passagens = []) {
  return passagens.reduce((total, item) => {
    const normalizedStatus = String(item?.status || '').trim().toLowerCase()
    if (normalizedStatus === 'cancelada') {
      return total
    }

    return total + Number(item?.valor || 0)
  }, 0)
}

function countPassagensVendidas(passagens = []) {
  return passagens.reduce((total, item) => {
    const normalizedStatus = String(item?.status || '').trim().toLowerCase()
    if (normalizedStatus === 'cancelada') {
      return total
    }

    return total + 1
  }, 0)
}

export default function NovaPassagem() {
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: rotasBase } = useCollectionOnce('rotasValores', { empresaId, empresaNome })
  const { items: embarcacoes } = useCollectionOnce('embarcacoes', { empresaId, empresaNome })
  const [viagensBase, setViagensBase] = useState([])
  const [form, setForm] = useState(() => {
    const persisted = window.sessionStorage.getItem('novaPassagemForm')
    if (!persisted) {
      return initialForm
    }

    try {
      return { ...initialForm, ...JSON.parse(persisted) }
    } catch {
      return initialForm
    }
  })
  const [sugestoes, setSugestoes] = useState([])
  const [loadingSugestoes, setLoadingSugestoes] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [caixaAbertoEmpresa, setCaixaAbertoEmpresa] = useState(null)
  const [passagensCaixaAberto, setPassagensCaixaAberto] = useState([])
  const [passagensEmbarque, setPassagensEmbarque] = useState([])
  const [historicoLimite, setHistoricoLimite] = useState(10)
  const [busyHistoricoId, setBusyHistoricoId] = useState('')
  const [resultado, setResultado] = useState(() => {
    const persisted = window.sessionStorage.getItem('novaPassagemResultado')
    if (!persisted) {
      return null
    }

    try {
      return JSON.parse(persisted)
    } catch {
      return null
    }
  })
  const searchTimeoutRef = useRef(0)

  const viagens = useMemo(() => viagensBase, [viagensBase])
  const rotas = useMemo(
    () => rotasBase.filter((item) => linhaDisponivelNoModulo(item, 'passagens')),
    [rotasBase],
  )
  const rotaSelecionada = useMemo(
    () => rotas.find((item) => item.id === form.rotaId) || null,
    [form.rotaId, rotas],
  )
  const embarcacoesDisponiveis = useMemo(() => {
    if (!rotaSelecionada) {
      return []
    }

    return embarcacoes.filter((item) => {
      const rotasIds = Array.isArray(item.rotasIds) ? item.rotasIds : []

      if (rotasIds.length) {
        return rotasIds.includes(rotaSelecionada.id)
      }

      const rotaEmpresaId = String(rotaSelecionada.empresaId || '').trim()
      const rotaEmpresaNome = String(rotaSelecionada.empresaNome || '').trim().toLowerCase()

      if (rotaEmpresaId) {
        return String(item.empresaId || '').trim() === rotaEmpresaId
      }

      if (rotaEmpresaNome) {
        return String(item.empresaNome || '').trim().toLowerCase() === rotaEmpresaNome
      }

      return true
    })
  }, [embarcacoes, rotaSelecionada])
  const embarcacaoSelecionada = useMemo(
    () => embarcacoesDisponiveis.find((item) => item.id === form.embarcacaoId) || null,
    [embarcacoesDisponiveis, form.embarcacaoId],
  )
  const viagemSelecionada = useMemo(() => {
    if (!form.dataViagem || !rotaSelecionada || !embarcacaoSelecionada || !form.horarioSaida) {
      return null
    }

    const viagemId = gerarViagemOperacionalId({
      rotaId: rotaSelecionada.id,
      embarcacaoId: embarcacaoSelecionada.id,
      dataViagem: form.dataViagem,
      horarioSaida: form.horarioSaida,
    })
    const viagemExistente = viagens.find((item) => item.id === viagemId) || null

    if (viagemExistente) {
      return viagemExistente
    }

    const capacidadeTotal = parseCapacidade(embarcacaoSelecionada)

    return {
      id: viagemId,
      programacaoViagemId: '',
      rotaId: rotaSelecionada.id,
      origem: rotaSelecionada.origem || '',
      destino: rotaSelecionada.destino || '',
      terminalOrigem: rotaSelecionada.terminalOrigem || '',
      terminalDestino: rotaSelecionada.terminalDestino || '',
      embarcacaoId: embarcacaoSelecionada.id,
      embarcacaoNome: embarcacaoSelecionada.nome || '',
      dataViagem: form.dataViagem,
      horarioSaida: form.horarioSaida,
      horarioChegadaPrevisto: '',
      capacidadeTotal,
      vagasVendidas: 0,
      vagasDisponiveis: capacidadeTotal,
      valorPadrao: Number(rotaSelecionada.valor || 0),
      status: 'Fechada',
      duracaoMinutos: Number(rotaSelecionada.duracaoMinutos || 0),
    }
  }, [embarcacaoSelecionada, form.dataViagem, form.horarioSaida, rotaSelecionada, viagens])

  const viagemAberta = ['Aberta', 'Embarcando'].includes(viagemSelecionada?.status)
  const tarifaAntecipada = (form.itensVenda || []).some((item) => isTarifaAntecipada(item.tarifaTipo))
  const statusCaixaLabel = viagemAberta ? 'Caixa Aberto' : 'Caixa Fechado'
  const passagensEmbarqueOrdenadas = useMemo(
    () => [...passagensEmbarque].sort((a, b) => {
      const left = typeof a?.criadoEm?.toDate === 'function' ? a.criadoEm.toDate().getTime() : new Date(a?.criadoEm || 0).getTime()
      const right = typeof b?.criadoEm?.toDate === 'function' ? b.criadoEm.toDate().getTime() : new Date(b?.criadoEm || 0).getTime()
      return right - left
    }),
    [passagensEmbarque],
  )
  const passagensEmbarqueVisiveis = useMemo(
    () => passagensEmbarqueOrdenadas.slice(0, historicoLimite),
    [historicoLimite, passagensEmbarqueOrdenadas],
  )
  const horarioSaidaDate = useMemo(
    () => parseDateTimeLocal(viagemSelecionada?.dataViagem, viagemSelecionada?.horarioSaida),
    [viagemSelecionada?.dataViagem, viagemSelecionada?.horarioSaida],
  )
  const horarioAberturaVenda = useMemo(() => {
    if (!horarioSaidaDate) {
      return null
    }

    return new Date(horarioSaidaDate.getTime() - (30 * 60 * 1000))
  }, [horarioSaidaDate])
  const caixaAbertoNoHorarioSelecionado = Boolean(caixaAbertoEmpresa && caixaAbertoEmpresa.id === viagemSelecionada?.id)
  const caixaAbertoEmOutroHorario = Boolean(caixaAbertoEmpresa && caixaAbertoEmpresa.id !== viagemSelecionada?.id)
  const percentualGratuidade = Number(rotaSelecionada?.percentualGratuidade || 0)
  const capacidadeEmbarcacao = parseCapacidade(embarcacaoSelecionada)
  const gratuidadePrevista = percentualGratuidade > 0
    ? Math.ceil((capacidadeEmbarcacao * percentualGratuidade) / 100)
    : 0
  const gratuidadeOfertada = useMemo(
    () => countGratuidadesOfertadas(passagensEmbarque),
    [passagensEmbarque],
  )
  const gratuidadeSaldoReferencia = Math.max(0, gratuidadePrevista - gratuidadeOfertada)
  const totalVendidoCaixaAberto = useMemo(
    () => sumPassagensVendidas(passagensCaixaAberto),
    [passagensCaixaAberto],
  )
  const quantidadeVendidaCaixaAberto = useMemo(
    () => countPassagensVendidas(passagensCaixaAberto),
    [passagensCaixaAberto],
  )

  useEffect(() => {
    window.sessionStorage.setItem('novaPassagemForm', JSON.stringify(form))
  }, [form])

  useEffect(() => {
    let active = true

    async function carregarCaixaAbertoEmpresa() {
      const item = await obterCaixaPassagemAberto({ empresaId, empresaNome })

      if (active) {
        setCaixaAbertoEmpresa(item)
      }
    }

    void carregarCaixaAbertoEmpresa()

    return () => {
      active = false
    }
  }, [empresaId, empresaNome])

  useEffect(() => {
    window.sessionStorage.setItem('novaPassagemResultado', JSON.stringify(resultado))
  }, [resultado])

  useEffect(() => {
    let active = true

    async function carregarPassagensEmbarque() {
      if (!viagemSelecionada?.id) {
        setPassagensEmbarque([])
        setHistoricoLimite(10)
        return
      }

      const items = await listarPassagensPorViagem(viagemSelecionada.id, { empresaId, empresaNome })

      if (active) {
        setPassagensEmbarque(items)
        setHistoricoLimite(10)
      }
    }

    void carregarPassagensEmbarque()

    return () => {
      active = false
    }
  }, [empresaId, empresaNome, viagemSelecionada?.id])

  useEffect(() => {
    let active = true

    async function carregarPassagensCaixaAberto() {
      if (!caixaAbertoEmpresa?.id) {
        setPassagensCaixaAberto([])
        return
      }

      const items = await listarPassagensPorViagem(caixaAbertoEmpresa.id, { empresaId, empresaNome })

      if (active) {
        setPassagensCaixaAberto(items)
      }
    }

    void carregarPassagensCaixaAberto()

    return () => {
      active = false
    }
  }, [caixaAbertoEmpresa?.id, empresaId, empresaNome])

  function handlePassageiroNomeChange(value) {
    setForm((current) => ({ ...current, passageiroNome: value }))

    const term = String(value || '').trim().toLowerCase()
    setLoadingSugestoes(false)
    window.clearTimeout(searchTimeoutRef.current)

    if (term.length < 2) {
      setSugestoes([])
      return
    }

    setLoadingSugestoes(true)
    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const items = await buscarPassageiros(term, 6, { empresaId, empresaNome })
        setSugestoes(items)
      } finally {
        setLoadingSugestoes(false)
      }
    }, 260)
  }

  function pickPassageiro(item) {
    setForm((current) => ({
      ...current,
      passageiroNome: item.nome || '',
      passageiroDocumento: item.documento || '',
      passageiroTelefone: item.telefone || '',
    }))
    setSugestoes([])
  }

  function atualizarTarifaItem(itemId, updates) {
    setForm((current) => ({
      ...current,
      itensVenda: (current.itensVenda || []).map((item) => (
        item.id === itemId ? { ...item, ...updates } : item
      )),
    }))
  }

  function adicionarTarifaItem() {
    setForm((current) => ({
      ...current,
      itensVenda: [
        ...(current.itensVenda || []),
        createTarifaItem(Date.now() + Math.random()),
      ],
    }))
  }

  function removerTarifaItem(itemId) {
    setForm((current) => ({
      ...current,
      itensVenda: (current.itensVenda || []).length <= 1
        ? current.itensVenda
        : current.itensVenda.filter((item) => item.id !== itemId),
    }))
  }

  function alterarQuantidadeTarifa(itemId, delta) {
    setForm((current) => ({
      ...current,
      itensVenda: (current.itensVenda || []).map((item) => (
        item.id === itemId
          ? { ...item, quantidade: Math.max(1, Number(item.quantidade || 1) + delta) }
          : item
      )),
    }))
  }

  async function recarregarViagens(dataViagem = form.dataViagem) {
    if (!dataViagem) {
      setViagensBase([])
      return []
    }

    const items = await listarViagens({ dataViagem, empresaId, empresaNome })
    setViagensBase(items)
    return items
  }

  async function handleAbrirCaixa() {
    if (!viagemSelecionada) {
      setError('Selecione um horario para abrir o caixa.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const viagemAbertaAtualizada = await abrirVendaPassagemHorario({
        ...viagemSelecionada,
        empresaId,
        empresaNome,
        valorPadrao: viagemSelecionada.valorPadrao,
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
        operadorEmail: user?.email || '',
      })

      await recarregarViagens(viagemSelecionada.dataViagem || form.dataViagem)
      {
        const passagensAtualizadas = await listarPassagensPorViagem(viagemAbertaAtualizada.id, { empresaId, empresaNome })
        setPassagensEmbarque(passagensAtualizadas)
        setPassagensCaixaAberto(passagensAtualizadas)
      }
      setCaixaAbertoEmpresa(viagemAbertaAtualizada)
      setSuccess('Caixa do horario aberto para venda.')
    } catch (runtimeError) {
      setError(runtimeError.message || 'Nao foi possivel abrir o caixa deste horario.')
    } finally {
      setBusy(false)
    }
  }

  async function handleEncerrarCaixa() {
    if (!viagemSelecionada) {
      setError('Selecione um horario para encerrar o caixa.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const resumoFechamento = await encerrarVendaPassagemHorario(viagemSelecionada.id, {
        empresaId,
        empresaNome,
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
      })

      await abrirResumoVendaHorarioPdf(resumoFechamento)
      await recarregarViagens(viagemSelecionada.dataViagem || form.dataViagem)
      setPassagensEmbarque(await listarPassagensPorViagem(viagemSelecionada.id, { empresaId, empresaNome }))
      setCaixaAbertoEmpresa(null)
      setPassagensCaixaAberto([])
      setResultado(null)
      setSuccess('Caixa encerrado e PDF do resumo aberto em outra aba.')
    } catch (runtimeError) {
      setError(runtimeError.message || 'Nao foi possivel encerrar o caixa deste horario.')
    } finally {
      setBusy(false)
    }
  }

  async function handleEstornarPassagem(item) {
    const confirmado = window.confirm(`Confirmar estorno da passagem ${item.codigo || ''}?`)

    if (!confirmado) {
      return
    }

    setBusyHistoricoId(item.id)
    setError('')
    setSuccess('')

    try {
      await cancelarPassagem(item, user)
      {
        const passagensAtualizadas = await listarPassagensPorViagem(viagemSelecionada?.id || '', { empresaId, empresaNome })
        setPassagensEmbarque(passagensAtualizadas)
        if (caixaAbertoEmpresa?.id === viagemSelecionada?.id) {
          setPassagensCaixaAberto(passagensAtualizadas)
        }
      }
      await recarregarViagens(viagemSelecionada?.dataViagem || form.dataViagem)
      setSuccess(`Passagem ${item.codigo} estornada com sucesso.`)
    } catch (runtimeError) {
      setError(runtimeError.message || 'Nao foi possivel estornar a passagem.')
    } finally {
      setBusyHistoricoId('')
    }
  }

  async function concluirVenda(mode = 'save') {
    if (!viagemSelecionada) {
      setError('Selecione uma viagem.')
      return
    }

    if (!viagemAberta) {
      setError('Abra o caixa deste horario antes de vender passagens.')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const passagensVendidas = []

      for (const itemVenda of form.itensVenda || []) {
        const quantidade = Math.max(1, Number(itemVenda.quantidade || 1))

        for (let indice = 0; indice < quantidade; indice += 1) {
          const passagem = await venderPassagem({
            empresaId,
            empresaNome,
            viagemId: viagemSelecionada.id,
            programacaoViagemId: viagemSelecionada.programacaoViagemId || '',
            rotaId: viagemSelecionada.rotaId,
            origem: viagemSelecionada.origem,
            destino: viagemSelecionada.destino,
            terminalOrigem: viagemSelecionada.terminalOrigem,
            terminalDestino: viagemSelecionada.terminalDestino,
            embarcacaoId: viagemSelecionada.embarcacaoId,
            embarcacaoNome: viagemSelecionada.embarcacaoNome,
            dataViagem: viagemSelecionada.dataViagem,
            horarioSaida: viagemSelecionada.horarioSaida,
            capacidadeTotal: viagemSelecionada.capacidadeTotal,
            duracaoMinutos: viagemSelecionada.duracaoMinutos || 0,
            passageiroNome: form.passageiroNome,
            passageiroDocumento: form.passageiroDocumento,
            passageiroTelefone: form.passageiroTelefone,
            tarifaTipo: itemVenda.tarifaTipo,
            valor: Number(itemVenda.valor || calcularValorTarifa(itemVenda.tarifaTipo, viagemSelecionada?.valorPadrao || 0)),
            formaPagamento: form.formaPagamento,
            operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
            operadorEmail: user?.email || '',
          })

          passagensVendidas.push(passagem)
        }
      }

      const selectedDate = form.dataViagem
      setResultado({
        passagens: passagensVendidas,
        ultima: passagensVendidas.at(-1) || null,
      })
      setForm(() => ({
        ...initialForm,
        dataViagem: selectedDate,
        rotaId: rotaSelecionada?.id || '',
        embarcacaoId: embarcacaoSelecionada?.id || '',
        horarioSaida: viagemSelecionada?.horarioSaida || '',
        itensVenda: [
          {
            ...createTarifaItem('reset'),
            valor: calcularValorTarifa('Inteira', viagemSelecionada?.valorPadrao || 0),
          },
        ],
      }))
      setSugestoes([])
      await recarregarViagens(selectedDate)
      {
        const passagensAtualizadas = await listarPassagensPorViagem(viagemSelecionada.id, { empresaId, empresaNome })
        setPassagensEmbarque(passagensAtualizadas)
        if (caixaAbertoEmpresa?.id === viagemSelecionada.id || !caixaAbertoEmpresa) {
          setPassagensCaixaAberto(passagensAtualizadas)
        }
      }
      setSuccess(
        tarifaAntecipada
          ? `${passagensVendidas.length} passagem(ns) registrada(s). Itens antecipados nao consumiram vaga deste horario.`
          : `${passagensVendidas.length} passagem(ns) vendida(s) com sucesso.`,
      )

      if (mode === 'print') {
        passagensVendidas.forEach((item) => abrirJanelaImpressaoTermica(item))
      }

      if (mode === 'pdf') {
        for (const item of passagensVendidas) {
          await abrirBilhetePassagem(item, '_blank')
        }
      }
    } catch (runtimeError) {
      setError(runtimeError.message || 'Nao foi possivel vender a passagem.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let active = true

    async function carregarPorData() {
      if (!form.dataViagem) {
        setViagensBase([])
        return
      }

      const items = await listarViagens({ dataViagem: form.dataViagem, empresaId, empresaNome })

      if (active) {
        setViagensBase(items)
      }
    }

    void carregarPorData()

    return () => {
      active = false
      window.clearTimeout(searchTimeoutRef.current)
    }
  }, [empresaId, empresaNome, form.dataViagem])

  return (
    <Layout
      title="Nova passagem"
      subtitle="Venda de bilhete com linha, embarcacao e horario informados manualmente."
      icon={<BoatIcon className="h-6 w-6" />}
      containerClassName="max-w-[80vw]"
      contentClassName="max-w-[80vw]"
    >
      <div className="space-y-6">
        <div className="rounded-[1.8rem] border border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_55%,#eef5ff_100%)] p-5 shadow-[0_16px_40px_rgba(28,99,231,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#1657d8]">Empresa</p>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950">{empresaNome || 'Empresa nao informada'}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${viagemAberta ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {statusCaixaLabel}
                </span>
                <span className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${caixaAbertoEmpresa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                  Caixa da empresa: {caixaAbertoEmpresa ? 'Em aberto' : 'Fechado'}
                </span>
                <span className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-[#1657d8]">
                  Abertura: {formatarDataHora(viagemSelecionada?.caixaAbertoEm)}
                </span>
                {viagemSelecionada ? (
                  <div className="rounded-full border border-blue-100 bg-white/80 px-4 py-2">
                    <span className="text-sm font-bold tracking-[-0.02em] text-slate-950">
                      {`${viagemSelecionada.origem || '-'} - ${viagemSelecionada.destino || '-'} | ${viagemSelecionada.dataViagem || '-'} ${viagemSelecionada.horarioSaida || ''}`.trim()}
                    </span>
                  </div>
                ) : null}
                <JanelaVendaBadge horarioAberturaVenda={horarioAberturaVenda} horarioSaidaDate={horarioSaidaDate} />
                {viagemSelecionada ? (
                  <span className="inline-flex rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
                    Venda: {formatarHoraMinuto(horarioAberturaVenda)} as {formatarHoraMinuto(horarioSaidaDate)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="success" onClick={handleAbrirCaixa} disabled={busy || !viagemSelecionada || viagemAberta || caixaAbertoEmOutroHorario} className="min-w-[14rem]">
                Abertura do caixa
              </Button>
              <Button type="button" variant="danger" onClick={handleEncerrarCaixa} disabled={busy || !viagemSelecionada || !viagemAberta} className="min-w-[14rem]">
                Fechamento do caixa
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.7fr)]">
          {caixaAbertoEmpresa ? (
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              <p className="font-semibold">Caixa em aberto para esta empresa.</p>
              <p className="mt-1">
                {`${caixaAbertoEmpresa.origem || '-'} - ${caixaAbertoEmpresa.destino || '-'} | ${caixaAbertoEmpresa.embarcacaoNome || '-'} | ${caixaAbertoEmpresa.dataViagem || '-'} ${caixaAbertoEmpresa.horarioSaida || ''}`.trim()}
              </p>
              {caixaAbertoEmOutroHorario ? <p className="mt-1">Feche esse caixa antes de abrir outro horario.</p> : null}
              {caixaAbertoNoHorarioSelecionado ? <p className="mt-1">O horario selecionado ja esta com o caixa aberto.</p> : null}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              Nenhum caixa de passagens esta aberto para esta empresa no momento.
            </div>
          )}

          <div className={`rounded-[1.5rem] px-4 py-4 ${caixaAbertoEmpresa ? 'border border-blue-200 bg-white text-slate-900' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1657d8]">Caixa atual</p>
            <p className="mt-2 text-sm font-medium">Passagens vendidas</p>
            <p className="mt-1 text-2xl font-bold tracking-[-0.03em]">{quantidadeVendidaCaixaAberto}</p>
            <p className="mt-2 text-sm font-medium">Valor vendido neste caixa</p>
            <p className="mt-1 text-3xl font-bold tracking-[-0.03em]">R$ {totalVendidoCaixaAberto.toFixed(2)}</p>
            <p className="mt-2 text-xs text-slate-500">
              {caixaAbertoEmpresa ? 'Total das passagens vendidas no caixa em aberto.' : 'Abra um caixa para acompanhar o total vendido.'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.9fr_0.95fr]">
        <PageShell title="Venda de passagem" subtitle="" showEyebrow={false}>
          <div className="space-y-4">
            <Input
              label="Data da viagem"
              type="date"
              value={form.dataViagem}
              onChange={(event) => setForm((current) => ({ ...current, dataViagem: event.target.value }))}
            />

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Linha</span>
              <select
                value={form.rotaId}
                onChange={(event) => {
                  const rota = rotas.find((item) => item.id === event.target.value) || null
                  setForm((current) => ({
                    ...current,
                    rotaId: event.target.value,
                    embarcacaoId: '',
                    horarioSaida: '',
                    itensVenda: (current.itensVenda || []).map((itemTarifa) => ({
                      ...itemTarifa,
                      valor: calcularValorTarifa(itemTarifa.tarifaTipo, Number(rota?.valor || 0)),
                    })),
                  }))
                }}
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Selecione a linha</option>
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
                onChange={(event) => setForm((current) => ({ ...current, embarcacaoId: event.target.value }))}
                disabled={!rotaSelecionada}
                className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">{rotaSelecionada ? 'Selecione a embarcacao' : 'Selecione a linha primeiro'}</option>
                {embarcacoesDisponiveis.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Horario de saida"
              type="time"
              value={form.horarioSaida}
              onChange={(event) => setForm((current) => ({ ...current, horarioSaida: event.target.value }))}
              required
            />

            {embarcacaoSelecionada ? (
              <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-700">
                <p>
                  Capacidade da embarcacao selecionada: <span className="font-semibold text-slate-950">{capacidadeEmbarcacao || 0}</span>
                </p>
                <p className="mt-2">
                  Referencia de gratuidade nesta linha: <span className="font-semibold text-slate-950">{percentualGratuidade.toFixed(2)}%</span>
                </p>
                <p className="mt-1">
                  Referencia calculada: <span className="font-semibold text-slate-950">{gratuidadePrevista}</span> | Ja ofertadas: <span className="font-semibold text-slate-950">{gratuidadeOfertada}</span> | Saldo de referencia: <span className="font-semibold text-slate-950">{gratuidadeSaldoReferencia}</span>
                </p>
              </div>
            ) : null}

            <div className="rounded-[1.5rem] border border-blue-100 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1657d8]">
                  <PeopleIcon className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <Input label="Passageiro" value={form.passageiroNome} onChange={(event) => handlePassageiroNomeChange(event.target.value)} placeholder="Nome do passageiro" />
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Input label="Documento" value={form.passageiroDocumento} onChange={(event) => setForm((current) => ({ ...current, passageiroDocumento: event.target.value }))} placeholder="CPF ou documento" />
                    <Input label="Telefone" value={form.passageiroTelefone} onChange={(event) => setForm((current) => ({ ...current, passageiroTelefone: event.target.value }))} placeholder="Telefone" />
                  </div>
                </div>
              </div>

              {loadingSugestoes ? <p className="mt-3 text-sm text-slate-500">Buscando passageiros...</p> : null}

              {sugestoes.length > 0 ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {sugestoes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pickPassageiro(item)}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition hover:bg-white"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{item.nome}</span>
                        <span className="block text-xs text-slate-500">{item.documento || item.telefone || 'Sem documento'}</span>
                      </span>
                      <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#1c63e7]">Usar</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Tarifas da venda</p>
                  <p className="text-xs text-slate-500">Adicione varias passagens na mesma compra.</p>
                </div>
                <Button type="button" variant="secondary" onClick={adicionarTarifaItem}>
                  + Passagem
                </Button>
              </div>

              {(form.itensVenda || []).map((itemVenda, index) => (
                <div key={itemVenda.id} className="grid gap-3 rounded-[1.3rem] border border-blue-100 bg-white p-3 md:grid-cols-[auto_1.1fr_0.8fr_auto]">
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    <span>Qtd.</span>
                    <div className="flex min-h-10 items-center gap-2 rounded-[1.1rem] border border-blue-200 bg-white px-2">
                      <button
                        type="button"
                        onClick={() => alterarQuantidadeTarifa(itemVenda.id, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-[#1657d8] transition hover:bg-blue-100"
                      >
                        -
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-bold text-slate-900">{itemVenda.quantidade || 1}</span>
                      <button
                        type="button"
                        onClick={() => alterarQuantidadeTarifa(itemVenda.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-[#1657d8] transition hover:bg-blue-100"
                      >
                        +
                      </button>
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    <span>Tarifa {index + 1}</span>
                    <select
                      value={itemVenda.tarifaTipo}
                      onChange={(event) => {
                        const nextTarifaTipo = event.target.value
                        atualizarTarifaItem(itemVenda.id, {
                          tarifaTipo: nextTarifaTipo,
                          valor: calcularValorTarifa(nextTarifaTipo, viagemSelecionada?.valorPadrao || 0),
                        })
                      }}
                      className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                    >
                      {['Inteira', 'Meia', 'Passagem antecipada', 'Gratuidade', 'Estudante', 'Crianca de colo', 'Idoso'].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Input
                    label="Valor"
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemVenda.valor ?? ''}
                    onChange={(event) => atualizarTarifaItem(itemVenda.id, { valor: event.target.value })}
                  />

                  <div className="flex items-end">
                    <div className="flex flex-col gap-2">
                      <Button type="button" variant="ghost" onClick={() => removerTarifaItem(itemVenda.id)} disabled={(form.itensVenda || []).length <= 1}>
                        Remover
                      </Button>
                      <span className="text-right text-xs font-semibold text-slate-500">
                        Total: R$ {getTarifaLineTotal(itemVenda).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:max-w-[18rem]">
                <span>Pagamento</span>
                <select
                  value={form.formaPagamento}
                  onChange={(event) => setForm((current) => ({ ...current, formaPagamento: event.target.value }))}
                  className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                >
                  {['Dinheiro', 'PIX', 'Cartao', 'Fiado'].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {tarifaAntecipada ? (
              <div className="rounded-[1.4rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
                `Passagem antecipada` nao consome vaga da capacidade atual desta lancha.
              </div>
            ) : null}

            {error ? <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{error}</div> : null}
            {success ? <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="ghost" onClick={() => {
                window.sessionStorage.removeItem('novaPassagemForm')
                window.sessionStorage.removeItem('novaPassagemResultado')
                setForm(initialForm)
                setResultado(null)
                setSugestoes([])
                setViagensBase([])
                setError('')
                setSuccess('')
              }} disabled={busy}>
                Limpar tela
              </Button>
              <Button type="button" onClick={() => concluirVenda('save')} disabled={busy || !viagemSelecionada || !viagemAberta}>
                {busy ? 'Vendendo...' : 'Vender passagem'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => concluirVenda('print')} disabled={busy || !viagemSelecionada || !viagemAberta}>
                Vender e imprimir
              </Button>
              <Button type="button" variant="ghost" onClick={() => concluirVenda('pdf')} disabled={busy || !viagemSelecionada || !viagemAberta}>
                Vender e gerar PDF
              </Button>
            </div>
          </div>
        </PageShell>

        <PageShell title="Resumo da saida" subtitle="" showEyebrow={false} titleClassName="whitespace-nowrap text-[2rem]">
          <div className="space-y-4">
            <Resumo label="Origem" value={viagemSelecionada?.origem || '-'} />
            <Resumo label="Destino" value={viagemSelecionada?.destino || '-'} />
            <Resumo label="Data" value={viagemSelecionada?.dataViagem || '-'} />
            <Resumo label="Horario" value={viagemSelecionada?.horarioSaida || '-'} />
            <Resumo label="Caixa" value={statusCaixaLabel} />
            <Resumo label="Aberto em" value={formatarDataHora(viagemSelecionada?.caixaAbertoEm)} />
            <Resumo label="Janela de venda" value={`${formatarHoraMinuto(horarioAberturaVenda)} as ${formatarHoraMinuto(horarioSaidaDate)}`} />
            <Resumo label="Embarcacao" value={viagemSelecionada?.embarcacaoNome || '-'} />
            <Resumo label="Vagas disponiveis" value={String(viagemSelecionada?.vagasDisponiveis ?? '-')} />
            <Resumo label="Passagens vendidas" value={String(viagemSelecionada?.vagasVendidas ?? '-')} />
            <Resumo label="Gratuidade da linha" value={`${percentualGratuidade.toFixed(2)}%`} />
            <Resumo label="Referencia de gratuidades" value={String(gratuidadePrevista)} />
            <Resumo label="Gratuidades ofertadas" value={String(gratuidadeOfertada)} />
            <Resumo label="Saldo de referencia" value={String(gratuidadeSaldoReferencia)} />
            <Resumo label="Tarifa base" value={`R$ ${Number(viagemSelecionada?.valorPadrao || 0).toFixed(2)}`} />
            <Resumo
              label="Total da venda"
              value={`R$ ${Number((form.itensVenda || []).reduce((total, item) => total + getTarifaLineTotal(item), 0)).toFixed(2)}`}
            />

          </div>
        </PageShell>

        <PageShell title="Historico do embarque" subtitle="" showEyebrow={false} titleClassName="whitespace-nowrap text-[2rem]">
          <div className="space-y-2">
            {passagensEmbarqueVisiveis.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma passagem vendida neste embarque ainda.</p>
            ) : (
              passagensEmbarqueVisiveis.map((item) => (
                <div key={item.id} className={`rounded-2xl border px-3 py-3 ${getTarifaHistoricoStyle(item.tarifaTipo)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.tarifaTipo || 'Tarifa'}</p>
                      <p className="text-xs text-slate-500">{item.codigo || '-'}{item.passageiroNome ? ` • ${item.passageiroNome}` : ''}</p>
                      <p className="text-xs text-slate-400">{item.formaPagamento || 'Pagamento nao informado'}</p>
                    </div>
                    <p className="text-sm font-bold text-[#1657d8]">{formatarValorLista(item)}</p>
                  </div>

                  <div className="mt-2 flex items-center gap-1">
                    <Button type="button" variant="ghost" className="min-h-5 px-1.5 py-0 text-[9px] leading-none" onClick={() => abrirJanelaImpressaoTermica(item)}>
                      Imprimir termico
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="min-h-5 px-1.5 py-0 text-[9px] leading-none"
                      onClick={() => handleEstornarPassagem(item)}
                      disabled={busyHistoricoId === item.id || item.status === 'Cancelada' || item.status === 'Embarcado'}
                    >
                      {busyHistoricoId === item.id ? 'Estornando...' : item.status === 'Cancelada' ? 'Estornada' : 'Estornar venda'}
                    </Button>
                  </div>
                </div>
              ))
            )}

            {passagensEmbarqueOrdenadas.length > historicoLimite ? (
              <div className="pt-2">
                <Button type="button" variant="secondary" onClick={() => setHistoricoLimite((current) => current + 10)}>
                  Carregar mais
                </Button>
              </div>
            ) : null}
          </div>
        </PageShell>
      </div>
      </div>
    </Layout>
  )
}

function Resumo({ label, value }) {
  return (
    <div className="rounded-[1.3rem] border border-blue-100 bg-blue-50/60 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1657d8]">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function JanelaVendaBadge({ horarioAberturaVenda, horarioSaidaDate }) {
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgora(new Date())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const status = getJanelaVendaStatus(agora, horarioAberturaVenda, horarioSaidaDate)

  return (
    <span className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${status.badgeClassName}`}>
      {status.label}
    </span>
  )
}
