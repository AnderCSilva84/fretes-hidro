export function normalizeSearchValue(value, { upper = false } = {}) {
  const normalized = String(value || '').trim()
  return upper ? normalized.toUpperCase() : normalized.toLowerCase()
}

export function getIndexedFieldName(collectionName, fieldName) {
  if (fieldName.endsWith('Busca')) {
    return fieldName
  }

  if (fieldName === 'nome' && ['clientes', 'usuarios', 'embarcacoes', 'terminais', 'empresas', 'passageiros'].includes(collectionName)) {
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

  if (collectionName === 'passagens' && fieldName === 'codigo') {
    return 'codigoBusca'
  }

  if (collectionName === 'passagens' && fieldName === 'passageiroNome') {
    return 'passageiroBusca'
  }

  if (collectionName === 'passagens' && fieldName === 'passageiroDocumento') {
    return 'documentoBusca'
  }

  if (collectionName === 'viagens' && fieldName === 'codigoViagem') {
    return 'codigoBusca'
  }

  return fieldName
}

export function prepareCollectionPayload(collectionName, payload) {
  const preparedPayload = { ...payload }

  if (['clientes', 'usuarios', 'embarcacoes', 'terminais', 'empresas', 'passageiros'].includes(collectionName)) {
    preparedPayload.nomeBusca = normalizeSearchValue(payload.nome)
  }

  if (collectionName === 'usuarios') {
    preparedPayload.emailBusca = normalizeSearchValue(payload.email)
  }

  if (collectionName === 'rotasValores') {
    const origem = String(payload.origem || '').trim()
    const destino = String(payload.destino || '').trim()
    const terminaisDestino = Array.isArray(payload.terminaisDestino)
      ? payload.terminaisDestino.map((item) => String(item || '').trim()).filter(Boolean)
      : String(payload.terminalDestino || '')
        .split('|')
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    const terminalDestinoPrincipal = String(payload.terminalDestino || terminaisDestino[0] || '').trim()

    preparedPayload.origemBusca = normalizeSearchValue(origem)
    preparedPayload.destinoBusca = normalizeSearchValue(destino)
    preparedPayload.linhaBusca = normalizeSearchValue(`${origem} ${destino}`.trim())
    preparedPayload.terminaisDestino = terminaisDestino
    preparedPayload.terminalDestino = terminalDestinoPrincipal
    preparedPayload.terminalDestinoBusca = normalizeSearchValue(terminaisDestino.join(' '))
  }

  if (collectionName === 'encomendas') {
    preparedPayload.codigoBusca = normalizeSearchValue(payload.codigo, { upper: true })
    preparedPayload.remetenteBusca = normalizeSearchValue(payload.remetenteNome)
    preparedPayload.destinatarioBusca = normalizeSearchValue(payload.destinatarioNome)
    preparedPayload.terminalDestinoBusca = normalizeSearchValue(payload.terminalDestino)
  }

  if (collectionName === 'viagens') {
    preparedPayload.codigoBusca = normalizeSearchValue(payload.codigoViagem, { upper: true })
    preparedPayload.origemBusca = normalizeSearchValue(payload.origem)
    preparedPayload.destinoBusca = normalizeSearchValue(payload.destino)
    preparedPayload.viagemBusca = normalizeSearchValue(`${payload.origem || ''} ${payload.destino || ''} ${payload.dataViagem || ''}`.trim())
  }

  if (collectionName === 'passageiros') {
    preparedPayload.documentoBusca = normalizeSearchValue(payload.documento)
  }

  if (collectionName === 'passagens') {
    preparedPayload.codigoBusca = normalizeSearchValue(payload.codigo, { upper: true })
    preparedPayload.passageiroBusca = normalizeSearchValue(payload.passageiroNome)
    preparedPayload.documentoBusca = normalizeSearchValue(payload.passageiroDocumento)
    preparedPayload.viagemBusca = normalizeSearchValue(`${payload.origem || ''} ${payload.destino || ''} ${payload.dataViagem || ''}`.trim())
  }

  return preparedPayload
}
