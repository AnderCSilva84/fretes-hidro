import { SYSTEM_NAME } from './systemConfig.js'

function formatarDataHora(dataViagem, horarioSaida) {
  if (!dataViagem) {
    return horarioSaida || '-'
  }

  const data = dataViagem.includes('/') ? dataViagem : dataViagem.split('-').reverse().join('/')
  return `${data} ${horarioSaida || ''}`.trim()
}

export async function gerarBilhetePassagemPDF(passagem) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  pdf.setFillColor(15, 76, 129)
  pdf.rect(0, 0, 210, 28, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(SYSTEM_NAME, 14, 18)

  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(16)
  pdf.text('Bilhete de Passagem', 14, 40)

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Codigo: ${passagem?.codigo || '-'}`, 14, 52)
  pdf.text(`Passageiro: ${passagem?.passageiroNome || '-'}`, 14, 60)
  pdf.text(`Documento: ${passagem?.passageiroDocumento || '-'}`, 14, 68)
  pdf.text(`Origem: ${passagem?.origem || '-'}`, 14, 76)
  pdf.text(`Destino: ${passagem?.destino || '-'}`, 14, 84)
  pdf.text(`Terminal origem: ${passagem?.terminalOrigem || '-'}`, 14, 92)
  pdf.text(`Terminal destino: ${passagem?.terminalDestino || '-'}`, 14, 100)
  pdf.text(`Viagem: ${formatarDataHora(passagem?.dataViagem, passagem?.horarioSaida)}`, 14, 108)
  pdf.text(`Embarcacao: ${passagem?.embarcacaoNome || '-'}`, 14, 116)
  pdf.text(`Tarifa: ${passagem?.tarifaTipo || '-'}`, 14, 124)
  pdf.text(`Forma de pagamento: ${passagem?.formaPagamento || '-'}`, 14, 132)
  pdf.text(`Status: ${passagem?.status || '-'}`, 14, 140)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Valor: R$ ${Number(passagem?.valor || 0).toFixed(2)}`, 14, 150)

  if (passagem?.qrCodeDataUrl) {
    pdf.addImage(passagem.qrCodeDataUrl, 'PNG', 140, 56, 46, 46)
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text('Apresente este bilhete no embarque.', 14, 170)

  return pdf.output('blob')
}

export async function abrirBilhetePassagem(passagem, target = '_blank') {
  const pdfBlob = await gerarBilhetePassagemPDF(passagem)
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  const openedWindow = window.open(pdfUrl, target, 'noopener,noreferrer')

  return {
    pdfUrl,
    opened: Boolean(openedWindow) || target === '_self',
  }
}
