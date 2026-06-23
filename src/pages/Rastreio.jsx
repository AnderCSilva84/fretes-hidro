import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button.jsx'
import { PackageIcon, SearchIcon } from '../components/AppIcons.jsx'
import Card from '../components/Card.jsx'
import useAuth from '../context/useAuth.js'
import { atualizarStatusEncomenda, getMovimentacoesPorCodigo, searchByCodigo } from '../services/firebase.js'
import { abrirComprovante, abrirReciboRetirada, obterQrCodeDataUrl } from '../utils/encomendaMedia.js'
import { obterRemetenteNome } from '../utils/remetente.js'

function formatarData(valor) {
  if (!valor) {
    return 'Nao informado'
  }

  const dateValue = valor?.toDate ? valor.toDate() : new Date(valor)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(dateValue)
}

export default function Rastreio() {
  const { codigo } = useParams()
  const { user } = useAuth()
  const [encomenda, setEncomenda] = useState(null)
  const [movimentacoes, setMovimentacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [pdfReady, setPdfReady] = useState(false)
  const [autoOpenFailed, setAutoOpenFailed] = useState(false)
  const [openingPdf, setOpeningPdf] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [updatingDelivery, setUpdatingDelivery] = useState(false)
  const autoOpenedCodigoRef = useRef('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setLoading(true)
      const found = await searchByCodigo(codigo)
      const movs = await getMovimentacoesPorCodigo(codigo)

      if (ativo) {
        setEncomenda(found)
        setMovimentacoes(movs)
        setPdfReady(false)
        setAutoOpenFailed(false)
        autoOpenedCodigoRef.current = ''
        setQrCodeDataUrl(found ? await obterQrCodeDataUrl(found) : '')
        setLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [codigo])

  useEffect(() => {
    let ativo = true

    async function abrirPdfAutomaticamente() {
      if (!encomenda || user || autoOpenedCodigoRef.current === encomenda.codigo) {
        return
      }

      autoOpenedCodigoRef.current = encomenda.codigo
      setOpeningPdf(true)

      try {
        const result = await abrirComprovante(
          {
            ...encomenda,
            qrCodeDataUrl: qrCodeDataUrl || encomenda.qrCodeDataUrl,
          },
          '_blank',
        )

        if (ativo) {
          setPdfReady(true)
          setAutoOpenFailed(!result.opened)
        }
      } finally {
        if (ativo) {
          setOpeningPdf(false)
        }
      }
    }

    abrirPdfAutomaticamente()

    return () => {
      ativo = false
    }
  }, [encomenda, qrCodeDataUrl, user])

  async function handleOpenPdf() {
    if (!encomenda) {
      return
    }

    setOpeningPdf(true)

    try {
      const result = await abrirComprovante(
        {
          ...encomenda,
          qrCodeDataUrl: qrCodeDataUrl || encomenda.qrCodeDataUrl,
        },
        '_blank',
      )

      setPdfReady(true)
      setAutoOpenFailed(!result.opened)
    } finally {
      setOpeningPdf(false)
    }
  }

  async function handleMarcarEntregue() {
    if (!encomenda) {
      return
    }

    setUpdatingDelivery(true)

    try {
      const operador = user?.nome || user?.displayName || user?.email || 'Operador'
      const operadorEmail = user?.email || ''
      const entregueEm = new Date().toISOString()
      await atualizarStatusEncomenda(
        encomenda,
        'Entregue',
        `Encomenda entregue ao destinatario por retirada no balcao. Baixa realizada por ${operador}.`,
        {
          entregueEm,
          operadorEntregaNome: operador,
          operadorEntregaEmail: operadorEmail,
        },
      )

      const [found, movs] = await Promise.all([
        searchByCodigo(encomenda.codigo),
        getMovimentacoesPorCodigo(encomenda.codigo),
      ])

      setEncomenda(found)
      setMovimentacoes(movs)
    } finally {
      setUpdatingDelivery(false)
    }
  }

  async function handleAbrirReciboRetirada() {
    if (!encomenda?.assinaturaRetiradaDataUrl) {
      return
    }

    await abrirReciboRetirada(encomenda, '_blank')
  }

  const podeDarBaixa = Boolean(user && encomenda && encomenda.status !== 'Entregue' && encomenda.status !== 'Cancelado')

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12">
              <SearchIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-blue-100">Rastreio publico</p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] lg:text-4xl">LUZ DA AURORA III</h1>
              <p className="mt-2 text-blue-100/90">Consulta publica por codigo da encomenda.</p>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="border-blue-100">
            <p className="text-slate-500">Carregando rastreio...</p>
          </Card>
        ) : encomenda ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-blue-100">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Codigo</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#1657d8]">
                      <PackageIcon className="h-5 w-5" />
                    </span>
                    <p className="text-2xl font-bold text-[#1657d8]">{encomenda.codigo}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Remetente</p>
                    <p className="mt-1 font-semibold text-slate-900">{obterRemetenteNome(encomenda.remetenteNome)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Destinatario</p>
                    <p className="mt-1 font-semibold text-slate-900">{encomenda.destinatarioNome}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Origem</p>
                    <p className="mt-1 font-semibold text-slate-900">{encomenda.terminalOrigem}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Destino</p>
                    <p className="mt-1 font-semibold text-slate-900">{encomenda.terminalDestino}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs text-slate-500">Status atual</p>
                  <p className="mt-1 text-lg font-bold text-[#0a2d61]">{encomenda.status}</p>
                  <p className="mt-2 text-sm text-slate-600">Criado em {formatarData(encomenda.criadoEm)}</p>
                  {encomenda.entregueEm ? (
                    <div className="mt-3 rounded-2xl bg-white/80 px-3 py-3 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold">Retirada:</span> {formatarData(encomenda.entregueEm)}
                      </p>
                      <p className="mt-1">
                        <span className="font-semibold">Baixa por:</span>{' '}
                        {encomenda.operadorEntregaNome || encomenda.operadorEntregaEmail || 'Nao informado'}
                      </p>
                    </div>
                  ) : null}
                </div>
                {user ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Baixa de entrega</p>
                        <p className="mt-2 text-sm text-slate-700">
                          Usuario logado pode concluir a retirada e registrar a encomenda como entregue.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/retirada/${encomenda.codigo}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#1657d8] px-4 text-sm font-semibold text-white shadow-panel"
                        >
                          Assinatura de retirada
                        </Link>
                        <Button type="button" variant="secondary" onClick={handleMarcarEntregue} disabled={!podeDarBaixa || updatingDelivery}>
                          {updatingDelivery ? 'Registrando...' : encomenda.status === 'Entregue' ? 'Ja entregue' : 'Dar baixa direta'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {encomenda.assinaturaRetiradaDataUrl ? (
                  <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Recibo assinado</p>
                        <p className="mt-2 text-sm text-slate-600">Esta retirada ja possui assinatura gravada e o recibo pode ser reaberto.</p>
                      </div>
                      <Button type="button" variant="secondary" onClick={handleAbrirReciboRetirada}>
                        Abrir recibo assinado
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-blue-100 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1657d8]">Comprovante</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {openingPdf
                          ? 'Preparando PDF para esta comanda...'
                          : autoOpenFailed
                            ? 'O navegador bloqueou a abertura automatica. Toque no botao para abrir o PDF.'
                            : pdfReady
                              ? 'PDF preparado para quem escaneou este QR Code.'
                              : 'Gerando comprovante...'}
                      </p>
                    </div>
                    <Button type="button" onClick={handleOpenPdf} disabled={openingPdf}>
                      {openingPdf ? 'Gerando PDF...' : 'Abrir PDF'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-blue-100">
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#1657d8]">
                    <PackageIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#1657d8]">Painel</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Historico de movimentacoes</h2>
                  </div>
                </div>
                {qrCodeDataUrl ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <img src={qrCodeDataUrl} alt={`QR Code da comanda ${encomenda.codigo}`} className="h-28 w-28 rounded-2xl border border-blue-100 bg-white p-2" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">QR Code da comanda</p>
                      <p className="mt-1 text-sm text-slate-600">Ele permanece salvo para consultas e reimpressao futura.</p>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {movimentacoes.length > 0 ? (
                    movimentacoes.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{item.status}</p>
                          <p className="text-xs text-slate-500">{formatarData(item.criadoEm)}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{item.descricao}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma movimentacao encontrada para este codigo.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="border-blue-100">
            <p className="text-slate-500">Codigo nao encontrado.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
