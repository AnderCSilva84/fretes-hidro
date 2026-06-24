import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PackageIcon, SearchIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import useAuth from '../context/useAuth.js'
import { atualizarStatusEncomenda, searchByCodigo } from '../services/firebase.js'
import { abrirReciboRetirada } from '../utils/encomendaMedia.js'
import { obterRemetenteNome } from '../utils/remetente.js'

function formatarData(valor) {
  if (!valor) {
    return 'Nao informado'
  }

  const dateValue = valor?.toDate ? valor.toDate() : new Date(valor)

  if (Number.isNaN(dateValue.getTime())) {
    return 'Nao informado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(dateValue)
}

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

export default function RetiradaEntrega() {
  const { codigo } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const [encomenda, setEncomenda] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [erro, setErro] = useState('')
  const [recebedorNome, setRecebedorNome] = useState('')
  const [recebedorDocumento, setRecebedorDocumento] = useState('')
  const [observacao, setObservacao] = useState('')
  const modo = searchParams.get('modo') === 'entrega' ? 'entrega' : 'retirada'
  const tituloFluxo = modo === 'entrega' ? 'Entrega com assinatura' : 'Retirada com assinatura'
  const subtituloFluxo = modo === 'entrega'
    ? 'Confirme a entrega do frete e gere o recibo assinado.'
    : 'Confirme a retirada do frete e gere o recibo assinado.'

  useEffect(() => {
    let ativo = true
    const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
    const empresaNome = user?.empresaNome || ''

    async function carregar() {
      setLoading(true)
      const found = await searchByCodigo(codigo, { empresaId: user ? empresaId : '', empresaNome: user ? empresaNome : '' })

      if (!ativo) {
        return
      }

      setEncomenda(found)
      setRecebedorNome(found?.destinatarioNome || '')
      setRecebedorDocumento(found?.retiradaRecebedorDocumento || '')
      setObservacao(found?.retiradaObservacao || '')
      setLoading(false)
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [codigo, user])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 640
    const height = 220
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.height = `${height}px`

    const context = canvas.getContext('2d')
    context.scale(ratio, ratio)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0f4c81'
    context.lineWidth = 2.2
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }, [])

  function limparAssinatura() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.restore()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0f4c81'
    context.lineWidth = 2.2
    setHasSignature(false)
  }

  function handlePointerDown(event) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    const point = getPoint(event, canvas)
    drawingRef.current = true
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function handlePointerMove(event) {
    if (!drawingRef.current) {
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    const point = getPoint(event, canvas)
    context.lineTo(point.x, point.y)
    context.stroke()
    setHasSignature(true)
  }

  function handlePointerUp() {
    drawingRef.current = false
  }

  async function finalizarRetirada() {
    if (!encomenda) {
      return
    }

    if (!recebedorNome.trim()) {
      setErro(`Informe o nome de quem esta ${modo === 'entrega' ? 'recebendo a encomenda' : 'retirando a postagem'}.`)
      return
    }

    if (!hasSignature) {
      setErro(`Colete a assinatura do cliente antes de finalizar a ${modo}.`)
      return
    }

    setErro('')
    setSaving(true)

    try {
      const assinaturaRetiradaDataUrl = canvasRef.current.toDataURL('image/png')
      const operador = user?.nome || user?.displayName || user?.email || 'Operador'
      const operadorEmail = user?.email || ''
      const entregueEm = new Date().toISOString()
      const updates = {
        entregueEm,
        retiradaFinalizadaEm: entregueEm,
        operadorEntregaNome: operador,
        operadorEntregaEmail: operadorEmail,
        retiradaRecebedorNome: recebedorNome.trim(),
        retiradaRecebedorDocumento: recebedorDocumento.trim(),
        retiradaObservacao: observacao.trim(),
        assinaturaRetiradaDataUrl,
        reciboRetiradaGeradoEm: entregueEm,
        modoBaixa: modo,
      }

      await atualizarStatusEncomenda(
        encomenda,
        'Entregue',
        `${modo === 'entrega' ? 'Entrega' : 'Retirada'} assinada por ${recebedorNome.trim()} e registrada por ${operador}.`,
        updates,
      )

      const atualizada = await searchByCodigo(encomenda.codigo, {
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })
      setEncomenda(atualizada)
      await abrirReciboRetirada({
        ...atualizada,
        ...updates,
      })
    } finally {
      setSaving(false)
    }
  }

  async function reabrirRecibo() {
    if (!encomenda?.assinaturaRetiradaDataUrl) {
      return
    }

    await abrirReciboRetirada(encomenda)
  }

  return (
    <Layout title={tituloFluxo} subtitle={subtituloFluxo} icon={<PackageIcon className="h-6 w-6" />}>
      {loading ? (
        <div className="rounded-[1.8rem] border border-blue-100 bg-white p-5 text-slate-500 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          Carregando dados da comanda...
        </div>
      ) : !encomenda ? (
        <div className="rounded-[1.8rem] border border-rose-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="font-semibold text-rose-700">Codigo nao encontrado.</p>
          <Link to={modo === 'entrega' ? '/encomendas' : '/scanner-retirada'} className="mt-3 inline-flex text-sm font-semibold text-[#1657d8]">
            {modo === 'entrega' ? 'Voltar para a lista' : 'Voltar para o scanner'}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] p-5 text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-100">{modo === 'entrega' ? 'Entrega' : 'Retirada'}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{encomenda.codigo}</h2>
            <p className="mt-2 text-sm text-blue-100/90">Colete a assinatura do cliente e gere o recibo final da {modo}.</p>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1657d8]">
                  <SearchIcon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-slate-950">Dados da comanda</h3>
                  <p className="mt-1 text-sm text-slate-500">Confira os dados antes de concluir a {modo} desta encomenda.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Remetente" value={obterRemetenteNome(encomenda.remetenteNome)} />
                <Info label="Destinatario" value={encomenda.destinatarioNome} />
                <Info label="Origem" value={encomenda.terminalOrigem} />
                <Info label="Destino" value={encomenda.terminalDestino} />
                <Info label="Status" value={encomenda.status} />
                <Info label="Criado em" value={formatarData(encomenda.criadoEm)} />
              </div>

              {encomenda.assinaturaRetiradaDataUrl ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Esta comanda ja possui assinatura de retirada.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button type="button" variant="secondary" onClick={reabrirRecibo}>
                      Abrir recibo assinado
                    </Button>
                    <Link to={modo === 'entrega' ? '/encomendas' : '/scanner-retirada'} className="inline-flex items-center text-sm font-semibold text-[#1657d8]">
                      {modo === 'entrega' ? 'Voltar para a lista' : 'Voltar ao scanner'}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <h3 className="text-xl font-bold text-slate-950">Assinatura do cliente</h3>
              <p className="mt-1 text-sm text-slate-500">Peça para o cliente assinar abaixo. O recibo em PDF sera gerado logo depois.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-600">Nome de quem recebe</span>
                  <input
                    value={recebedorNome}
                    onChange={(event) => setRecebedorNome(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-600">Documento</span>
                  <input
                    value={recebedorDocumento}
                    onChange={(event) => setRecebedorDocumento(event.target.value)}
                    placeholder="CPF, RG ou outro"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="mt-3 block space-y-1">
                <span className="text-sm font-medium text-slate-600">Observacao</span>
                <textarea
                  value={observacao}
                  onChange={(event) => setObservacao(event.target.value)}
                  rows={3}
                  placeholder="Ex.: retirada por terceiro autorizado"
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full touch-none bg-white"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={limparAssinatura}>
                  Limpar assinatura
                </Button>
                <Button type="button" onClick={finalizarRetirada} disabled={saving || Boolean(encomenda.assinaturaRetiradaDataUrl)}>
                  {saving ? 'Finalizando...' : `Finalizar ${modo} e gerar recibo`}
                </Button>
              </div>

              {erro ? <p className="mt-3 text-sm font-semibold text-rose-600">{erro}</p> : null}
            </div>
          </section>
        </div>
      )}
    </Layout>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value || 'Nao informado'}</p>
    </div>
  )
}
