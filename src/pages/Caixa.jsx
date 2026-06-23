import { useMemo, useState } from 'react'
import Button from '../components/Button.jsx'
import { ListIcon, MoneyIcon } from '../components/AppIcons.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useFirestoreCollection from '../hooks/useFirestoreCollection.js'
import { deleteCollectionDocument } from '../services/firebase.js'
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

function estaDentroDoPeriodo(valor, dataInicial, dataFinal) {
  const data = normalizarData(valor)

  if (!data) {
    return false
  }

  if (dataInicial) {
    const inicio = new Date(`${dataInicial}T00:00:00`)

    if (data < inicio) {
      return false
    }
  }

  if (dataFinal) {
    const fim = new Date(`${dataFinal}T23:59:59.999`)

    if (data > fim) {
      return false
    }
  }

  return true
}

export default function Caixa() {
  const { items: caixa } = useFirestoreCollection('caixa')
  const { items: movimentacoes } = useFirestoreCollection('movimentacoes')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const caixaFiltrado = useMemo(
    () => caixa.filter((item) => estaDentroDoPeriodo(item.criadoEm, dataInicial, dataFinal)),
    [caixa, dataInicial, dataFinal],
  )

  const totalEntrada = caixa
    .filter((item) => item.tipo === 'entrada')
    .reduce((sum, item) => sum + Number(item.valor || 0), 0)
  const totalEntradaFiltrado = caixaFiltrado
    .filter((item) => item.tipo === 'entrada')
    .reduce((sum, item) => sum + Number(item.valor || 0), 0)
  const valorFaturadoFiltrado = totalEntradaFiltrado

  async function exportarPdf() {
    await gerarCaixaPdf({
      itens: caixaFiltrado,
      dataInicial,
      dataFinal,
      totalEntrada: totalEntradaFiltrado,
      valorFaturado: valorFaturadoFiltrado,
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
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Layout title="Tela de caixa" subtitle="Acompanhamento financeiro e entradas operacionais." icon={<MoneyIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <div className="rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] p-5 text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-100">Financeiro</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Painel de caixa</h2>
          <p className="mt-2 text-sm text-blue-100/90">Entradas e movimentacoes no mesmo padrao visual da nova comanda.</p>
        </div>

        <PageShell title="Resumo financeiro" icon={<MoneyIcon className="h-6 w-6" />}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Entradas</p>
              <p className="mt-2 text-2xl font-bold text-[#1657d8]">R$ {totalEntrada.toFixed(2)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Registros</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{caixa.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <p className="text-sm text-slate-500">Movimentacoes</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{movimentacoes.length}</p>
            </div>
          </div>
        </PageShell>

        <PageShell
          title="Movimentacoes do caixa"
          subtitle="Filtre por periodo e exporte um PDF das entradas exibidas abaixo."
          icon={<ListIcon className="h-6 w-6" />}
          actions={[
            <Button key="exportar" type="button" onClick={exportarPdf} disabled={caixaFiltrado.length === 0}>
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
                className="min-h-12 w-full rounded-2xl border border-blue-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Data final</span>
              <input
                type="date"
                value={dataFinal}
                onChange={(event) => setDataFinal(event.target.value)}
                className="min-h-12 w-full rounded-2xl border border-blue-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1657d8]">Periodo</p>
              <p className="mt-2 text-xl font-bold text-slate-950">R$ {totalEntradaFiltrado.toFixed(2)}</p>
              <p className="text-sm text-slate-500">{caixaFiltrado.length} registro(s)</p>
            </div>
          </div>

          <div className="space-y-3">
            {caixaFiltrado.map((item) => (
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

            {caixaFiltrado.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
                Nenhuma movimentacao encontrada para o periodo selecionado.
              </div>
            ) : null}
          </div>
        </PageShell>
      </div>
    </Layout>
  )
}
