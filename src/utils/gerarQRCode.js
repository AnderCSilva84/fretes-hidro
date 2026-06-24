export function montarRastreioUrl(codigo) {
  return `${window.location.origin}/#/rastreio/${encodeURIComponent(codigo)}`
}

export async function gerarQRCode(codigo) {
  const { default: QRCode } = await import('qrcode')
  const url = montarRastreioUrl(codigo)

  return QRCode.toDataURL(url, {
    margin: 1,
    width: 280,
    color: {
      dark: '#0f4c81',
      light: '#ffffff',
    },
  })
}
