function normalizarData(valor) {
  if (!valor) {
    return null
  }

  if (typeof valor?.toDate === 'function') {
    return valor.toDate()
  }

  const date = new Date(valor)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatarData(valor) {
  const data = normalizarData(valor)

  if (!data) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

function formatarDataPeriodo(valor) {
  if (!valor) {
    return ''
  }

  const [ano, mes, dia] = String(valor).split('-')

  if (!ano || !mes || !dia) {
    return valor
  }

  return `${dia}/${mes}/${ano}`
}

export async function gerarCaixaPdf({ itens, dataInicial, dataFinal, totalEntrada, valorFaturado }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  pdf.setFillColor(15, 76, 129)
  pdf.rect(0, 0, 210, 24, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Relatorio de Caixa', 14, 15)

  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(11)
  pdf.text(`Periodo: ${formatarDataPeriodo(dataInicial) || 'inicio'} ate ${formatarDataPeriodo(dataFinal) || 'hoje'}`, 14, 34)
  pdf.text(`Entradas no periodo: R$ ${Number(totalEntrada || 0).toFixed(2)}`, 14, 42)
  pdf.text(`Valor faturado no periodo: R$ ${Number(valorFaturado || 0).toFixed(2)}`, 14, 50)
  pdf.text(`Quantidade de registros: ${itens.length}`, 14, 58)

  let y = 70

  for (const item of itens) {
    if (y > 270) {
      pdf.addPage()
      y = 20
    }

    pdf.setDrawColor(219, 234, 254)
    pdf.setFillColor(248, 251, 255)
    pdf.roundedRect(14, y - 6, 182, 24, 4, 4, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.origem || 'Movimentacao', 18, y + 1)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Codigo: ${item.encomendaCodigo || '-'}`, 18, y + 8)
    pdf.text(`Pagamento: ${item.formaPagamento || '-'}`, 18, y + 15)
    pdf.text(`Data: ${formatarData(item.criadoEm)}`, 98, y + 8)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`R$ ${Number(item.valor || 0).toFixed(2)}`, 160, y + 8)
    y += 30
  }

  const nomeArquivo = `caixa-${dataInicial || 'inicio'}-${dataFinal || 'hoje'}.pdf`
  pdf.save(nomeArquivo)
}
