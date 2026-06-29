import { drawSystemPdfHeader } from './pdfBranding.js'

function normalizarData(valor) {
  if (!valor) {
    return null
  }

  if (typeof valor?.toDate === 'function') {
    return valor.toDate()
  }

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

function formatarDataHora(valor) {
  const data = normalizarData(valor)

  if (!data) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

export async function gerarResumoVendaHorarioPdf({ viagem, passagens, resumo }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  await drawSystemPdfHeader(pdf, {
    title: 'Resumo de Vendas do Caixa',
  })

  pdf.setTextColor(15, 23, 42)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(`Embarcacao: ${viagem?.embarcacaoNome || '-'}`, 14, 34)
  pdf.text(`Trecho: ${viagem?.origem || '-'} -> ${viagem?.destino || '-'}`, 14, 42)
  pdf.text(`Horario: ${viagem?.dataViagem || '-'} ${viagem?.horarioSaida || ''}`.trim(), 14, 50)
  pdf.text(`Caixa aberto em: ${formatarDataHora(resumo?.abertoEm)}`, 14, 58)
  pdf.text(`Caixa encerrado em: ${formatarDataHora(resumo?.fechadoEm)}`, 14, 66)
  pdf.text(`Total arrecadado: R$ ${Number(resumo?.totalArrecadado || 0).toFixed(2)}`, 14, 74)
  pdf.text(`Passagens do horario: ${Number(resumo?.passagensDoHorario || 0)}`, 14, 82)
  pdf.text(`Passagens antecipadas: ${Number(resumo?.passagensAntecipadas || 0)}`, 14, 90)
  pdf.text(`Canceladas: ${Number(resumo?.passagensCanceladas || 0)}`, 14, 98)

  let y = 112

  if (!passagens.length) {
    pdf.setFont('helvetica', 'italic')
    pdf.text('Nenhuma venda registrada neste horario.', 14, y)
    return pdf.output('blob')
  }

  for (const item of passagens) {
    if (y > 268) {
      pdf.addPage()
      y = 20
    }

    pdf.setDrawColor(219, 234, 254)
    pdf.setFillColor(248, 251, 255)
    pdf.roundedRect(14, y - 6, 182, 24, 4, 4, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.codigo || '-', 18, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.passageiroNome || 'Sem nome', 18, y + 7)
    pdf.text(`Tarifa: ${item.tarifaTipo || '-'}`, 18, y + 14)
    pdf.text(`Pagamento: ${item.formaPagamento || '-'}`, 88, y + 14)
    pdf.text(`Status: ${item.status || '-'}`, 88, y + 7)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`R$ ${Number(item.valor || 0).toFixed(2)}`, 160, y + 10)
    y += 30
  }

  return pdf.output('blob')
}

export async function abrirResumoVendaHorarioPdf(payload, target = '_blank') {
  const pdfBlob = await gerarResumoVendaHorarioPdf(payload)
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  const openedWindow = window.open(pdfUrl, target, 'noopener,noreferrer')

  return {
    pdfBlob,
    pdfUrl,
    openedWindow,
  }
}
