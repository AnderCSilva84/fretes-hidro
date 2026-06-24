import { obterRemetenteNome } from './remetente.js'

function formatarDataHora(valor) {
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

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2)}`
}

export async function gerarReciboRetirada(encomenda) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const modo = encomenda.modoBaixa === 'entrega' ? 'entrega' : 'retirada'
  const recebedor = encomenda.retiradaRecebedorNome || encomenda.destinatarioNome || '-'
  const documento = encomenda.retiradaRecebedorDocumento || '-'
  const retiradaEm = formatarDataHora(encomenda.entregueEm || encomenda.retiradaFinalizadaEm)
  const operador = encomenda.operadorEntregaNome || encomenda.operadorEntregaEmail || '-'

  pdf.setFillColor(15, 76, 129)
  pdf.rect(0, 0, 210, 28, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(`Recibo de ${modo === 'entrega' ? 'Entrega' : 'Retirada'}`, 14, 18)

  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Codigo: ${encomenda.codigo || '-'}`, 14, 40)
  pdf.text(`Data da postagem: ${encomenda.dataComanda || '-'}`, 14, 48)
  pdf.text(`Horario da postagem: ${encomenda.horarioChegada || '-'}`, 14, 56)
  pdf.text(`Saida da embarcacao: ${encomenda.horarioSaidaEmbarcacao || '-'}`, 14, 64)
  pdf.text(`Remetente: ${obterRemetenteNome(encomenda.remetenteNome)}`, 14, 80)
  pdf.text(`Destinatario: ${encomenda.destinatarioNome || '-'}`, 14, 88)
  pdf.text(`Origem: ${encomenda.terminalOrigem || '-'}`, 14, 96)
  pdf.text(`Destino: ${encomenda.terminalDestino || '-'}`, 14, 104)
  pdf.text(`Valor total: ${formatarMoeda(encomenda.valorTotal)}`, 14, 112)

  pdf.setFont('helvetica', 'bold')
  pdf.text(`Dados da ${modo}`, 14, 128)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Recebedor: ${recebedor}`, 14, 138)
  pdf.text(`Documento: ${documento}`, 14, 146)
  pdf.text(`${modo === 'entrega' ? 'Entrega' : 'Retirada'} em: ${retiradaEm}`, 14, 154)
  pdf.text(`Registrado por: ${operador}`, 14, 162)

  if (encomenda.retiradaObservacao) {
    pdf.text(`Observacao: ${encomenda.retiradaObservacao}`, 14, 170, {
      maxWidth: 180,
    })
  }

  pdf.setFont('helvetica', 'bold')
  pdf.text('Assinatura do cliente', 14, 188)
  pdf.setDrawColor(203, 213, 225)
  pdf.roundedRect(14, 194, 182, 46, 4, 4)

  if (encomenda.assinaturaRetiradaDataUrl) {
    pdf.addImage(encomenda.assinaturaRetiradaDataUrl, 'PNG', 20, 199, 170, 30)
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Este recibo confirma a ${modo} da postagem pelo recebedor identificado acima.`, 14, 252)

  return pdf.output('bloburl')
}
