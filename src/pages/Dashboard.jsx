import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardIcon, ListIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { getPassagensResumo, listCaixaEntries, listCollectionOnce } from '../services/firebase.js'
import { hasFreteAccess, hasPassagemAccess } from '../utils/accessControl.js'
import { filterCaixaItemsByModuleAccess, getCaixaResumoFromItems } from '../utils/caixaAccess.js'
import { getEncomendasDashboardMetrics } from '../utils/encomendaStatus.js'
import { reportRuntimeError } from '../utils/runtimeDiagnostics.js'

function getCurrentDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseUnknownDate(value) {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate()
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isWithinPeriod(value, startDate, endDate) {
  const parsed = parseUnknownDate(value)

  if (!parsed) {
    return false
  }

  if (startDate && parsed < startDate) {
    return false
  }

  if (endDate && parsed > endDate) {
    return false
  }

  return true
}

function formatCardValueWithTotal(label, total) {
  if (!label || label === '-') {
    return '-'
  }

  if (!Number.isFinite(Number(total))) {
    return String(label)
  }

  return `${label}\n${Number(total)}`
}

function SectionHeader({ eyebrow, title }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#1657d8]">{eyebrow}</p>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
      </div>
    </div>
  )
}

function DistributionChartCard({ title, description, items = [], accentClassName = 'bg-[#1657d8]', valueClassName = 'text-slate-950' }) {
  const maxValue = Math.max(...items.map((item) => Number(item?.total || 0)), 0)

  return (
    <Card className="border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
      <div className="space-y-1">
        <p className="text-[1.95rem] font-black uppercase leading-none tracking-[-0.03em] text-[#1657d8]">{title}</p>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const total = Number(item?.total || 0)
          const widthPercent = maxValue > 0 ? Math.max(8, (total / maxValue) * 100) : 0

          return (
            <div key={item.label} className="grid grid-cols-[104px_minmax(0,1fr)_48px] items-center gap-3">
              <span className="text-sm font-medium text-slate-600">{item.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${accentClassName}`}
                  style={{ width: `${widthPercent}%`, opacity: total > 0 ? 1 : 0.22 }}
                />
              </div>
              <span className={`text-right text-sm font-semibold ${valueClassName}`}>{total}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function StatCard({
  label,
  value,
  hint,
  className = '',
  labelClassName = 'text-[#1657d8]',
  valueClassName = 'text-slate-950',
  valueSizeClassName = 'text-[2rem] sm:text-[2.35rem]',
}) {
  return (
    <Card className={`min-h-[184px] border px-5 py-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)] ${className || 'border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]'}`}>
      <div className="flex h-full flex-col text-center">
        <p className={`text-[1.95rem] font-black uppercase leading-none tracking-[-0.03em] ${labelClassName}`}>{label}</p>
        <h3 className={`mt-4 whitespace-pre-line break-words font-semibold leading-[1.05] tracking-[-0.04em] ${valueClassName} ${valueSizeClassName}`}>{value}</h3>
        {hint ? <p className="mt-auto pt-4 text-sm leading-6 text-slate-500">{hint}</p> : null}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)
  const [todayKey, setTodayKey] = useState(() => getCurrentDateKey())
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [metrics, setMetrics] = useState({
    encomendas: 0,
    clientes: 0,
    terminais: 0,
    passagens: 0,
    viagensAtivas: 0,
    embarcadas: 0,
    totalEntrada: 0,
    encomendasEmFluxo: 0,
    encomendasEmRetirada: 0,
    encomendasEntregues: 0,
    horarioPico: '-',
    embarcacaoDestaque: '-',
    embarcacaoDestaqueTotal: 0,
    taxaOcupacao: 0,
    percentualGratuidades: 0,
    diasMaiorMovimento: '-',
    diasMaiorMovimentoTotal: 0,
    diasMaiorMovimentoChart: [],
    horariosPicoChart: [],
  })
  const effectiveStartDate = startDateFilter || endDateFilter || todayKey
  const effectiveEndDate = endDateFilter || startDateFilter || todayKey
  const periodStart = useMemo(() => new Date(`${effectiveStartDate}T00:00:00`), [effectiveStartDate])
  const periodEnd = useMemo(() => new Date(`${effectiveEndDate}T23:59:59.999`), [effectiveEndDate])

  useEffect(() => {
    if (startDateFilter || endDateFilter) {
      return undefined
    }

    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0)
    const timeoutId = window.setTimeout(() => {
      setTodayKey(getCurrentDateKey())
    }, Math.max(1000, nextMidnight.getTime() - now.getTime()))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [endDateFilter, startDateFilter, todayKey])

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregarDashboard() {
      const [caixaResumoResult, passagensResumoResult, encomendasResult, clientesResult, terminaisResult] = await Promise.allSettled([
        listCaixaEntries({ dataInicial: effectiveStartDate, dataFinal: effectiveEndDate, maxResults: 2000, empresaId, empresaNome }),
        canAccessPassagens
          ? getPassagensResumo({ empresaId, empresaNome, dataInicial: effectiveStartDate, dataFinal: effectiveEndDate })
          : Promise.resolve({ totalPassagens: 0, totalViagensAtivas: 0, totalEmbarcadas: 0 }),
        canAccessFretes ? listCollectionOnce('encomendas', { empresaId, empresaNome }) : Promise.resolve([]),
        canAccessFretes ? listCollectionOnce('clientes', { empresaId, empresaNome }) : Promise.resolve([]),
        listCollectionOnce('terminais', { empresaId, empresaNome }),
      ])

      if (!active) {
        return
      }

      if (caixaResumoResult.status === 'rejected') {
        reportRuntimeError('Dashboard.getCaixaResumo', caixaResumoResult.reason, { empresaId, empresaNome })
      }

      if (passagensResumoResult.status === 'rejected') {
        reportRuntimeError('Dashboard.getPassagensResumo', passagensResumoResult.reason, { empresaId, empresaNome })
      }

      if (encomendasResult.status === 'rejected') {
        reportRuntimeError('Dashboard.listCollectionOnce.encomendas', encomendasResult.reason, { empresaId, empresaNome })
      }

      if (clientesResult.status === 'rejected') {
        reportRuntimeError('Dashboard.listCollectionOnce.clientes', clientesResult.reason, { empresaId, empresaNome })
      }

      if (terminaisResult.status === 'rejected') {
        reportRuntimeError('Dashboard.listCollectionOnce.terminais', terminaisResult.reason, { empresaId, empresaNome })
      }

      const caixaResumo = caixaResumoResult.status === 'fulfilled'
        ? getCaixaResumoFromItems(filterCaixaItemsByModuleAccess(caixaResumoResult.value, user))
        : null
      const passagensResumo = passagensResumoResult.status === 'fulfilled'
        ? passagensResumoResult.value
        : { totalPassagens: 0, totalViagensAtivas: 0, totalEmbarcadas: 0 }
      const encomendas = encomendasResult.status === 'fulfilled' ? encomendasResult.value : []
      const clientes = clientesResult.status === 'fulfilled' ? clientesResult.value : []
      const terminais = terminaisResult.status === 'fulfilled' ? terminaisResult.value : []
      const encomendasFiltradas = encomendas.filter((item) => isWithinPeriod(item?.criadoEm || item?.atualizadoEm, periodStart, periodEnd))
      const clientesFiltrados = clientes.filter((item) => isWithinPeriod(item?.criadoEm || item?.atualizadoEm, periodStart, periodEnd))
      const terminaisFiltrados = terminais.filter((item) => isWithinPeriod(item?.criadoEm || item?.atualizadoEm, periodStart, periodEnd))
      const freteMetrics = getEncomendasDashboardMetrics(encomendasFiltradas)

      setMetrics({
        encomendas: Number(encomendasFiltradas.length || 0),
        clientes: Number(clientesFiltrados.length || 0),
        terminais: Number(terminaisFiltrados.length || 0),
        passagens: Number(passagensResumo?.totalPassagens || 0),
        viagensAtivas: Number(passagensResumo?.totalViagensAtivas || 0),
        embarcadas: Number(passagensResumo?.totalEmbarcadas || 0),
        horarioPico: passagensResumo?.horarioPico || '-',
        embarcacaoDestaque: passagensResumo?.embarcacaoDestaque || '-',
        embarcacaoDestaqueTotal: Number(passagensResumo?.embarcacaoDestaqueTotal || 0),
        taxaOcupacao: Number(passagensResumo?.taxaOcupacao || 0),
        percentualGratuidades: Number(passagensResumo?.percentualGratuidades || 0),
        diasMaiorMovimento: passagensResumo?.diasMaiorMovimento || '-',
        diasMaiorMovimentoTotal: Number(passagensResumo?.diasMaiorMovimentoTotal || 0),
        diasMaiorMovimentoChart: Array.isArray(passagensResumo?.diasMaiorMovimentoChart) ? passagensResumo.diasMaiorMovimentoChart : [],
        horariosPicoChart: Array.isArray(passagensResumo?.horariosPicoChart) ? passagensResumo.horariosPicoChart : [],
        totalEntrada: Number(caixaResumo?.totalEntrada || 0),
        encomendasEmFluxo: Number(freteMetrics.emFluxo || 0),
        encomendasEmRetirada: Number(freteMetrics.esperaRetirada || 0),
        encomendasEntregues: Number(freteMetrics.entreguesCliente || 0),
      })
    }

    void carregarDashboard()

    return () => {
      active = false
    }
  }, [canAccessFretes, canAccessPassagens, effectiveEndDate, effectiveStartDate, periodEnd, periodStart, user, user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  return (
    <Layout
      title="ADMINISTRATIVO"
      subtitle="Resumo operacional e acesso rapido as rotinas principais."
      icon={<DashboardIcon className="h-6 w-6" />}
      containerClassName="max-w-full xl:max-w-[80vw]"
      contentClassName="max-w-none"
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-3 rounded-[1.6rem] border border-blue-100 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1657d8]">Filtro do dashboard</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Periodo operacional</h2>
            <p className="mt-1 text-sm text-slate-500">
              {(startDateFilter || endDateFilter)
                ? `Exibindo de ${effectiveStartDate} ate ${effectiveEndDate}.`
                : `Sem filtro manual: exibindo automaticamente o dia ${todayKey}.`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-[220px] flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Data inicial</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(event) => setStartDateFilter(event.target.value)}
                className="min-h-11 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="flex min-w-[220px] flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Data final</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(event) => setEndDateFilter(event.target.value)}
                className="min-h-11 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => {
              setStartDateFilter('')
              setEndDateFilter('')
            }}>
              Voltar para hoje
            </Button>
          </div>
        </div>

        {canAccessFretes ? (
          <section className="space-y-5">
            <SectionHeader
              eyebrow="Fretes"
              title="Painel de encomendas"
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Encomendas" value={metrics.encomendas} hint="Movimentacoes registradas no sistema" />
              <StatCard label="Clientes" value={metrics.clientes} hint="Cadastro para remetentes e destinatarios" />
              <StatCard label="Terminais" value={metrics.terminais} hint="Bases de embarque e desembarque" />
              <StatCard label="Caixa Hoje" value={`R$ ${metrics.totalEntrada.toFixed(2)}`} hint="Entradas registradas hoje" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="Em Fluxo"
                value={metrics.encomendasEmFluxo}
                hint="Postadas ou em transito"
                className="border-amber-200 bg-[linear-gradient(180deg,#fffdf5_0%,#fff4cc_100%)]"
                labelClassName="text-amber-700"
                valueClassName="text-amber-950"
              />
              <StatCard
                label="Espera Retirada"
                value={metrics.encomendasEmRetirada}
                hint="Ja chegaram ao balcao ou terminal de destino"
                className="border-sky-200 bg-[linear-gradient(180deg,#f6fcff_0%,#dff4ff_100%)]"
                labelClassName="text-sky-700"
                valueClassName="text-sky-950"
              />
              <StatCard
                label="Entregues Cliente"
                value={metrics.encomendasEntregues}
                hint="Ja retiradas pelo destinatario"
                className="border-emerald-200 bg-[linear-gradient(180deg,#f6fff9_0%,#dcfce7_100%)]"
                labelClassName="text-emerald-700"
                valueClassName="text-emerald-950"
              />
            </div>
          </section>
        ) : null}

        {canAccessPassagens ? (
          <section className="space-y-5">
            <SectionHeader
              eyebrow="Passagens"
              title="Painel de embarque e vendas"
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Passagens Vendidas" value={metrics.passagens} hint="Bilhetes vendidos no sistema" />
              <StatCard label="Viagens Ativas" value={metrics.viagensAtivas} hint="Partidas abertas ou embarcando" />
              <StatCard label="Embarcadas" value={metrics.embarcadas} hint="Passagens validadas no embarque" />
              <StatCard label="Caixa de Passagens" value={`R$ ${metrics.totalEntrada.toFixed(2)}`} hint="Entradas consolidadas do dia" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Embarcacao Destaque"
                value={formatCardValueWithTotal(metrics.embarcacaoDestaque, metrics.embarcacaoDestaqueTotal)}
                hint="Maior volume de transporte de passageiros"
                className="border-indigo-200 bg-[linear-gradient(180deg,#f7f9ff_0%,#e0e7ff_100%)]"
                labelClassName="text-indigo-700"
                valueClassName="text-indigo-950"
              />
              <StatCard
                label="Taxa de Ocupacao"
                value={`${metrics.taxaOcupacao.toFixed(1)}%`}
                hint="Passagens que ocupam vaga sobre a capacidade total"
                className="border-cyan-200 bg-[linear-gradient(180deg,#f4feff_0%,#cffafe_100%)]"
                labelClassName="text-cyan-700"
                valueClassName="text-cyan-950"
              />
              <StatCard
                label="Horario de Pico"
                value={metrics.horarioPico}
                hint="Faixa com maior quantidade de passageiros transportados"
                className="border-fuchsia-200 bg-[linear-gradient(180deg,#fff7ff_0%,#fae8ff_100%)]"
                labelClassName="text-fuchsia-700"
                valueClassName="text-fuchsia-950"
              />
              <StatCard
                label="Gratuidades"
                value={`${metrics.percentualGratuidades.toFixed(1)}%`}
                hint="Percentual sobre bilhetes validos"
                className="border-rose-200 bg-[linear-gradient(180deg,#fff7f8_0%,#ffe4e6_100%)]"
                labelClassName="text-rose-700"
                valueClassName="text-rose-950"
              />
              <StatCard
                label="Dia Mais Movimentado"
                value={formatCardValueWithTotal(metrics.diasMaiorMovimento, metrics.diasMaiorMovimentoTotal)}
                hint="Dia da semana com mais passageiros transportados"
                className="border-emerald-200 bg-[linear-gradient(180deg,#f7fff9_0%,#dcfce7_100%)]"
                labelClassName="text-emerald-700"
                valueClassName="text-emerald-950"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <DistributionChartCard
                title="Dias da Semana"
                description="Quantidade de passageiros transportados por dia da semana."
                items={metrics.diasMaiorMovimentoChart}
                accentClassName="bg-emerald-400"
                valueClassName="text-emerald-950"
              />
              <DistributionChartCard
                title="Horarios de Pico"
                description="Fluxo de passageiros transportados por faixa horaria, de 5h a 19h."
                items={metrics.horariosPicoChart}
                accentClassName="bg-fuchsia-400"
                valueClassName="text-fuchsia-950"
              />
            </div>
          </section>
        ) : null}

        <PageShell
          title="Atalhos rapidos"
          subtitle="Fluxos principais para operacao do balcao."
          icon={<ListIcon className="h-6 w-6" />}
          actions={[
            canAccessFretes ? (
              <Link key="novo-frete" to="/nova-comanda" className="rounded-2xl bg-[#1657d8] px-4 py-3 text-sm font-semibold text-white shadow-panel">
                Novo frete
              </Link>
            ) : null,
            canAccessPassagens ? (
              <Link key="nova-passagem" to="/nova-passagem" className="rounded-2xl bg-[#1657d8] px-4 py-3 text-sm font-semibold text-white shadow-panel">
                Nova passagem
              </Link>
            ) : null,
          ].filter(Boolean)}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ...(canAccessFretes ? [['/clientes', 'Cadastrar cliente'], ['/encomendas', 'Ver encomendas'], ['/rastreio/FRT-2026-000001', 'Abrir rastreio publico']] : []),
              ...(canAccessPassagens ? [['/passageiros', 'Cadastrar passageiro'], ['/passagens', 'Ver passagens']] : []),
              ['/terminais', 'Gerenciar terminais'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-100">
                {label}
              </Link>
            ))}
          </div>
        </PageShell>

      </div>
    </Layout>
  )
}
