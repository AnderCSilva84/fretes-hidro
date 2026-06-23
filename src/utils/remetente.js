export const REMETENTE_PADRAO = 'Entregador'

export function obterRemetenteNome(remetenteNome) {
  return String(remetenteNome || '').trim() || REMETENTE_PADRAO
}
