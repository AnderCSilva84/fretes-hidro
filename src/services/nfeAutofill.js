const DEFAULT_ENDPOINT = '/api/nfe/extract-from-image'

export async function extractNfeFromImage(file, { empresaId = '', operadorId = '' } = {}) {
  if (!(file instanceof File)) {
    throw new Error('Selecione uma imagem valida da nota fiscal.')
  }

  const endpoint = import.meta.env.VITE_NFE_AUTOFILL_ENDPOINT || DEFAULT_ENDPOINT
  const formData = new FormData()
  formData.append('image', file)
  if (empresaId) formData.append('empresaId', empresaId)
  if (operadorId) formData.append('operadorId', operadorId)

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Nao foi possivel ler a nota fiscal agora.')
  }

  return {
    data: payload.data || {},
    confidence: payload.confidence || {},
    model: payload.model || '',
  }
}
