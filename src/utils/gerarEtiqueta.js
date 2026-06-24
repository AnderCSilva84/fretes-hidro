import { obterRemetenteNome } from './remetente.js'
import { SYSTEM_NAME } from './systemConfig.js'

function formatarDataHoraRegistro(valor) {
  if (!valor) {
    return '-'
  }

  const dateValue = valor?.toDate ? valor.toDate() : new Date(valor)

  if (Number.isNaN(dateValue.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(dateValue)
}

export async function gerarEtiqueta(encomenda, qrCodeDataUrl) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: [100, 150] })
  const operador = encomenda.operadorNome || encomenda.operadorEmail || '-'
  const horarioRegistro = formatarDataHoraRegistro(encomenda.criadoEm)
  const embarcacaoNome = encomenda.embarcacaoNome || '-'

  pdf.setFillColor(15, 76, 129)
  pdf.rect(0, 0, 100, 18, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text(SYSTEM_NAME, 10, 11)

  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(11)
  pdf.text(`Codigo: ${encomenda.codigo || '-'}`, 10, 28)
  pdf.text(`Data: ${encomenda.dataComanda || '-'}`, 10, 35)
  pdf.text(`Postagem: ${encomenda.horarioChegada || '-'}`, 10, 42)
  pdf.text(`Saida embarc.: ${encomenda.horarioSaidaEmbarcacao || '-'}`, 10, 49)
  pdf.text(`Embarcacao: ${embarcacaoNome}`, 10, 56)
  pdf.text(`Remetente: ${obterRemetenteNome(encomenda.remetenteNome)}`, 10, 63)
  pdf.text(`Destinatario: ${encomenda.destinatarioNome || '-'}`, 10, 70)
  pdf.text(`Origem: ${encomenda.terminalOrigem || '-'}`, 10, 77)
  pdf.text(`Destino: ${encomenda.terminalDestino || '-'}`, 10, 84)
  pdf.text(`Frete: ${encomenda.freteCobranca || '-'}`, 10, 91)
  pdf.text(`Operador: ${operador}`, 10, 98)
  pdf.text(`Registro: ${horarioRegistro}`, 10, 105)
  pdf.text(`Valor frete: R$ ${Number(encomenda.valorFrete || 0).toFixed(2)}`, 10, 112)
  pdf.text(`Valor merc.: R$ ${Number(encomenda.valorDeclarado || 0).toFixed(2)}`, 10, 119)
  pdf.text(`Total: R$ ${Number(encomenda.valorTotal || 0).toFixed(2)}`, 10, 126)

  if (qrCodeDataUrl) {
    pdf.addImage(qrCodeDataUrl, 'PNG', 58, 102, 28, 28)
  }

  pdf.setFontSize(9)
  pdf.text('Apresente este comprovante no balcao de atendimento.', 10, 137, {
    maxWidth: 44,
  })
  pdf.text(`Rastreio: ${encomenda.rastreioUrl || '-'}`, 10, 144, {
    maxWidth: 76,
  })

  return pdf.output('blob')
}
