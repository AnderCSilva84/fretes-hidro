export function isTarifaAntecipada(tarifaTipo) {
  return ['antecipada', 'passagem antecipada'].includes(String(tarifaTipo || '').trim().toLowerCase())
}

export function isCriancaDeColo(tarifaTipo) {
  return String(tarifaTipo || '').trim().toLowerCase() === 'crianca de colo'
}

export function calcularValorTarifa(tarifaTipo, valorPadrao = 0) {
  const valorBase = Number(valorPadrao || 0)

  if (!Number.isFinite(valorBase)) {
    return ''
  }

  if (isTarifaAntecipada(tarifaTipo)) {
    return valorBase.toFixed(2)
  }

  if (['Estudante', 'Gratuidade', 'Crianca de colo', 'Crianca'].includes(tarifaTipo)) {
    return ''
  }

  if (tarifaTipo === 'Meia') {
    return (valorBase / 2).toFixed(2)
  }

  return valorBase.toFixed(2)
}
