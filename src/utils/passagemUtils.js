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
  return [
    'BILHETE DE PASSAGEM',
    '',
    `Codigo: ${passagem?.codigo || '-'}`,
    `Passageiro: ${passagem?.passageiroNome || '-'}`,
    `Documento: ${passagem?.passageiroDocumento || '-'}`,
    `Origem: ${passagem?.origem || '-'}`,
    `Destino: ${passagem?.destino || '-'}`,
    `Terminal origem: ${passagem?.terminalOrigem || '-'}`,
    `Terminal destino: ${passagem?.terminalDestino || '-'}`,
    `Data: ${formatDateBR(passagem?.dataViagem)}`,
    `Saida: ${passagem?.horarioSaida || '-'}`,
    `Embarcacao: ${passagem?.embarcacaoNome || '-'}`,
    `Tarifa: ${passagem?.tarifaTipo || '-'}`,
    `Valor: R$ ${Number(passagem?.valor || 0).toFixed(2)}`,
    `Pagamento: ${passagem?.formaPagamento || '-'}`,
    `Status: ${passagem?.status || '-'}`,
  ].join('\n')
}
