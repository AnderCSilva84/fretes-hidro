import { formatDateBR } from './date.js'

export function normalizeDocumento(value) {
  return String(value || '').replace(/\D/g, '')
}

export function normalizarDocumento(value) {
  return normalizeDocumento(value)
}

export function calcularHorarioChegada(dataViagem, horarioSaida, duracaoMinutos) {
  if (!dataViagem || !horarioSaida || !Number.isFinite(Number(duracaoMinutos))) {
    return ''
  }

  const [year, month, day] = String(dataViagem).split('-').map(Number)
  const [hour, minute] = String(horarioSaida).split(':').map(Number)

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return ''
  }

  const partida = new Date(year, month - 1, day, hour, minute)
  partida.setMinutes(partida.getMinutes() + Number(duracaoMinutos || 0))

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(partida)
}

export async function gerarCodigoPassagem(getLastCode) {
  const now = new Date()
  const ano = now.getFullYear()
  const mes = String(now.getMonth() + 1).padStart(2, '0')
  const dia = String(now.getDate()).padStart(2, '0')
  const prefixo = `PAS-${ano}${mes}${dia}-`
  const ultimoCodigo = await getLastCode(prefixo)
  const ultimoNumero = ultimoCodigo ? Number(String(ultimoCodigo).split('-').pop()) : 0

  return `${prefixo}${String(ultimoNumero + 1).padStart(4, '0')}`
}

export function formatarBilheteTextoTermico(passagem) {
  const origem = String(passagem?.origem || '-').trim()
  const destino = String(passagem?.destino || '-').trim()
  const terminalOrigem = String(passagem?.terminalOrigem || '').trim()
  const terminalDestino = String(passagem?.terminalDestino || '').trim()

  return [
    'NAVIA',
    'BILHETE DE PASSAGEM',
    passagem?.segundaVia ? '*** SEGUNDA VIA ***' : null,
    '',
    `Codigo: ${passagem?.codigo || '-'}`,
    `${origem} -> ${destino}`,
    `Saida: ${formatDateBR(passagem?.dataViagem)} ${passagem?.horarioSaida || '-'}`,
    `Passageiro: ${passagem?.passageiroNome || '-'}`,
    `Documento: ${passagem?.passageiroDocumento || '-'}`,
    terminalOrigem ? `T. origem: ${terminalOrigem}` : null,
    terminalDestino ? `T. destino: ${terminalDestino}` : null,
    `Embarcacao: ${passagem?.embarcacaoNome || '-'}`,
    `Tarifa: ${passagem?.tarifaTipo || '-'}`,
    `Valor: R$ ${Number(passagem?.valor || 0).toFixed(2)}`,
    `Pagamento: ${passagem?.formaPagamento || '-'}`,
    `Status: ${passagem?.status || '-'}`,
  ].filter(Boolean).join('\n')
}
