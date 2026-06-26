import { SYSTEM_NAME } from './systemConfig.js'

export async function gerarManifestoViagemPDF(viagem, passagens) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  pdf.setFillColor(15, 76, 129)
  pdf.rect(0, 0, 210, 24, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(`Manifesto de Viagem - ${SYSTEM_NAME}`, 14, 15)

  pdf.setTextColor(15, 23, 42)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(`Viagem: ${viagem?.origem || '-'} -> ${viagem?.destino || '-'}`, 14, 34)
  pdf.text(`Data: ${viagem?.dataViagem || '-'} ${viagem?.horarioSaida || ''}`.trim(), 14, 42)
  pdf.text(`Embarcacao: ${viagem?.embarcacaoNome || '-'}`, 14, 50)
  pdf.text(`Total de passageiros: ${passagens.length}`, 14, 58)

  let y = 74
  for (const item of passagens) {
    if (y > 270) {
      pdf.addPage()
      y = 20
    }

    pdf.setDrawColor(219, 234, 254)
    pdf.setFillColor(248, 251, 255)
    pdf.roundedRect(14, y - 6, 182, 20, 4, 4, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.passageiroNome || 'Sem nome', 18, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Documento: ${item.passageiroDocumento || '-'}`, 18, y + 7)
    pdf.text(`Status: ${item.status || '-'}`, 88, y + 7)
    pdf.text(`Valor: R$ ${Number(item.valor || 0).toFixed(2)}`, 144, y + 7)
    y += 26
  }

  return pdf.output('blob')
}

export async function abrirManifestoViagem(viagem, passagens, target = '_blank') {
  const pdfBlob = await gerarManifestoViagemPDF(viagem, passagens)
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  const openedWindow = window.open(pdfUrl, target, 'noopener,noreferrer')

  return {
    pdfUrl,
    opened: Boolean(openedWindow) || target === '_self',
  }
}
