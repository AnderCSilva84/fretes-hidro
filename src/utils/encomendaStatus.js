function normalizarData(valor) {
  if (!valor) {
    return null
  }

  if (typeof valor?.toDate === 'function') {
    const data = valor.toDate()
    return Number.isNaN(data?.getTime?.()) ? null : data
  }

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

export function isEncomendaPostadaEmAtraso(item, diasLimite = 2) {
  if (String(item?.status || '').trim() !== 'Postado') {
    return false
  }

  const criadoEm = normalizarData(item?.criadoEm)

  if (!criadoEm) {
    return false
  }

  const diferencaMs = Date.now() - criadoEm.getTime()
  return diferencaMs > diasLimite * 24 * 60 * 60 * 1000
}

export function getEncomendaStatusLabel(status) {
  const normalizedStatus = String(status || '').trim()

  if (normalizedStatus === 'Chegou ao terminal') {
    return 'Aguardando retirada'
  }

  return normalizedStatus || 'Sem status'
}

export function getEncomendaStatusPresentation(item) {
  const status = String(item?.status || '').trim() || 'Sem status'

  if (status === 'Entregue') {
    return {
      label: getEncomendaStatusLabel(status),
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    }
  }

  if (status === 'Chegou ao terminal') {
    return {
      label: getEncomendaStatusLabel(status),
      className: 'bg-sky-100 text-sky-800 border border-sky-200',
    }
  }

  if (status === 'Postado' && isEncomendaPostadaEmAtraso(item)) {
    return {
      label: 'Postado ha mais de 2 dias',
      className: 'bg-rose-100 text-rose-800 border border-rose-200',
    }
  }

  if (status === 'Postado') {
    return {
      label: getEncomendaStatusLabel(status),
      className: 'bg-amber-100 text-amber-800 border border-amber-200',
    }
  }

  if (status === 'Cancelado') {
    return {
      label: getEncomendaStatusLabel(status),
      className: 'bg-slate-200 text-slate-700 border border-slate-300',
    }
  }

  return {
    label: getEncomendaStatusLabel(status),
    className: 'bg-violet-100 text-violet-800 border border-violet-200',
  }
}

export function getEncomendasDashboardMetrics(items) {
  return (items || []).reduce((acc, item) => {
    const status = String(item?.status || '').trim()

    if (status === 'Entregue') {
      acc.entreguesCliente += 1
      return acc
    }

    if (status === 'Chegou ao terminal') {
      acc.esperaRetirada += 1
      return acc
    }

    if (status === 'Postado' || status === 'Em transito') {
      acc.emFluxo += 1
    }

    return acc
  }, {
    emFluxo: 0,
    esperaRetirada: 0,
    entreguesCliente: 0,
  })
}
