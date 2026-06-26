import { hasFreteAccess, hasPassagemAccess } from './accessControl.js'

export function getCaixaCategoria(item) {
  const origem = String(item?.origem || '').toLowerCase()

  if (origem.includes('passagem') || item?.passagemCodigo || item?.viagemId) {
    return 'passagens'
  }

  if (origem.includes('frete') || origem.includes('encomenda') || item?.encomendaCodigo) {
    return 'fretes'
  }

  return 'outros'
}

export function filterCaixaItemsByModuleAccess(items, user) {
  const canAccessFretes = hasFreteAccess(user)
  const canAccessPassagens = hasPassagemAccess(user)

  return (items || []).filter((item) => {
    const categoria = getCaixaCategoria(item)

    if (categoria === 'fretes') {
      return canAccessFretes
    }

    if (categoria === 'passagens') {
      return canAccessPassagens
    }

    return canAccessFretes || canAccessPassagens
  })
}

export function getCaixaResumoFromItems(items) {
  const registros = items || []

  return {
    totalEntrada: registros
      .filter((item) => item.tipo === 'entrada')
      .reduce((sum, item) => sum + Number(item.valor || 0), 0),
    totalRegistros: registros.length,
  }
}

export function resumirCaixaPorCategoria(items) {
  return (items || []).reduce((acc, item) => {
    const categoria = getCaixaCategoria(item)
    acc[categoria].total += Number(item.valor || 0)
    acc[categoria].registros += 1
    return acc
  }, {
    fretes: { total: 0, registros: 0 },
    passagens: { total: 0, registros: 0 },
    outros: { total: 0, registros: 0 },
  })
}

