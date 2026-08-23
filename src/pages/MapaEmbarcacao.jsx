import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BoatIcon, PeopleIcon } from '../components/AppIcons.jsx'
import Layout from '../components/Layout.jsx'
import useAuth from '../context/useAuth.js'
import { abrirVendaPassagemHorario, encerrarVendaPassagemHorario, getViagemById, listarPassagensPorViagem, recuperarCaixaLocalAbertoDaSaida, venderPassagem } from '../services/firebase.js'
import { formatDateAndTimeBR } from '../utils/date.js'
import { calcularValorTarifa, isTarifaAntecipada } from '../utils/tarifaUtils.js'

const MODALIDADES = {
  inteira: { label: 'Pagantes', shortLabel: 'Pagante', color: '#1769e8', light: '#e9f1ff', symbol: 'P' },
  meia: { label: 'Meias', shortLabel: 'Meia', color: '#0ea5e9', light: '#e0f2fe', symbol: '½' },
  gratuidade: { label: 'Gratuidades', shortLabel: 'Gratuidade', color: '#3b82f6', light: '#eaf2ff', symbol: 'G' },
  estudante: { label: 'Estudantes', shortLabel: 'Estudante', color: '#8b5cf6', light: '#f2eefe', symbol: 'E' },
  'crianca de colo': { label: 'Crianças de colo', shortLabel: 'Colo', color: '#ec4899', light: '#fce7f3', symbol: 'C' },
  crianca: { label: 'Crianças', shortLabel: 'Criança', color: '#f97316', light: '#fff1e8', symbol: 'C' },
  idoso: { label: 'Idosos', shortLabel: 'Idoso', color: '#d97706', light: '#fef3c7', symbol: 'I' },
  bloqueado: { label: 'Bloqueados', shortLabel: 'Bloqueado', color: '#64748b', light: '#f1f5f9', symbol: '×' },
}

const LIVRE = { label: 'Livres', shortLabel: 'Livre', color: '#059669', light: '#ecfdf5', symbol: '✓' }
const TARIFAS_RAPIDAS = ['Inteira', 'Meia', 'Gratuidade', 'Estudante', 'Crianca de colo', 'Idoso']
const PAGAMENTOS_RAPIDOS = ['Dinheiro', 'Pix', 'Cartao']

function normalizarModalidade(passagem) {
  if (String(passagem?.status || '').toLowerCase() === 'bloqueado') return 'bloqueado'
  const valor = String(passagem?.tarifaTipo || 'Inteira').trim().toLowerCase()
  return MODALIDADES[valor] ? valor : 'inteira'
}

function montarAssentos(capacidade, passagens) {
  const ocupadas = new Map()
  const semAssento = []

  passagens.forEach((passagem) => {
    const numero = Number(String(passagem.assentoCodigo || passagem.assento || '').match(/\d+/)?.[0])
    if (numero >= 1 && numero <= capacidade && !ocupadas.has(numero)) ocupadas.set(numero, passagem)
    else semAssento.push(passagem)
  })

  const numerosLivres = Array.from({ length: capacidade }, (_, index) => index + 1).filter((numero) => !ocupadas.has(numero))
  semAssento.slice(0, numerosLivres.length).forEach((passagem, index) => ocupadas.set(numerosLivres[index], passagem))

  return Array.from({ length: capacidade }, (_, index) => {
    const numero = index + 1
    const passagem = ocupadas.get(numero) || null
    return { numero, passagem, modalidade: passagem ? normalizarModalidade(passagem) : 'livre' }
  })
}

function SeatIcon() {
  return <span aria-hidden="true" className="text-[13px] leading-none">▰</span>
}

