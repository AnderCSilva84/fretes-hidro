import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardIcon, ListIcon, PackageIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { getAdminResumo, getCaixaResumo, listRecentDocuments } from '../services/firebase.js'
import { obterRemetenteNome } from '../utils/remetente.js'
import { abrirComprovante, obterRastreioUrl } from '../utils/encomendaMedia.js'

function StatCard({ label, value, hint }) {
  return (
    <Card className="border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1657d8]">{label}</p>
      <h3 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950">{value}</h3>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState({
    encomendas: 0,
    clientes: 0,
    terminais: 0,
    totalEntrada: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregarDashboard() {
      const [adminResumo, caixaResumo, recentOrdersResult] = await Promise.all([
        getAdminResumo({ empresaId, empresaNome }),
        getCaixaResumo({ empresaId, empresaNome }),
        listRecentDocuments('encomendas', 'criadoEm', 5, { empresaId, empresaNome }),
      ])

      if (!active) {
        return
      }

      setMetrics({
        encomendas: Number(adminResumo?.totalEncomendas || 0),
        clientes: Number(adminResumo?.totalClientes || 0),
        terminais: Number(adminResumo?.totalTerminais || 0),
        totalEntrada: Number(caixaResumo?.totalEntrada || 0),
      })
      setRecentOrders(recentOrdersResult)
    }

    void carregarDashboard()

    return () => {
      active = false
    }
  }, [user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Encomendas" value={metrics.encomendas} hint="Movimentacoes registradas no sistema" />
          <StatCard label="Clientes" value={metrics.clientes} hint="Cadastro para remetentes e destinatarios" />
          <StatCard label="Terminais" value={metrics.terminais} hint="Bases de embarque e desembarque" />
          <StatCard label="Caixa" value={`R$ ${metrics.totalEntrada.toFixed(2)}`} hint="Entradas totais registradas" />
        </div>

        <PageShell
          title="Atalhos rapidos"
          subtitle="Fluxos principais para operacao do balcao."
          icon={<ListIcon className="h-6 w-6" />}
          actions={[
            <Link key="nova" to="/nova-comanda" className="rounded-2xl bg-[#1657d8] px-4 py-3 text-sm font-semibold text-white shadow-panel">
              Nova comanda
            </Link>,
          ]}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['/clientes', 'Cadastrar cliente'],
              ['/terminais', 'Gerenciar terminais'],
              ['/encomendas', 'Ver encomendas'],
              ['/rastreio/FRT-2026-000001', 'Abrir rastreio publico'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-100">
                {label}
              </Link>
            ))}
          </div>
        </PageShell>

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
                    <td className="py-3">{item.status}</td>
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
      </div>
    </Layout>
  )
}
