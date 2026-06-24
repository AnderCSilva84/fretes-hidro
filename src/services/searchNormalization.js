export function normalizeSearchValue(value, { upper = false } = {}) {
  const normalized = String(value || '').trim()
  return upper ? normalized.toUpperCase() : normalized.toLowerCase()
}

export function getIndexedFieldName(collectionName, fieldName) {
  if (fieldName.endsWith('Busca')) {
    return fieldName
  }

  if (fieldName === 'nome' && ['clientes', 'usuarios', 'embarcacoes', 'terminais', 'empresas'].includes(collectionName)) {
    return 'nomeBusca'
  }

  if (collectionName === 'rotasValores' && fieldName === 'origem') {
    return 'origemBusca'
  }

  if (collectionName === 'rotasValores' && fieldName === 'destino') {
    return 'destinoBusca'
  }

  if (collectionName === 'rotasValores' && fieldName === 'linha') {
    return 'linhaBusca'
  }

  if (collectionName === 'usuarios' && fieldName === 'email') {
    return 'emailBusca'
  }

  if (collectionName === 'encomendas' && fieldName === 'codigo') {
    return 'codigoBusca'
  }

  return fieldName
}

export function prepareCollectionPayload(collectionName, payload) {
  const preparedPayload = { ...payload }

  if (['clientes', 'usuarios', 'embarcacoes', 'terminais', 'empresas'].includes(collectionName)) {
    preparedPayload.nomeBusca = normalizeSearchValue(payload.nome)
  }

  if (collectionName === 'usuarios') {
    preparedPayload.emailBusca = normalizeSearchValue(payload.email)
  }

  if (collectionName === 'rotasValores') {
    const origem = String(payload.origem || '').trim()
    const destino = String(payload.destino || '').trim()
    const terminalDestino = String(payload.terminalDestino || '').trim()

    preparedPayload.origemBusca = normalizeSearchValue(origem)
    preparedPayload.destinoBusca = normalizeSearchValue(destino)
    preparedPayload.linhaBusca = normalizeSearchValue(`${origem} ${destino}`.trim())
    preparedPayload.terminalDestinoBusca = normalizeSearchValue(terminalDestino)
  }

  if (collectionName === 'encomendas') {
    preparedPayload.codigoBusca = normalizeSearchValue(payload.codigo, { upper: true })
    preparedPayload.remetenteBusca = normalizeSearchValue(payload.remetenteNome)
    preparedPayload.destinatarioBusca = normalizeSearchValue(payload.destinatarioNome)
    preparedPayload.terminalDestinoBusca = normalizeSearchValue(payload.terminalDestino)
  }

  return preparedPayload
}
