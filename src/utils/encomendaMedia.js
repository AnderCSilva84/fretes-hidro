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
  const pdfBlob = await gerarEtiqueta(
    {
      ...encomenda,
      rastreioUrl: obterRastreioUrl(encomenda),
    },
    qrCodeDataUrl,
  )
  const pdfUrl = URL.createObjectURL(pdfBlob)

  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)

  return pdfUrl
}

export async function gerarComprovanteBlob(encomenda) {
  const qrCodeDataUrl = await obterQrCodeDataUrl(encomenda)

  return gerarEtiqueta(
    {
      ...encomenda,
      rastreioUrl: obterRastreioUrl(encomenda),
    },
    qrCodeDataUrl,
  )
}

export async function gerarComprovanteArquivo(encomenda) {
  const pdfBlob = await gerarComprovanteBlob(encomenda)
  const codigoBase = String(encomenda?.codigo || 'comprovante-postagem')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const nomeArquivo = `${codigoBase || 'comprovante-postagem'}.pdf`

  if (typeof File === 'function') {
    return new File([pdfBlob], nomeArquivo, { type: 'application/pdf' })
  }

  return new Blob([pdfBlob], { type: 'application/pdf' })
}

export async function abrirComprovante(encomenda, target = '_blank') {
  const reservedWindow = target === '_blank' ? window.open('', target) : null
  const pdfUrl = await gerarComprovanteUrl(encomenda)

  if (reservedWindow && !reservedWindow.closed) {
    reservedWindow.location.replace(pdfUrl)
  } else if (target === '_self') {
    window.location.assign(pdfUrl)
  }

  return {
    pdfUrl,
    opened: Boolean(reservedWindow) || target === '_self',
  }
}

export async function abrirReciboRetirada(encomenda, target = '_blank') {
  const reservedWindow = target === '_blank' ? window.open('', target) : null
  const pdfUrl = await gerarReciboRetirada(encomenda)

  if (reservedWindow && !reservedWindow.closed) {
    reservedWindow.location.replace(pdfUrl)
  } else if (target === '_self') {
    window.location.assign(pdfUrl)
  }

  return {
    pdfUrl,
    opened: Boolean(reservedWindow) || target === '_self',
  }
}
