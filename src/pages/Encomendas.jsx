import { useState } from 'react'
import { PackageIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useFirestoreCollection from '../hooks/useFirestoreCollection.js'
import { atualizarStatusEncomenda, deleteCollectionDocument } from '../services/firebase.js'
import { abrirComprovante, obterRastreioUrl } from '../utils/encomendaMedia.js'

const statusOptions = ['Postado', 'Em transito', 'Chegou ao terminal', 'Entregue', 'Cancelado']

export default function Encomendas() {
  const { items } = useFirestoreCollection('encomendas')
  const [rowForms, setRowForms] = useState({})

  function getRowForm(item) {
    return rowForms[item.id] || { status: item.status || 'Postado', descricao: '' }
  }

  async function salvarStatus(item) {
    const rowForm = getRowForm(item)
    await atualizarStatusEncomenda(item, rowForm.status, rowForm.descricao)
    setRowForms((current) => ({
      ...current,
      [item.id]: { status: rowForm.status, descricao: '' },
    }))
  }

  async function excluirEncomenda(item) {
    const confirmed = window.confirm(`Excluir a encomenda ${item.codigo}?`)
    if (!confirmed) {
      return
    }

    await deleteCollectionDocument('encomendas', item.id)
  }

  async function abrirPdf(item) {
    await abrirComprovante(item, '_blank')
  }

  return (
    <Layout title="Listagem de encomendas" subtitle="Consulta operacional com todos os codigos criados." icon={<PackageIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <div className="rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] p-5 text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-100">Operacao</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Painel de encomendas</h2>
          <p className="mt-2 text-sm text-blue-100/90">Consulte, atualize status e mantenha a operacao no mesmo padrao visual do novo frete.</p>
        </div>

        <PageShell title="Encomendas cadastradas" subtitle="Atualize status e registre observacoes de atendimento." icon={<PackageIcon className="h-6 w-6" />}>
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.6rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#1657d8]">
                        {item.status}
                      </span>
                      <span className="text-sm font-semibold text-[#1657d8]">{item.codigo}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-950">{item.destinatarioNome || 'Sem destinatario'}</h3>
                    <p className="text-sm text-slate-500">
                      {item.remetenteNome || 'Sem remetente'} - {item.terminalOrigem || 'Sem origem'} {'->'} {item.terminalDestino || 'Sem destino'}
                    </p>
                    <p className="text-lg font-bold text-slate-900">R$ {Number(item.valorTotal || 0).toFixed(2)}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {item.qrCodeDataUrl ? (
                        <img
                          src={item.qrCodeDataUrl}
                          alt={`QR Code da comanda ${item.codigo}`}
                          className="h-20 w-20 rounded-2xl border border-blue-100 bg-white p-2"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50 text-center text-[11px] font-semibold text-[#1657d8]">
                          QR sera salvo nas novas comandas
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold text-slate-900">Historico da comanda</p>
                        <p className="text-slate-500">O QR fica gravado junto da encomenda para reabrir o comprovante depois.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:min-w-[320px]">
                    <select
                      className="min-h-12 rounded-2xl border border-blue-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
                      value={getRowForm(item).status}
                      onChange={(event) =>
                        setRowForms((current) => ({
                          ...current,
                          [item.id]: { ...getRowForm(item), status: event.target.value },
                        }))
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <Input
                      label="Observacao"
                      value={getRowForm(item).descricao}
                      onChange={(event) =>
                        setRowForms((current) => ({
                          ...current,
                          [item.id]: { ...getRowForm(item), descricao: event.target.value },
                        }))
                      }
                      placeholder="Ex.: saiu no barco das 14h"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={() => window.open(obterRastreioUrl(item), '_blank', 'noopener,noreferrer')}>
                        Rastreio
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => abrirPdf(item)}>
                        PDF
                      </Button>
                      <Button type="button" onClick={() => salvarStatus(item)}>
                        Salvar
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => excluirEncomenda(item)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
                Nenhuma encomenda cadastrada ainda.
              </div>
            ) : null}
          </div>
        </PageShell>
      </div>
    </Layout>
  )
}
