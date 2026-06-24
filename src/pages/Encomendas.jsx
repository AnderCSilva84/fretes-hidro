import { useEffect, useState } from 'react'
import { PackageIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import {
  atualizarStatusEncomenda,
  deleteCollectionDocument,
  listCollectionPage,
  searchEncomendas,
} from '../services/firebase.js'
import { abrirComprovante, obterRastreioUrl } from '../utils/encomendaMedia.js'
import { obterRemetenteNome } from '../utils/remetente.js'

const statusOptions = ['Postado', 'Em transito', 'Chegou ao terminal', 'Entregue', 'Cancelado']
const PAGE_SIZE = 12

export default function Encomendas() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [rowForms, setRowForms] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

  async function carregarListaInicial() {
    setLoadingList(true)
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const result = await listCollectionPage('encomendas', {
        orderField: 'criadoEm',
        orderDirection: 'desc',
        maxResults: PAGE_SIZE,
        empresaId,
        empresaNome,
      })

      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    let active = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregar() {
      setLoadingList(true)

      try {
        const result = await listCollectionPage('encomendas', {
          orderField: 'criadoEm',
          orderDirection: 'desc',
          maxResults: PAGE_SIZE,
          empresaId,
          empresaNome,
        })

        if (!active) {
          return
        }

        setItems(result.items)
        setCursor(result.cursor)
        setHasMore(result.hasMore)
        setSearchActive(false)
      } finally {
        if (active) {
          setLoadingList(false)
        }
      }
    }

    void carregar()

    return () => {
      active = false
    }
  }, [user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  function getRowForm(item) {
    return rowForms[item.id] || { status: item.status || 'Postado', descricao: '' }
  }

  async function recarregarVisaoAtual() {
    if (searchActive) {
      await handleSearch(null, searchTerm)
      return
    }

    await carregarListaInicial()
  }

  async function salvarStatus(item) {
    const rowForm = getRowForm(item)
    setBusyId(item.id)

    try {
      await atualizarStatusEncomenda(item, rowForm.status, rowForm.descricao)
      await recarregarVisaoAtual()
      setRowForms((current) => ({
        ...current,
        [item.id]: { status: rowForm.status, descricao: '' },
      }))
    } finally {
      setBusyId('')
    }
  }

  async function excluirEncomenda(item) {
    const confirmed = window.confirm(`Excluir a encomenda ${item.codigo}?`)
    if (!confirmed) {
      return
    }

    setBusyId(item.id)

    try {
      await deleteCollectionDocument('encomendas', item.id)
      await recarregarVisaoAtual()
    } finally {
      setBusyId('')
    }
  }

  async function abrirPdf(item) {
    await abrirComprovante(item, '_blank')
  }

  async function handleSearch(event, forcedTerm = null) {
    if (event) {
      event.preventDefault()
    }

    const term = String(forcedTerm ?? searchTerm).trim()

    if (!term) {
      await carregarListaInicial()
      return
    }

    if (term.length < 3) {
      return
    }

    setLoadingList(true)

    try {
      const result = await searchEncomendas(term, 20, {
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })
      setItems(result)
      setCursor(null)
      setHasMore(false)
      setSearchActive(true)
    } finally {
      setLoadingList(false)
    }
  }

  async function limparBusca() {
    setSearchTerm('')
    await carregarListaInicial()
  }

  async function carregarMais() {
    if (!hasMore || searchActive) {
      return
    }

    setLoadingList(true)
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    try {
      const result = await listCollectionPage('encomendas', {
        orderField: 'criadoEm',
        orderDirection: 'desc',
        maxResults: PAGE_SIZE,
        cursor,
        empresaId,
        empresaNome,
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingList(false)
    }
  }

  return (
    <Layout title="Lista de encomendas" subtitle="Consulta operacional com carga reduzida e busca sob demanda." icon={<PackageIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <PageShell title="Encomendas cadastradas" subtitle="Atualize status e consulte por codigo ou destinatario sem ler a colecao inteira." icon={<PackageIcon className="h-6 w-6" />}>
          <div className="space-y-4">
            <form className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleSearch}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Input
                  className="flex-1"
                  label="Buscar encomenda"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Digite codigo ou inicio do nome do destinatario"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={loadingList}>
                    Buscar
                  </Button>
                  <Button type="button" variant="secondary" onClick={limparBusca} disabled={loadingList || !searchTerm}>
                    Limpar
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {searchActive
                  ? 'Resultado vindo de busca sob demanda.'
                  : 'A tela abre com uma pagina reduzida e carrega mais somente quando voce pedir.'}
              </p>
            </form>

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
                      {obterRemetenteNome(item.remetenteNome)} - {item.terminalOrigem || 'Sem origem'} {'->'} {item.terminalDestino || 'Sem destino'}
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
                      className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-[0.9rem] text-slate-900 outline-none focus:border-[#1657d8] focus:ring-4 focus:ring-blue-100"
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
                      <Button type="button" variant="secondary" onClick={() => window.open(`/retirada/${item.codigo}?modo=entrega`, '_blank', 'noopener,noreferrer')}>
                        Entregar encomenda
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => abrirPdf(item)}>
                        PDF
                      </Button>
                      <Button type="button" onClick={() => salvarStatus(item)} disabled={busyId === item.id}>
                        {busyId === item.id ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => excluirEncomenda(item)} disabled={busyId === item.id}>
                        {busyId === item.id ? 'Excluindo...' : 'Excluir'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
                {loadingList ? 'Carregando encomendas...' : 'Nenhuma encomenda encontrada.'}
              </div>
            ) : null}

            {!searchActive && hasMore ? (
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
