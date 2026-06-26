import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import jsQR from 'jsqr'
import { PackageIcon, SearchIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { buscarPassagemPorCodigo, confirmarEmbarque } from '../services/firebase.js'

function extrairCodigoPassagem(valor) {
  const texto = String(valor || '').trim()

  if (!texto) {
    return ''
  }

  try {
    const url = new URL(texto)
    const codigoQuery = url.searchParams.get('codigo')

    if (codigoQuery) {
      return decodeURIComponent(codigoQuery)
    }
  } catch {
    return texto
  }

  return texto
}

export default function ScannerEmbarque() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(0)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [codigoManual, setCodigoManual] = useState(searchParams.get('codigo') || '')
  const [passagem, setPassagem] = useState(null)
  const [mensagem, setMensagem] = useState('Aponte a camera para o QR Code do bilhete ou digite o codigo manualmente.')
  const [erro, setErro] = useState('')
  const [success, setSuccess] = useState('')
  const [processando, setProcessando] = useState(false)
  const [busyConfirm, setBusyConfirm] = useState(false)

  const suporteCamera = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const suporteDetector = useMemo(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window,
    [],
  )

  const lerQrComJsQr = useCallback((source, largura, altura) => {
    if (!largura || !altura) {
      return ''
    }

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context) {
      return ''
    }

    context.drawImage(source, 0, 0, largura, altura)
    const imageData = context.getImageData(0, 0, largura, altura)
    const resultado = jsQR(imageData.data, imageData.width, imageData.height)

    return resultado?.data || ''
  }, [])

  const lerQrDoConteudo = useCallback(async (source, largura, altura) => {
    if (suporteDetector) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const encontrados = await detector.detect(source)
        const valorDetector = encontrados[0]?.rawValue

        if (valorDetector) {
          return valorDetector
        }
      } catch {
        // segue para fallback
      }
    }

    return lerQrComJsQr(source, largura, altura)
  }, [lerQrComJsQr, suporteDetector])

  function pararCamera() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = 0
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const localizarPassagem = useCallback(async (rawValue) => {
    const codigo = extrairCodigoPassagem(rawValue)

    if (!codigo) {
      setErro('Nao foi possivel identificar um codigo valido neste QR Code.')
      setProcessando(false)
      return
    }

    setErro('')
    setSuccess('')
    setMensagem('Consultando bilhete...')

    try {
      const found = await buscarPassagemPorCodigo(codigo, {
        empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })

      if (!found) {
        throw new Error('Passagem nao encontrada.')
      }

      pararCamera()
      setCameraAtiva(false)
      setPassagem(found)
      setCodigoManual(codigo)
      setMensagem('Bilhete encontrado. Confirme o embarque abaixo.')
    } catch (error) {
      setPassagem(null)
      setErro(error.message || 'Nao foi possivel localizar a passagem.')
      setMensagem('Tente novamente com outro QR Code ou informe o codigo manualmente.')
    } finally {
      setProcessando(false)
    }
  }, [user?.empresaId, user?.empresaNome, user?.rootSuperadmin])

  function handleAtivarCamera() {
    if (!suporteCamera) {
      setErro('Este dispositivo nao liberou acesso a camera.')
      return
    }

    setErro('')
    setSuccess('')
    setProcessando(false)
    setMensagem(
      suporteDetector
        ? 'Abrindo camera e procurando o QR Code do bilhete...'
        : 'Abrindo camera. Se a leitura automatica nao funcionar, use a foto do QR ou a entrada manual.',
    )
    setCameraAtiva(true)
  }

  function handleSelecionarFoto() {
    setErro('')
    setSuccess('')
    setMensagem('Escolha uma foto com o QR Code do bilhete.')
    fileInputRef.current?.click()
  }

  async function handleArquivoQr(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setErro('')
    setSuccess('')
    setProcessando(true)
    setMensagem('Lendo QR Code da foto...')

    try {
      const bitmap = await createImageBitmap(file)
      const valor = await lerQrDoConteudo(bitmap, bitmap.width, bitmap.height)
      bitmap.close?.()

      if (!valor) {
        setErro('Nao foi possivel localizar um QR Code nesta foto.')
        setMensagem('Tente novamente com outra foto ou use o codigo manual.')
        setProcessando(false)
        return
      }

      await localizarPassagem(valor)
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel ler o QR Code da foto.')
      setMensagem('Tente novamente com outra foto ou use o codigo manual.')
      setProcessando(false)
    }
  }

  useEffect(() => {
    if (!cameraAtiva) {
      pararCamera()
      return undefined
    }

    let ativo = true

    async function iniciarLeitura() {
      try {
        setErro('')
        setMensagem('Abrindo camera e procurando o QR Code do bilhete...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })

        if (!ativo) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setMensagem(
          suporteDetector
            ? 'Camera ativa. Aponte para o QR Code do bilhete.'
            : 'Camera ativa. Aponte para o QR Code do bilhete.',
        )

        intervalRef.current = window.setInterval(async () => {
          if (!ativo || processando || !videoRef.current) {
            return
          }

          try {
            const valor = await lerQrDoConteudo(
              videoRef.current,
              videoRef.current.videoWidth,
              videoRef.current.videoHeight,
            )

            if (valor) {
              setProcessando(true)
              await localizarPassagem(valor)
            }
          } catch {
            setMensagem('Camera ativa. Aproxime o QR Code para leitura.')
          }
        }, 700)
      } catch (error) {
        setErro(error?.message || 'Nao foi possivel acessar a camera.')
        setCameraAtiva(false)
      }
    }

    void iniciarLeitura()

    return () => {
      ativo = false
      pararCamera()
    }
  }, [cameraAtiva, localizarPassagem, lerQrDoConteudo, processando, suporteDetector])

  useEffect(() => () => pararCamera(), [])

  async function handleBuscarManual() {
    setProcessando(true)
    await localizarPassagem(codigoManual)
  }

  async function handleConfirmar() {
    if (!passagem) {
      return
    }

    setBusyConfirm(true)
    setErro('')
    setSuccess('')

    try {
      const atualizada = await confirmarEmbarque(passagem.codigo, user)
      setPassagem(atualizada)
      setSuccess(`Embarque confirmado para ${atualizada.passageiroNome}.`)
      setMensagem('Embarque registrado com sucesso.')
    } catch (error) {
      setErro(error.message || 'Nao foi possivel confirmar o embarque.')
    } finally {
      setBusyConfirm(false)
    }
  }

  return (
    <Layout title="Scanner embarque" subtitle="Leitura por camera, foto ou codigo manual para validar o bilhete." icon={<SearchIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <section className="rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] p-5 text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-100">Embarque</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Scanner do balcao</h2>
          <p className="mt-2 text-sm text-blue-100/90">Leia o QR Code do bilhete e confirme o embarque do passageiro.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950/95 p-3">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full rounded-[1.1rem] object-cover" />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={handleAtivarCamera} disabled={!suporteCamera || processando}>
                Ativar camera
              </Button>
              <Button type="button" variant="secondary" onClick={handleSelecionarFoto}>
                Escanear por foto
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCameraAtiva(false)}>
                Parar camera
              </Button>
            </div>

            <p className="mt-4 text-sm text-slate-600">{mensagem}</p>
            {erro ? <p className="mt-2 text-sm font-semibold text-rose-600">{erro}</p> : null}
            {success ? <p className="mt-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleArquivoQr}
            />
          </div>

          <div className="space-y-6">
            <PageShell title="Entrada manual" subtitle="Use quando o QR nao puder ser lido." icon={<PackageIcon className="h-6 w-6" />}>
              <div className="space-y-3">
                <input
                  value={codigoManual}
                  onChange={(event) => setCodigoManual(event.target.value)}
                  placeholder="Ex.: PAS-20260624-0001 ou URL do QR"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <Button type="button" onClick={handleBuscarManual} disabled={!codigoManual.trim() || processando}>
                  {processando ? 'Consultando...' : 'Buscar bilhete'}
                </Button>
              </div>
            </PageShell>

            {passagem ? (
              <PageShell title="Bilhete localizado" subtitle="Confira os dados antes de concluir o embarque." icon={<PackageIcon className="h-6 w-6" />}>
                <div className="space-y-3">
                  <p className="text-lg font-bold text-slate-950">{passagem.codigo}</p>
                  <p className="text-sm text-slate-600">{passagem.passageiroNome}</p>
                  <p className="text-sm text-slate-500">{passagem.passageiroDocumento || 'Sem documento'}</p>
                  <p className="text-sm text-slate-500">
                    {passagem.origem} - {passagem.destino} • {passagem.dataViagem} {passagem.horarioSaida || ''}
                  </p>
                  <p className="text-sm font-semibold text-slate-700">Status atual: {passagem.status}</p>
                  <Button
                    type="button"
                    onClick={handleConfirmar}
                    disabled={busyConfirm || passagem.status === 'Embarcado' || passagem.status === 'Cancelada'}
                  >
                    {busyConfirm ? 'Confirmando...' : 'Confirmar embarque'}
                  </Button>
                </div>
              </PageShell>
            ) : null}
          </div>
        </section>
      </div>
    </Layout>
  )
}