export default function MapaEmbarcacao() {
  const { viagemId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const [viagem, setViagem] = useState(null)
  const [passagens, setPassagens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assentoVenda, setAssentoVenda] = useState(null)
  const [tarifaTipo, setTarifaTipo] = useState('Inteira')
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro')
  const [dadosPassageiro, setDadosPassageiro] = useState({ nome: '', documento: '' })
  const [vendendo, setVendendo] = useState(false)
  const [operandoCaixa, setOperandoCaixa] = useState(false)
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    let active = true
    const viagemFallback = {
      id: viagemId,
      rotaId: searchParams.get('rotaId') || '',
      embarcacaoId: searchParams.get('embarcacaoId') || '',
      embarcacaoNome: searchParams.get('embarcacaoNome') || '',
      origem: searchParams.get('origem') || '',
      destino: searchParams.get('destino') || '',
      dataViagem: searchParams.get('dataViagem') || '',
      horarioSaida: searchParams.get('horarioSaida') || '',
      capacidadeTotal: Number(searchParams.get('capacidadeTotal') || 0),
      valorPadrao: Number(searchParams.get('valorPadrao') || 0),
      status: 'Fechada',
    }
    const possuiFallback = Boolean(viagemFallback.embarcacaoId && viagemFallback.capacidadeTotal)

    Promise.all([
      getViagemById(viagemId, { empresaId, empresaNome }),
      listarPassagensPorViagem(viagemId, { empresaId, empresaNome }),
    ]).then(async ([viagemAtual, passagensAtuais]) => {
      if (!active) return
      const caixaLocalRecuperado = !viagemAtual && possuiFallback
        ? await recuperarCaixaLocalAbertoDaSaida(viagemId, viagemFallback)
        : null
      if (!active) return
      setViagem(viagemAtual || caixaLocalRecuperado || (possuiFallback ? viagemFallback : null))
      setPassagens((passagensAtuais || []).filter((item) => String(item.status || '').toLowerCase() !== 'cancelada' && !isTarifaAntecipada(item.tarifaTipo)))
      if (!viagemAtual && !possuiFallback) setError('Viagem não encontrada ou indisponível para esta empresa.')
    }).catch((runtimeError) => {
      if (active) setError(runtimeError.message || 'Não foi possível carregar o mapa da embarcação.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [empresaId, empresaNome, searchParams, viagemId])

  const capacidade = Math.max(0, Number(viagem?.capacidadeTotal || 0))
  const assentos = useMemo(() => montarAssentos(capacidade, passagens), [capacidade, passagens])
  const totais = useMemo(() => assentos.reduce((acc, assento) => {
    acc[assento.modalidade] = (acc[assento.modalidade] || 0) + 1
    return acc
  }, {}), [assentos])
  const modalidadesVisiveis = Object.entries(MODALIDADES).filter(([key]) => totais[key])
  const pedeIdentificacao = ['Gratuidade', 'Estudante', 'Idoso'].includes(tarifaTipo)
  const caixaAberto = Boolean(viagem?.caixaAbertoEm && !viagem?.caixaFechadoEm)

  async function abrirCaixa() {
    if (!viagem) return
    setOperandoCaixa(true)
    setError('')
    try {
      const atualizada = await abrirVendaPassagemHorario({
        ...viagem,
        empresaId,
        empresaNome,
        valorPadrao: viagem.valorPadrao || 0,
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
        operadorEmail: user?.email || '',
      })
      setViagem(atualizada)
      setSucesso('Caixa aberto. Toque em um assento verde para vender.')
    } catch (runtimeError) {
      setError(runtimeError.message || 'Não foi possível abrir o caixa desta saída.')
    } finally {
      setOperandoCaixa(false)
    }
  }

  async function fecharCaixa() {
    if (!viagem?.id) return
    setOperandoCaixa(true)
    setError('')
    try {
      await encerrarVendaPassagemHorario(viagem.id, { empresaId, empresaNome, operadorNome: user?.nome || user?.email || 'Operador', confirmacaoManual: true })
      setViagem((current) => ({ ...current, status: 'Encerrada', caixaFechadoEm: new Date().toISOString() }))
      setSucesso('Caixa encerrado com sucesso.')
    } catch (runtimeError) {
      setError(runtimeError.message || 'Não foi possível encerrar o caixa.')
    } finally {
      setOperandoCaixa(false)
    }
  }

  async function confirmarVendaRapida() {
    if (!assentoVenda || !viagem) return
    if (!caixaAberto) {
      setError('Abra o caixa deste horário antes de vender pelo mapa.')
      return
    }

    setVendendo(true)
    setError('')
    try {
      const passagensAtuais = await listarPassagensPorViagem(viagem.id, { empresaId, empresaNome })
      const codigoAssento = String(assentoVenda).padStart(2, '0')
      const vagaJaOcupada = passagensAtuais.some((item) => String(item.status || '').toLowerCase() !== 'cancelada' && String(item.assentoCodigo || '').padStart(2, '0') === codigoAssento)
      if (vagaJaOcupada) throw new Error(`O assento ${codigoAssento} acabou de ser ocupado. Escolha outra vaga.`)

      const passagem = await venderPassagem({
        empresaId,
        empresaNome,
        viagemId: viagem.id,
        programacaoViagemId: viagem.programacaoViagemId || '',
        rotaId: viagem.rotaId || '',
        origem: viagem.origem || '',
        destino: viagem.destino || '',
        terminalOrigem: viagem.terminalOrigem || '',
        terminalDestino: viagem.terminalDestino || '',
        embarcacaoId: viagem.embarcacaoId || '',
        embarcacaoNome: viagem.embarcacaoNome || '',
        dataViagem: viagem.dataViagem || '',
        horarioSaida: viagem.horarioSaida || '',
        capacidadeTotal: viagem.capacidadeTotal || 0,
        duracaoMinutos: viagem.duracaoMinutos || 0,
        assentoCodigo: codigoAssento,
        passageiroNome: dadosPassageiro.nome,
        passageiroDocumento: dadosPassageiro.documento,
        tarifaTipo,
        valor: Number(calcularValorTarifa(tarifaTipo, viagem.valorPadrao || 0) || 0),
        formaPagamento,
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
        operadorEmail: user?.email || '',
      })
      setPassagens((current) => [...current, passagem])
      setSucesso(`Assento ${String(assentoVenda).padStart(2, '0')} vendido.`)
      setAssentoVenda(null)
      setTarifaTipo('Inteira')
      setFormaPagamento('Dinheiro')
      setDadosPassageiro({ nome: '', documento: '' })
      window.setTimeout(() => setSucesso(''), 2500)
    } catch (runtimeError) {
      setError(runtimeError.message || 'Não foi possível concluir a venda.')
    } finally {
      setVendendo(false)
    }
  }

  return (
    <Layout title="Mapa da embarcação" subtitle="Ocupação por assento e modalidade de passagem." icon={<BoatIcon className="h-6 w-6" />} containerClassName="max-w-[92rem]">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-[1.8rem] border border-blue-100 bg-white shadow-[0_18px_50px_rgba(15,45,90,0.08)]">
          <div className="bg-[linear-gradient(135deg,#06275d,#0a4da8)] px-5 py-5 text-white sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Embarcação</p>
                <h2 className="mt-1 text-2xl font-bold">{viagem?.embarcacaoNome || (loading ? 'Carregando...' : 'Não informada')}</h2>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur">
                <strong>{viagem?.origem || 'Origem'}</strong> <span className="px-2 text-blue-200">→</span> <strong>{viagem?.destino || 'Destino'}</strong>
                <p className="mt-1 text-blue-100">{formatDateAndTimeBR(viagem?.dataViagem, viagem?.horarioSaida)}</p>
              </div>
            </div>
          </div>

          {error ? <div className="m-5 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div> : null}
          {sucesso ? <div className="m-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{sucesso}</div> : null}

          {!error && !loading ? <div className="p-4 sm:p-7">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Summary label="Capacidade" value={capacidade} color="#0a2d61" />
              <Summary label="Passageiros" value={passagens.length} color="#1769e8" />
              <Summary label="Livres" value={totais.livre || 0} color={LIVRE.color} />
              <Summary label="Ocupação" value={`${capacidade ? Math.round((passagens.length / capacidade) * 100) : 0}%`} color="#8b5cf6" />
            </div>

            <div className={`mt-4 flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${caixaAberto ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div><p className={`text-sm font-black ${caixaAberto ? 'text-emerald-800' : 'text-amber-800'}`}>{caixaAberto ? 'Caixa aberto para venda' : 'Caixa fechado'}</p><p className="mt-1 text-xs text-slate-600">{caixaAberto ? 'Toque em uma vaga verde para vender.' : 'Abra o caixa para liberar a venda pelos assentos.'}</p></div>
              {caixaAberto ? <button type="button" onClick={fecharCaixa} disabled={operandoCaixa} className="min-h-11 rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 disabled:opacity-60">{operandoCaixa ? 'Encerrando...' : 'Encerrar caixa'}</button> : <button type="button" onClick={abrirCaixa} disabled={operandoCaixa} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">{operandoCaixa ? 'Abrindo...' : 'Abrir caixa e vender'}</button>}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
              {[['livre', LIVRE], ...modalidadesVisiveis.map(([key, config]) => [key, config])].map(([key, config]) => (
                <span key={key} className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded" style={{ background: config.color }} />{config.shortLabel} ({totais[key] || 0})</span>
              ))}
            </div>

            <div className="relative mx-auto mt-7 max-w-3xl rounded-[42%_42%_18%_18%/7%_7%_5%_5%] border-2 border-blue-200 bg-[linear-gradient(180deg,#f3f8ff_0%,#ffffff_14%,#ffffff_88%,#eef6ff_100%)] px-4 pb-10 pt-12 sm:px-10">
              <div className="absolute left-1/2 top-3 -translate-x-1/2 text-sm font-black uppercase tracking-[0.18em] text-[#0a2d61]">Proa</div>
              <div className="pointer-events-none absolute bottom-4 left-1/2 top-14 w-px -translate-x-1/2 bg-blue-100" />
              <div className="grid grid-cols-4 gap-x-4 gap-y-3 sm:gap-x-12">
                {assentos.map((assento) => {
                  const config = assento.modalidade === 'livre' ? LIVRE : MODALIDADES[assento.modalidade]
                  return (
                    <button key={assento.numero} type="button" disabled={assento.modalidade !== 'livre' || !caixaAberto} onClick={() => { setAssentoVenda(assento.numero); setError('') }} aria-label={`Assento ${assento.numero}: ${config.shortLabel}. Toque para vender.`} title={assento.passagem?.passageiroNome || (assento.modalidade === 'livre' ? (caixaAberto ? 'Toque para vender' : 'Abra o caixa para vender') : config.shortLabel)} className={`relative z-[1] flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-extrabold transition ${assento.modalidade === 'livre' && caixaAberto ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:ring-4 focus:ring-emerald-200' : 'cursor-not-allowed text-white disabled:opacity-65'}`} style={{ borderColor: config.color, background: assento.modalidade === 'livre' ? config.light : config.color, color: assento.modalidade === 'livre' ? config.color : 'white' }}>
                      <span>{String(assento.numero).padStart(2, '0')}</span><span>{assento.modalidade === 'livre' ? <SeatIcon /> : config.symbol}</span>
                    </button>
                  )
                })}
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm font-black uppercase tracking-[0.18em] text-[#0a2d61]">Popa</div>
            </div>

            <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-800">{caixaAberto ? 'Toque em qualquer assento verde para iniciar a venda nessa vaga.' : 'Abra o caixa para liberar os assentos.'}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Link to="/nova-passagem" className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#062f70] px-5 py-3 font-bold text-white shadow-[0_12px_25px_rgba(6,47,112,0.2)]">
                <PeopleIcon className="h-5 w-5" />Voltar para venda de passagem
              </Link>
              <Link to={`/manifesto/${viagemId}`} className="flex min-h-14 items-center justify-center rounded-2xl border border-blue-200 bg-white px-5 py-3 font-bold text-[#0a2d61]">Ver passageiros ({passagens.length})</Link>
            </div>
          </div> : null}
        </section>
      </div>

      {assentoVenda ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssentoVenda(null) }}>
          <section role="dialog" aria-modal="true" aria-label={`Venda do assento ${assentoVenda}`} className="w-full max-w-lg rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Venda rápida</p><h3 className="mt-1 text-2xl font-black text-slate-950">Assento {String(assentoVenda).padStart(2, '0')}</h3></div>
              <button type="button" onClick={() => setAssentoVenda(null)} className="h-11 w-11 rounded-full bg-slate-100 text-xl text-slate-600" aria-label="Fechar">×</button>
            </div>

            <p className="mt-5 text-sm font-bold text-slate-700">Modalidade</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TARIFAS_RAPIDAS.map((item) => <button key={item} type="button" onClick={() => setTarifaTipo(item)} className={`min-h-12 rounded-xl border px-2 py-2 text-sm font-bold ${tarifaTipo === item ? 'border-[#1769e8] bg-[#1769e8] text-white' : 'border-blue-100 bg-blue-50 text-slate-700'}`}>{item}</button>)}
            </div>

            {pedeIdentificacao ? <div className="mt-4 rounded-2xl bg-amber-50 p-3">
              <p className="mb-2 text-xs font-bold text-amber-800">Identificação opcional</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={dadosPassageiro.nome} onChange={(event) => setDadosPassageiro((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome, se necessário" className="min-h-11 rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none" />
                <input value={dadosPassageiro.documento} onChange={(event) => setDadosPassageiro((current) => ({ ...current, documento: event.target.value }))} placeholder="Documento, se necessário" className="min-h-11 rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none" />
              </div>
            </div> : null}

            <p className="mt-4 text-sm font-bold text-slate-700">Pagamento</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PAGAMENTOS_RAPIDOS.map((item) => <button key={item} type="button" onClick={() => setFormaPagamento(item)} className={`min-h-11 rounded-xl border px-2 text-sm font-bold ${formaPagamento === item ? 'border-[#0a2d61] bg-[#0a2d61] text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{item}</button>)}
            </div>

            <button type="button" onClick={confirmarVendaRapida} disabled={vendendo} className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 text-base font-black text-white shadow-[0_12px_24px_rgba(5,150,105,0.25)] disabled:opacity-60">
              {vendendo ? 'Vendendo...' : `Confirmar • ${calcularValorTarifa(tarifaTipo, viagem?.valorPadrao || 0) ? `R$ ${Number(calcularValorTarifa(tarifaTipo, viagem?.valorPadrao || 0)).toFixed(2)}` : 'Isento'}`}
            </button>
          </section>
        </div>
      ) : null}
    </Layout>
  )
}

function Summary({ label, value, color }) {
  return <div className="rounded-2xl border border-blue-100 bg-slate-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p><p className="mt-1 text-2xl font-black" style={{ color }}>{value}</p></div>
}
