import { gerarEtiqueta } from './gerarEtiqueta.js'
import { gerarReciboRetirada } from './gerarReciboRetirada.js'
import { gerarQRCode, montarRastreioUrl } from './gerarQRCode.js'

export function obterRastreioUrl(encomenda) {
  if (!encomenda?.codigo) {
    return ''
  }

  return encomenda.rastreioUrl || montarRastreioUrl(encomenda.codigo)
}

export async function obterQrCodeDataUrl(encomenda) {
  if (encomenda?.qrCodeDataUrl) {
    return encomenda.qrCodeDataUrl
  }

  if (!encomenda?.codigo) {
    return ''
  }

  return gerarQRCode(encomenda.codigo)
}

export async function gerarComprovanteUrl(encomenda) {
  const qrCodeDataUrl = await obterQrCodeDataUrl(encomenda)

  return gerarEtiqueta(
    {
      ...encomenda,
      rastreioUrl: obterRastreioUrl(encomenda),
    },
    qrCodeDataUrl,
  )
}

export async function abrirComprovante(encomenda, target = '_blank') {
  const pdfUrl = await gerarComprovanteUrl(encomenda)
  const openedWindow = window.open(pdfUrl, target, 'noopener,noreferrer')

  return {
    pdfUrl,
    opened: Boolean(openedWindow) || target === '_self',
  }
}

export async function abrirReciboRetirada(encomenda, target = '_blank') {
  const pdfUrl = await gerarReciboRetirada(encomenda)
  const openedWindow = window.open(pdfUrl, target, 'noopener,noreferrer')

  return {
    pdfUrl,
    opened: Boolean(openedWindow) || target === '_self',
  }
}
