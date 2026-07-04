const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_FILE_BYTES = 8 * 1024 * 1024
const DEFAULT_MODEL = 'gpt-4.1-mini'

const schema = {
  name: 'nfe_autofill',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      remetenteNome: { type: 'string' },
      remetenteDocumento: { type: 'string' },
      destinatarioNome: { type: 'string' },
      valorMercadoria: { type: 'string' },
      descricao: { type: 'string' },
      quantidadeVolumes: { type: 'string' },
      peso: { type: 'string' },
    },
    required: [
      'remetenteNome',
      'remetenteDocumento',
      'destinatarioNome',
      'valorMercadoria',
      'descricao',
      'quantidadeVolumes',
      'peso',
    ],
  },
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function normalizeExtractedData(data = {}) {
  return {
    remetenteNome: String(data?.remetenteNome || '').trim(),
    remetenteDocumento: String(data?.remetenteDocumento || '').trim(),
    destinatarioNome: String(data?.destinatarioNome || '').trim(),
    valorMercadoria: String(data?.valorMercadoria || '').replace(',', '.').trim(),
    descricao: String(data?.descricao || '').trim(),
    quantidadeVolumes: String(data?.quantidadeVolumes || '').trim(),
    peso: String(data?.peso || '').replace(',', '.').trim(),
  }
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'OPENAI_API_KEY nao configurada no servidor.' }, 500)
  }

  try {
    const formData = await request.formData()
    const image = formData.get('image')

    if (!(image instanceof File)) {
      return jsonResponse({ success: false, error: 'Envie uma imagem valida da nota fiscal.' }, 400)
    }

    if (image.size > MAX_FILE_BYTES) {
      return jsonResponse({ success: false, error: 'A imagem da nota precisa ter no maximo 8 MB.' }, 400)
    }

    const bytes = Buffer.from(await image.arrayBuffer())
    const dataUrl = `data:${image.type || 'image/jpeg'};base64,${bytes.toString('base64')}`
    const model = process.env.OPENAI_NFE_MODEL || DEFAULT_MODEL

    const completionResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: 'json_schema',
          json_schema: schema,
        },
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: 'Extraia somente os campos principais de um DANFE brasileiro. Nao invente dados. Se nao conseguir ler um campo com seguranca, retorne string vazia. Prefira descricoes curtas. Em valorMercadoria use somente numero decimal com ponto. Em quantidadeVolumes e peso retorne somente numero ou string vazia.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Leia esta foto de nota fiscal e retorne apenas remetenteNome, remetenteDocumento, destinatarioNome, valorMercadoria, descricao, quantidadeVolumes e peso. Nao liste itens, impostos, serie ou observacoes extras.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'low',
                },
              },
            ],
          },
        ],
      }),
    })

    const completionPayload = await completionResponse.json()

    if (!completionResponse.ok) {
      return jsonResponse({
        success: false,
        error: completionPayload?.error?.message || 'Nao foi possivel interpretar a imagem da nota.',
      }, 502)
    }

    const content = completionPayload?.choices?.[0]?.message?.content
    const parsed = typeof content === 'string' ? JSON.parse(content) : {}
    const data = normalizeExtractedData(parsed)

    return jsonResponse({
      success: true,
      model,
      data,
      confidence: {},
    })
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error?.message || 'Nao foi possivel interpretar a imagem da nota.',
    }, 500)
  }
}
