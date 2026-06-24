import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { PackageIcon, SearchIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'

function extrairCodigoQr(valor) {
  const texto = String(valor || '').trim()

  if (!texto) {
    return ''
  }

  try {
    const url = new URL(texto)
    const partes = url.pathname.split('/').filter(Boolean)
    const indiceRastreio = partes.findIndex((parte) => parte === 'rastreio')

    if (indiceRastreio >= 0 && partes[indiceRastreio + 1]) {
      return decodeURIComponent(partes[indiceRastreio + 1])
    }

    const hashNormalizado = url.hash.replace(/^#\/?/, '')
    const partesHash = hashNormalizado.split('/').filter(Boolean)
    const indiceRastreioHash = partesHash.findIndex((parte) => parte === 'rastreio')

    if (indiceRastreioHash >= 0 && partesHash[indiceRastreioHash + 1]) {
      return decodeURIComponent(partesHash[indiceRastreioHash + 1])
    }
  } catch {
    return texto
  }

  return texto
}

export default function ScannerRetirada() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(0)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const [mensagem, setMensagem] = useState('Aponte a camera para o QR Code da comanda.')
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)

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
        // segue para o fallback com jsQR
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

  const abrirRetirada = useCallback((rawValue) => {
    const codigo = extrairCodigoQr(rawValue)

    if (!codigo) {
      setErro('Nao foi possivel identificar um codigo valido neste QR Code.')
      setProcessando(false)
      return
    }

    pararCamera()
    setCameraAtiva(false)
    navigate(`/retirada/${codigo}`)
  }, [navigate])

  function handleAtivarCamera() {
    if (!suporteCamera) {
      setErro('Este dispositivo nao liberou acesso a camera.')
      return
    }

    setErro('')
    setMensagem(
      suporteDetector
        ? 'Abrindo camera e procurando o QR Code...'
        : 'Abrindo camera. Se a leitura automatica nao funcionar neste navegador, use a foto do QR ou digite o codigo manualmente.',
    )
    setProcessando(false)
    setCameraAtiva(true)
  }

  function handleSelecionarFoto() {
    setErro('')
    setMensagem('Abra a camera ou escolha uma foto com o QR Code da comanda.')
    fileInputRef.current?.click()
  }

  async function handleArquivoQr(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setErro('')
    setProcessando(true)
    setMensagem('Lendo QR Code da foto...')

    try {
      const bitmap = await createImageBitmap(file)
      const valor = await lerQrDoConteudo(bitmap, bitmap.width, bitmap.height)
      bitmap.close?.()

      if (!valor) {
        setErro('Nao foi possivel localizar um QR Code nesta foto.')
        setMensagem('Tente novamente com a camera focada no QR Code ou informe o codigo manualmente.')
        setProcessando(false)
        return
      }

      abrirRetirada(valor)
    } catch (error) {
      setErro(error?.message || 'Nao foi possivel ler o QR Code da foto.')
      setMensagem('Tente novamente com outra foto ou informe o codigo manualmente.')
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
        setMensagem('Abrindo camera e procurando o QR Code...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
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
            ? 'Camera ativa. Aponte para o QR Code.'
            : 'Camera ativa. Leitura reforcada ativada. Aponte para o QR Code.',
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
              abrirRetirada(valor)
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

    iniciarLeitura()

    return () => {
      ativo = false
      pararCamera()
    }
  }, [abrirRetirada, cameraAtiva, lerQrDoConteudo, processando, suporteDetector])

  useEffect(() => () => pararCamera(), [])

  function handleCodigoManual() {
    abrirRetirada(codigoManual)
  }

  return (
    <Layout title="Scanner de retirada" subtitle="Leitura do QR Code para coletar assinatura do cliente." icon={<SearchIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <section className="rounded-[1.8rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] p-5 text-white shadow-[0_18px_45px_rgba(10,45,97,0.32)]">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-100">Retirada</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Scanner do balcao</h2>
          <p className="mt-2 text-sm text-blue-100/90">Leia o QR Code da comanda para abrir a tela de assinatura do cliente.</p>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleArquivoQr}
            />
          </div>

          <div className="rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1657d8]">
                <PackageIcon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-slate-950">Entrada manual</h3>
                <p className="mt-1 text-sm text-slate-500">Se o navegador nao suportar leitura automatica, informe o codigo da comanda ou cole a URL do QR.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <input
                value={codigoManual}
                onChange={(event) => setCodigoManual(event.target.value)}
                placeholder="Ex.: FRT-2026-000001 ou URL do rastreio"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
              <Button type="button" onClick={handleCodigoManual} disabled={!codigoManual.trim()}>
                Abrir retirada
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
