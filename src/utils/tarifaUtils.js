export function isTarifaAntecipada(tarifaTipo) {
  return String(tarifaTipo || '').trim().toLowerCase() === 'passagem antecipada'
}

export function calcularValorTarifa(tarifaTipo, valorPadrao = 0) {
  const valorBase = Number(valorPadrao || 0)

  if (!Number.isFinite(valorBase)) {
    return ''
  }

  if (isTarifaAntecipada(tarifaTipo)) {
    return valorBase.toFixed(2)
  }

  if (['Estudante', 'Gratuidade', 'Crianca de colo', 'Crianca', 'Idoso'].includes(tarifaTipo)) {
    return ''
  }

  if (tarifaTipo === 'Meia') {
    return (valorBase / 2).toFixed(2)
  }

  return valorBase.toFixed(2)
}
