export async function gerarClientesPdf(clientes) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  pdf.setFillColor(15, 76, 129)
  pdf.rect(0, 0, 210, 24, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Relatorio de Clientes', 14, 15)

  pdf.setTextColor(15, 23, 42)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.text(`Quantidade de clientes: ${clientes.length}`, 14, 34)

  let y = 46

  for (const cliente of clientes) {
    if (y > 270) {
      pdf.addPage()
      y = 20
    }

    pdf.setDrawColor(219, 234, 254)
    pdf.setFillColor(248, 251, 255)
    pdf.roundedRect(14, y - 6, 182, 28, 4, 4, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.text(cliente.nome || 'Sem nome', 18, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Telefone: ${cliente.telefone || '-'}`, 18, y + 8)
    pdf.text(`E-mail: ${cliente.email || '-'}`, 18, y + 15)
    pdf.text(`Documento: ${cliente.documento || '-'}`, 110, y + 8)
    pdf.text(`Cidade: ${cliente.cidade || '-'}`, 110, y + 15)
    y += 34
  }

  pdf.save('clientes-cadastrados.pdf')
}
