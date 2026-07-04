const NFE_FIELDS = [
  'remetenteNome',
  'remetenteDocumento',
  'destinatarioNome',
  'valorMercadoria',
  'descricao',
  'quantidadeVolumes',
  'peso',
]

export function createEmptyNfeAutofill() {
  return {
    remetenteNome: '',
    remetenteDocumento: '',
    destinatarioNome: '',
    valorMercadoria: '',
    descricao: '',
    quantidadeVolumes: '',
    peso: '',
  }
}

export function sanitizeNfeAutofill(data = {}) {
  return NFE_FIELDS.reduce((accumulator, field) => {
    const value = data?.[field]
    accumulator[field] = value == null ? '' : String(value).trim()
    return accumulator
  }, createEmptyNfeAutofill())
}

export function listFilledNfeFields(data = {}) {
  const normalized = sanitizeNfeAutofill(data)
  return NFE_FIELDS.filter((field) => normalized[field])
}

export function applyNfeAutofillToForm(form, data = {}) {
  const normalized = sanitizeNfeAutofill(data)
  const nextForm = { ...form }

  if (normalized.remetenteNome) nextForm.remetenteNome = normalized.remetenteNome
  if (normalized.remetenteDocumento) nextForm.remetenteDocumento = normalized.remetenteDocumento
  if (normalized.destinatarioNome) nextForm.destinatarioNome = normalized.destinatarioNome
  if (normalized.valorMercadoria) nextForm.valorMercadoria = normalized.valorMercadoria
  if (normalized.descricao) {
    nextForm.descricao = normalized.descricao
    if (!String(nextForm.tipoMercadoria || '').trim()) {
      nextForm.tipoMercadoria = normalized.descricao
    }
  }
  if (normalized.quantidadeVolumes) {
    nextForm.quantidadeVolumes = normalized.quantidadeVolumes
    nextForm.quantidade = normalized.quantidadeVolumes
  }
  if (normalized.peso) nextForm.peso = normalized.peso

  if (listFilledNfeFields(normalized).length) {
    nextForm.possuiNotaFiscal = true
  }

  return nextForm
}
