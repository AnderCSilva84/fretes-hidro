import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardIcon, ListIcon, PackageIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { getAdminResumo, getPassagensResumo, listCaixaEntries, listCollectionOnce, listRecentDocuments } from '../services/firebase.js'
import { hasFreteAccess, hasPassagemAccess } from '../utils/accessControl.js'
import { filterCaixaItemsByModuleAccess, getCaixaResumoFromItems } from '../utils/caixaAccess.js'
import { getEncomendasDashboardMetrics, getEncomendaStatusPresentation } from '../utils/encomendaStatus.js'
import { obterRemetenteNome } from '../utils/remetente.js'
import { reportRuntimeError } from '../utils/runtimeDiagnostics.js'
import { abrirComprovante, obterRastreioUrl } from '../utils/encomendaMedia.js'

function StatCard({ label, value, hint, className = '', labelClassName = 'text-[#1657d8]', valueClassName = 'text-slate-950' }) {
  return (
    <Card className={className || 'border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]'}>
      <p className={`text-xs font-bold uppercase tracking-[0.24em] ${labelClassName}`}>{label}</p>
      <h3 className={`mt-3 text-3xl font-bold tracking-[-0.03em] ${valueClassName}`}>{value}</h3>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)
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
  })
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''
    const agora = new Date()
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`

    async function carregarDashboard() {
      const [adminResumoResult, caixaResumoResult, passagensResumoResult, recentOrdersResult, encomendasResult] = await Promise.allSettled([
        getAdminResumo({ empresaId, empresaNome }),
        listCaixaEntries({ dataInicial: hoje, dataFinal: hoje, maxResults: 2000, empresaId, empresaNome }),
        canAccessPassagens
          ? getPassagensResumo({ empresaId, empresaNome })
          : Promise.resolve({ totalPassagens: 0, totalViagensAtivas: 0, totalEmbarcadas: 0 }),
        canAccessFretes ? listRecentDocuments('encomendas', 'criadoEm', 5, { empresaId, empresaNome }) : Promise.resolve([]),
        canAccessFretes ? listCollectionOnce('encomendas', { empresaId, empresaNome }) : Promise.resolve([]),
      ])

      if (!active) {
        return
      }

      if (adminResumoResult.status === 'rejected') {
        reportRuntimeError('Dashboard.getAdminResumo', adminResumoResult.reason, { empresaId, empresaNome })
      }

      if (caixaResumoResult.status === 'rejected') {
        reportRuntimeError('Dashboard.getCaixaResumo', caixaResumoResult.reason, { empresaId, empresaNome })
      }

      if (passagensResumoResult.status === 'rejected') {
        reportRuntimeError('Dashboard.getPassagensResumo', passagensResumoResult.reason, { empresaId, empresaNome })
      }

      if (recentOrdersResult.status === 'rejected') {
        reportRuntimeError('Dashboard.listRecentDocuments', recentOrdersResult.reason, { empresaId, empresaNome })
      }

      if (encomendasResult.status === 'rejected') {
        reportRuntimeError('Dashboard.listCollectionOnce.encomendas', encomendasResult.reason, { empresaId, empresaNome })
      }

      const adminResumo = adminResumoResult.status === 'fulfilled' ? adminResumoResult.value : null
      const caixaResumo = caixaResumoResult.status === 'fulfilled'
        ? getCaixaResumoFromItems(filterCaixaItemsByModuleAccess(caixaResumoResult.value, user))
        : null
      const passagensResumo = passagensResumoResult.status === 'fulfilled'
        ? passagensResumoResult.value
        : { totalPassagens: 0, totalViagensAtivas: 0, totalEmbarcadas: 0 }
      const pedidosRecentes = recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : []
      const encomendas = encomendasResult.status === 'fulfilled' ? encomendasResult.value : []
      const precisaFallbackFretes = canAccessFretes && (
        !adminResumo ||
        (
          Number(adminResumo?.totalEncomendas || 0) === 0 &&
          pedidosRecentes.length > 0
        )
      )

      let adminResumoFinal = adminResumo

      if (precisaFallbackFretes) {
        try {
          const [encomendas, clientes, terminais] = await Promise.all([
            listCollectionOnce('encomendas', { empresaId, empresaNome }),
            listCollectionOnce('clientes', { empresaId, empresaNome }),
            listCollectionOnce('terminais', { empresaId, empresaNome }),
          ])

          adminResumoFinal = {
            totalEncomendas: encomendas.length,
            totalClientes: clientes.length,
            totalTerminais: terminais.length,
          }
        } catch (error) {
          reportRuntimeError('Dashboard.adminResumoFallback', error, { empresaId, empresaNome })
        }
      }

      const freteMetrics = getEncomendasDashboardMetrics(encomendas)

      setMetrics({
        encomendas: Number(adminResumoFinal?.totalEncomendas || 0),
        clientes: Number(adminResumoFinal?.totalClientes || 0),
        terminais: Number(adminResumoFinal?.totalTerminais || 0),
        passagens: Number(passagensResumo?.totalPassagens || 0),
        viagensAtivas: Number(passagensResumo?.totalViagensAtivas || 0),
        embarcadas: Number(passagensResumo?.totalEmbarcadas || 0),
        totalEntrada: Number(caixaResumo?.totalEntrada || 0),
        encomendasEmFluxo: Number(freteMetrics.emFluxo || 0),
        encomendasEmRetirada: Number(freteMetrics.esperaRetirada || 0),
        encomendasEntregues: Number(freteMetrics.entreguesCliente || 0),
      })
      setRecentOrders(pedidosRecentes)
    }

    void carregarDashboard()

    return () => {
      active = false
    }
  }, [canAccessFretes, canAccessPassagens, user, user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  async function abrirPdf(item) {
    await abrirComprovante(item, '_blank')
  }

  return (
    <Layout
      title="ADMINISTRATIVO"
      subtitle="Resumo operacional e acesso rapido as rotinas principais."
      icon={<DashboardIcon className="h-6 w-6" />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {canAccessFretes ? <StatCard label="Encomendas" value={metrics.encomendas} hint="Movimentacoes registradas no sistema" /> : null}
          {canAccessFretes ? <StatCard label="Clientes" value={metrics.clientes} hint="Cadastro para remetentes e destinatarios" /> : null}
          <StatCard label="Terminais" value={metrics.terminais} hint="Bases de embarque e desembarque" />
          {canAccessPassagens ? <StatCard label="Passagens" value={metrics.passagens} hint="Bilhetes vendidos no sistema" /> : null}
          {canAccessPassagens ? <StatCard label="Viagens Ativas" value={metrics.viagensAtivas} hint="Partidas abertas ou embarcando" /> : null}
          {canAccessPassagens ? <StatCard label="Embarcadas" value={metrics.embarcadas} hint="Passagens validadas no embarque" /> : null}
          <StatCard label="Caixa Hoje" value={`R$ ${metrics.totalEntrada.toFixed(2)}`} hint="Entradas registradas hoje" />
        </div>

        {canAccessFretes ? (
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
              hint="Ja chegaram ao balcao/terminal de destino"
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

        {canAccessFretes ? (
          <PageShell title="Ultimas encomendas" subtitle="Acompanhe os registros mais recentes." icon={<PackageIcon className="h-6 w-6" />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-3">Codigo</th>
                    <th className="pb-3">Remetente</th>
                    <th className="pb-3">Destino</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">QR</th>
                    <th className="pb-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {recentOrders.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-3 font-semibold text-[#1657d8]">{item.codigo}</td>
                      <td className="py-3">{obterRemetenteNome(item.remetenteNome)}</td>
                      <td className="py-3">{item.terminalDestino}</td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getEncomendaStatusPresentation(item).className}`}>
                          {getEncomendaStatusPresentation(item).label}
                        </span>
                      </td>
                      <td className="py-3">R$ {Number(item.valorTotal || 0).toFixed(2)}</td>
                      <td className="py-3">
                        {item.qrCodeDataUrl ? (
                          <img src={item.qrCodeDataUrl} alt={`QR ${item.codigo}`} className="h-14 w-14 rounded-xl border border-blue-100 bg-white p-1.5" />
                        ) : (
                          <span className="text-xs text-slate-400">Novo registro salva QR</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="ghost" className="min-h-10 px-3 py-2 text-xs" onClick={() => window.open(obterRastreioUrl(item), '_blank', 'noopener,noreferrer')}>
                            Rastreio
                          </Button>
                          <Button type="button" variant="secondary" className="min-h-10 px-3 py-2 text-xs" onClick={() => abrirPdf(item)}>
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageShell>
        ) : null}
      </div>
    </Layout>
  )
}
