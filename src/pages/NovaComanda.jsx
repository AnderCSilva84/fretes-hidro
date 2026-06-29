import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { addCollectionDocument, criarEncomenda, gerarCodigoEncomenda, searchCollectionByField, updateCollectionDocument } from '../services/firebase.js'
import { abrirComprovante, gerarComprovanteArquivo } from '../utils/encomendaMedia.js'
import { gerarQRCode, montarRastreioUrl } from '../utils/gerarQRCode.js'
import { obterRemetenteNome } from '../utils/remetente.js'
import { reportRuntimeError } from '../utils/runtimeDiagnostics.js'
import { SYSTEM_ICON_SRC, SYSTEM_NAME } from '../utils/systemConfig.js'

const emptyCliente = {
  nome: '',
  telefone: '',
  email: '',
  documento: '',
  cidade: '',
}

const documentOptions = ['Nota fiscal', 'Valor declarado']
const freightChargeOptions = ['Pago', 'A receber']

function createFreightItem(valorFrete = '') {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descricao: '',
    observacao: '',
    valorFrete: String(valorFrete ?? ''),
  }
}

function parseMoneyToCents(value) {
  const numeric = Number(String(value || '').replace(',', '.'))

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.round(numeric * 100)
}

function formatCentsToInput(cents) {
  const normalized = Math.max(0, Number(cents || 0))

  if (!Number.isFinite(normalized)) {
    return ''
  }

  const amount = normalized / 100

  if (Number.isInteger(amount)) {
    return String(amount)
  }

  return amount.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
}

function normalizarItensFrete(itens = []) {
  return itens
    .map((item) => ({
      ...item,
      descricao: String(item?.descricao || '').trim(),
      observacao: String(item?.observacao || '').trim(),
      valorFrete: String(item?.valorFrete ?? '').trim(),
    }))
    .filter((item) => item.descricao || item.observacao || item.valorFrete)
}

function resumirItensFrete(itens = []) {
  const ativos = normalizarItensFrete(itens)

  if (!ativos.length) {
    return ''
  }

  return ativos
    .map((item, index) => {
      const partes = [item.descricao || `Item ${index + 1}`]
      if (item.observacao) {
        partes.push(item.observacao)
      }
      return partes.join(' - ')
    })
    .join(' | ')
}

function createInitialForm() {
  return {
    dataComanda: new Date().toISOString().slice(0, 10),
    horarioChegada: new Date().toTimeString().slice(0, 5),
    horarioSaidaEmbarcacao: '',
    horarioSaidaManual: false,
    previsaoChegada: '',
    rotaId: '',
    linhaNome: '',
    embarcacaoId: '',
    embarcacaoNome: '',
    remetenteId: '',
    remetenteNome: '',
    remetenteDocumento: '',
    remetenteTelefone: '',
    remetenteEmail: '',
    destinatarioId: '',
    destinatarioNome: '',
    destinatarioTelefone: '',
    destinatarioEmail: '',
    terminalDestino: '',
    possuiNotaFiscal: false,
    valorDeclaradoAtivo: true,
    valorMercadoria: '',
    freteCobranca: 'A receber',
    valorFrete: '',
    valorFreteManual: false,
    itens: [createFreightItem()],
    descricao: '',
    quantidade: 1,
    peso: '',
    tipoMercadoria: '',
    formaPagamento: 'Dinheiro',
  }
}

function formatCurrency(value) {
  return `R$ ${Number(value || 0).toFixed(2)}`
}

function formatDateLabel(value) {
  if (!value) {
    return '--/--/----'
  }

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function criarMensagemCompartilhamento(encomenda) {
  const codigo = encomenda?.codigo || '-'
  const destinatario = encomenda?.destinatarioNome || 'destinatario'
  const origem = encomenda?.terminalOrigem || '-'
  const destino = encomenda?.terminalDestino || '-'

  return [
    `Comprovante de postagem do frete ${codigo}.`,
    `Destinatario: ${destinatario}.`,
    `Origem: ${origem}.`,
    `Destino: ${destino}.`,
  ].join(' ')
}

function criarNumeroWhatsapp(telefone) {
  const digits = String(telefone || '').replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

function suportaCompartilhamentoNativo(arquivo) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false
  }

  if (!arquivo) {
    return true
  }

  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare({ files: [arquivo] })
    } catch {
      return false
    }
  }

  return false
}

function formatarPrevisaoChegada(dataComanda, horarioSaida, duracaoMinutos) {
  if (!dataComanda || !horarioSaida || !Number.isFinite(Number(duracaoMinutos)) || Number(duracaoMinutos) <= 0) {
    return ''
  }

  const [year, month, day] = String(dataComanda).split('-').map(Number)
  const [hour, minute] = String(horarioSaida).split(':').map(Number)

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return ''
  }

  const chegada = new Date(year, month - 1, day, hour, minute)
  chegada.setMinutes(chegada.getMinutes() + Number(duracaoMinutos))

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(chegada)
}

function normalizarHorariosPartida(embarcacao) {
  const horarios = Array.isArray(embarcacao?.horariosPartida) && embarcacao.horariosPartida.length
    ? embarcacao.horariosPartida
    : embarcacao?.horarioPartidaPadrao
      ? [embarcacao.horarioPartidaPadrao]
      : []

  return horarios.map((item) => String(item || '').trim()).filter(Boolean).sort()
}

function escolherProximaPartida(horarioEntrada, horariosPartida) {
  const horarios = horariosPartida.map((item) => String(item || '').trim()).filter(Boolean).sort()

  if (!horarios.length) {
    return ''
  }

  if (!horarioEntrada) {
    return horarios[0]
  }

  const [horaEntrada, minutoEntrada] = String(horarioEntrada).split(':').map(Number)
  const totalEntrada = (Number.isFinite(horaEntrada) ? horaEntrada : 0) * 60 + (Number.isFinite(minutoEntrada) ? minutoEntrada : 0)

  const proximo = horarios.find((item) => {
    const [hora, minuto] = item.split(':').map(Number)
    const totalHorario = (Number.isFinite(hora) ? hora : 0) * 60 + (Number.isFinite(minuto) ? minuto : 0)
    return totalHorario >= totalEntrada
  })

  return proximo || horarios[0]
}

function obterDuracaoLinhaMinutos(linha) {
  if (!linha) {
    return 0
  }

  if (Number.isFinite(Number(linha.duracaoMinutos)) && Number(linha.duracaoMinutos) > 0) {
    return Number(linha.duracaoMinutos)
  }

  const encontrado = String(linha.tempoEstimado || '').match(/\d+/)
  return encontrado ? Number(encontrado[0]) : 0
}

function obterTerminalOrigemLinha(linha) {
  if (linha?.terminalOrigem) {
    return linha.terminalOrigem
  }

  const origem = String(linha?.origem || '').trim().toLowerCase()

  if (origem === 'belém' || origem === 'belem') {
    return 'THT Tamandaré'
  }

  if (origem === 'barcarena') {
    return 'Terminal Hidroviario de Barcarena'
  }

  if (origem === 'são francisco' || origem === 'sao francisco') {
    return 'Amazonat'
  }

  return ''
}

function obterTerminaisDestinoLinha(linha) {
  if (Array.isArray(linha?.terminaisDestino) && linha.terminaisDestino.length) {
    return linha.terminaisDestino.map((item) => String(item || '').trim()).filter(Boolean)
  }

  if (linha?.terminalDestino) {
    return [String(linha.terminalDestino).trim()].filter(Boolean)
  }

  if (linha?.destino) {
    return [String(linha.destino).trim()].filter(Boolean)
  }

  return []
}

function linhaDisponivelNoModulo(linha, modulo) {
  const exibirEm = String(linha?.exibirEm || 'ambos').trim().toLowerCase()
  return exibirEm === 'ambos' || exibirEm === modulo
}

function normalizarBuscaCliente(valor) {
  return String(valor || '').trim().toLowerCase()
}

function AppIcon({ children, className = '' }) {
  return (
    <div className={`flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full bg-blue-50 text-[#1c63e7] ${className}`}>
      {children}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <section className={`rounded-[1.85rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] ${className}`}>
      {children}
    </section>
  )
}

function CardHeader({ icon, title, children, iconClassName = '' }) {
  return (
    <div className="flex items-center gap-4">
      <AppIcon className={`h-[5.25rem] w-[5.25rem] bg-[#edf4ff] ${iconClassName}`}>{icon}</AppIcon>
      <div className="min-w-0 flex-1 pr-2">
        <p className="text-[1.05rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
        {children}
      </div>
    </div>
  )
}

// eslint-disable-next-line no-unused-vars
function CompactScheduleCard({ dataComanda, horarioPostagem, horarioSaidaEmbarcacao, previsaoChegada, onChange }) {
  return (
    <Card className="border-blue-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.9))]">
      <div className="flex flex-col items-start gap-4">
        <AppIcon className="h-14 w-14 sm:h-16 sm:w-16">
          <CalendarIcon />
        </AppIcon>
        <div className="w-full text-left">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Data</p>
              <p className="text-base font-bold text-slate-950">{formatDateLabel(dataComanda)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Postagem</p>
              <p className="text-base font-bold text-slate-950">{horarioPostagem || '--:--'}</p>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">SAÍDA EMBARCAÇÃO</p>
              <p className="text-base font-bold text-slate-950">{horarioSaidaEmbarcacao || '--:--'}</p>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Previsao de chegada</p>
              <p className="text-base font-bold text-[#1657d8]">{previsaoChegada || '--/--/---- --:--'}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Data</span>
              <input
                type="date"
                value={dataComanda}
                onChange={(event) => onChange('dataComanda', event.target.value)}
                className="block h-8 min-w-0 w-full max-w-full overflow-hidden rounded-[0.95rem] border border-slate-200 bg-white px-2 text-[0.72rem] font-semibold text-slate-900 outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 sm:h-9 sm:px-2.5 sm:text-[0.8rem]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Postagem</span>
              <input
                type="time"
                value={horarioPostagem}
                onChange={(event) => onChange('horarioChegada', event.target.value)}
                className="block h-7 min-w-0 w-full max-w-full overflow-hidden rounded-[0.9rem] border border-slate-200 bg-white px-2 text-[0.62rem] font-semibold text-slate-900 outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 sm:h-8 sm:px-2.5 sm:text-[0.72rem]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">SAÍDA EMBARCAÇÃO</span>
              <input
                type="time"
                value={horarioSaidaEmbarcacao}
                onChange={(event) => onChange('horarioSaidaEmbarcacao', event.target.value)}
                className="block h-9 min-w-0 w-full max-w-full overflow-hidden rounded-[1rem] border border-slate-200 bg-white px-2.5 text-[0.8rem] font-semibold text-slate-900 outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 sm:h-10 sm:px-3 sm:text-[0.88rem]"
              />
            </label>
          </div>
        </div>
      </div>
    </Card>
  )
}

function CompactScheduleCardRefined({ dataComanda, horarioPostagem, horarioSaidaEmbarcacao, previsaoChegada, onChange }) {
  return (
    <Card className="border-blue-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.9))]">
      <div className="space-y-5 text-left">
        <div className="flex items-start gap-4">
          <AppIcon className="h-20 w-20 bg-[#edf4ff]">
            <CalendarIcon />
          </AppIcon>

          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Data</p>
                <p className="mt-1 text-[1.05rem] font-bold leading-none text-slate-950">{formatDateLabel(dataComanda)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Postagem</p>
                <p className="mt-1 text-[1.05rem] font-bold leading-none text-slate-950">{horarioPostagem || '--:--'}</p>
              </div>
              <div className="col-span-2 min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Saida embarcacao</p>
                <p className="mt-1 text-[1.05rem] font-bold leading-none text-slate-950">{horarioSaidaEmbarcacao || '--:--'}</p>
              </div>
              <div className="col-span-2 min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Previsao de chegada</p>
                <p className="mt-1 text-[1.05rem] font-bold leading-none text-[#1657d8]">{previsaoChegada || '--/--/---- --:--'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-blue-100/80 pt-4">
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Data</span>
              <input
                type="date"
                value={dataComanda}
                onChange={(event) => onChange('dataComanda', event.target.value)}
                className="block h-10 min-w-0 w-full max-w-full overflow-hidden rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.92rem] font-semibold text-slate-900 outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Postagem</span>
              <input
                type="time"
                value={horarioPostagem}
                onChange={(event) => onChange('horarioChegada', event.target.value)}
                className="block h-10 min-w-0 w-full max-w-full overflow-hidden rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.92rem] font-semibold text-slate-900 outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Saida embarcacao</span>
              <input
                type="time"
                value={horarioSaidaEmbarcacao}
                onChange={(event) => onChange('horarioSaidaEmbarcacao', event.target.value)}
                className="block h-10 min-w-0 w-full max-w-full overflow-hidden rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.92rem] font-semibold text-slate-900 outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>
      </div>
    </Card>
  )
}

function PersonCard({
  title,
  value,
  subtitle,
  searchValue,
  phoneValue,
  emailValue,
  loading,
  suggestions,
  onSearchChange,
  onPhoneChange,
  onEmailChange,
  onPick,
  onOpenQuickAdd,
}) {
  return (
    <Card className="px-6 py-6">
      <div className="w-full">
        <div className="flex items-start gap-4">
          <AppIcon className="h-[5.25rem] w-[5.25rem] bg-[#edf4ff]">
            <PersonIcon />
          </AppIcon>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-[1.05rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
            <p className="mt-2 block min-w-0 text-[1.2rem] font-bold leading-snug text-slate-950 sm:text-[1.35rem]">{value || 'Selecionar'}</p>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="mx-auto mt-4 w-full max-w-[28rem] space-y-3 text-left">
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar ou digitar nome"
            className="h-10 w-full min-w-0 max-w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-3 text-[0.9rem] font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={phoneValue}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder="Telefone"
              className="h-10 w-full min-w-0 max-w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-3 text-[0.85rem] font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <input
              value={emailValue}
              type="email"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="E-mail"
              className="h-10 w-full min-w-0 max-w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-3 text-[0.85rem] font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {loading ? <p className="text-sm text-slate-500">Buscando...</p> : null}

          {suggestions.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition hover:bg-white"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{item.nome}</span>
                    <span className="block text-xs text-slate-500">{item.email || item.documento || item.telefone || 'Cadastro rapido'}</span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#1c63e7]">Usar</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-[28rem] justify-end">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.03em] text-[#1c63e7]"
          >
            <PlusSmallIcon />
            Novo {title}
          </button>
        </div>
      </div>
    </Card>
  )
}

function SelectCard({ title, value, options, onChange }) {
  return (
    <Card className="px-6 py-6">
      <div className="w-full">
        <CardHeader icon={<PinIcon />} title={title}>
          <p className="mt-2 text-[1.35rem] font-bold leading-tight text-slate-950">{value}</p>
        </CardHeader>

        <div className="mx-auto mt-4 grid w-full max-w-[28rem] grid-cols-1 gap-2 text-left">
          {options.map((option) => {
            const active = value === option

            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                  active
                    ? 'border-[#1c63e7] bg-blue-50 text-[#1549b3]'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function SegmentedChoice({ title, icon, options, activeValues, onToggle, single = false }) {
  return (
    <Card className="px-6 py-6">
      <div className="w-full">
        <CardHeader icon={icon} title={title} />
        <div className="mt-4 w-full">
          <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="grid grid-cols-2">
              {options.map((option, index) => {
                const active = activeValues.includes(option)

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onToggle(option, single)}
                    className={`flex min-h-[3.2rem] items-center justify-center gap-2 px-3 py-2 text-left text-[0.78rem] font-medium transition sm:min-h-[3.5rem] ${
                      index === 0 ? 'border-r border-slate-200' : ''
                    } ${active ? 'bg-[#edf4ff] text-[#1c63e7]' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-[#1c63e7]' : 'border-slate-300'}`}>
                      {active ? <span className="h-2 w-2 rounded-full bg-[#1c63e7]" /> : null}
                    </span>
                    <span className="max-w-[9ch] leading-none">{option}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function AmountCard({ title, value, onChange, large = false, icon, readOnly = false }) {
  return (
    <Card className={`${large ? '' : 'h-full'} px-6 py-6`}>
      <div className="w-full">
        <CardHeader icon={icon} title={title} />
        <div className="mx-auto mt-2 w-full max-w-[30rem]">
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            readOnly={readOnly}
            placeholder="0,00"
            className={`mt-1 h-16 w-full rounded-[1.6rem] border border-slate-200 bg-white px-5 text-center font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 ${readOnly ? 'cursor-default bg-slate-50' : ''} ${large ? 'text-[2.5rem]' : 'text-[2.2rem]'}`}
          />
          {readOnly ? (
            <p className="mt-3 text-center text-sm text-slate-500">
              Com varios itens, ajuste o valor em cada item para formar o total.
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function FreightItemsCard({ itens, onChangeItem, onAddItem, onRemoveItem }) {
  return (
    <Card className="px-6 py-6">
      <div className="w-full">
        <CardHeader icon={<NoteIcon />} title="Itens da comanda">
          <p className="mt-2 text-sm text-slate-500">Adicione quantos volumes precisar, cada um com sua descricao, observacao e valor.</p>
        </CardHeader>
        <div className="mt-5 space-y-4">
          {itens.map((item, index) => (
            <div key={item.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-600">Item {index + 1}</p>
                {itens.length > 1 ? (
                  <Button type="button" variant="ghost" onClick={() => onRemoveItem(item.id)} className="min-h-10 rounded-xl px-3 py-2 text-xs">
                    Remover
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3">
                <input
                  value={item.descricao}
                  onChange={(event) => onChangeItem(item.id, 'descricao', event.target.value)}
                  placeholder="Descricao do volume"
                  className="h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.95rem] font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                />
                <textarea
                  value={item.observacao}
                  onChange={(event) => onChangeItem(item.id, 'observacao', event.target.value)}
                  rows={2}
                  placeholder="Observacao do item"
                  className="w-full resize-none rounded-[1rem] border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.valorFrete}
                  onChange={(event) => onChangeItem(item.id, 'valorFrete', event.target.value)}
                  placeholder="Valor do frete deste item"
                  className="h-11 w-full rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.95rem] font-bold text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-center">
            <Button type="button" variant="secondary" onClick={onAddItem} className="w-full max-w-[20rem]">
              + Inserir item
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function SummaryBlock({ form, total, horarioSaidaEfetivo, previsaoChegada, embarcacaoNome }) {
  const documentType = form.valorDeclaradoAtivo ? 'Valor Declarado' : form.possuiNotaFiscal ? 'Nota Fiscal' : 'Nao definido'
  const totalItens = normalizarItensFrete(form.itens).length || 1

  return (
    <section className="rounded-[1.85rem] border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-[0_16px_40px_rgba(28,99,231,0.09)]">
      <div className="flex items-center justify-between gap-3 border-b border-blue-100 pb-4">
        <h2 className="text-[1.25rem] font-bold uppercase tracking-[-0.02em] text-[#1657d8]">Resumo do frete</h2>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#1657d8]">
          <EyeIcon />
          Conferir antes de salvar
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <SummaryItem label="Data" value={formatDateLabel(form.dataComanda)} />
        <SummaryItem label="Horario da postagem" value={form.horarioChegada || '--:--'} />
        <SummaryItem label="Saida da embarcacao" value={horarioSaidaEfetivo || '--:--'} />
        <SummaryItem label="Previsao de chegada" value={previsaoChegada || 'Nao calculada'} />
        <SummaryItem label="Remetente" value={obterRemetenteNome(form.remetenteNome)} />
        <SummaryItem label="Embarcacao" value={embarcacaoNome || 'Nao informada'} />
        <SummaryItem label="Linha" value={form.linhaNome || 'Nao informada'} />
        <SummaryItem label="Destino" value={form.terminalDestino || 'Nao informado'} />
        <SummaryItem label="Destinatario" value={form.destinatarioNome || 'Nao informado'} />
        <SummaryItem label="Itens" value={String(totalItens)} />
        <SummaryItem label="Tipo de documento" value={documentType} />
        <SummaryItem label="Frete" value={form.freteCobranca} pill />
        <SummaryItem label="Valor mercadoria" value={formatCurrency(form.valorMercadoria)} />
        <SummaryItem label="Valor frete" value={formatCurrency(total)} valueClassName="text-[#1657d8]" />
      </div>
    </section>
  )
}

function SummaryItem({ label, value, pill = false, valueClassName = '' }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">{label}</p>
      {pill ? (
        <span className="inline-flex rounded-full bg-[#1657d8] px-3 py-1 text-sm font-bold text-white">{value}</span>
      ) : (
        <p className={`text-[1.05rem] font-bold text-slate-950 ${valueClassName}`}>{value}</p>
      )}
    </div>
  )
}

function QuickAddPanel({ target, form, onChange, onSave, onCancel }) {
  return (
    <Card className="border-blue-200 bg-blue-50/70">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">Cadastro rapido</p>
          <h3 className="mt-1 text-xl font-bold text-slate-950">Novo {target}</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          value={form.nome}
          onChange={(event) => onChange('nome', event.target.value)}
          placeholder="Nome"
          className="h-10 rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.9rem] font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
        <input
          value={form.documento}
          onChange={(event) => onChange('documento', event.target.value)}
          placeholder="CPF/CNPJ"
          className="h-10 rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.9rem] font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
        <input
          value={form.email}
          onChange={(event) => onChange('email', event.target.value)}
          placeholder="E-mail"
          type="email"
          className="h-10 rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.9rem] font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
        <input
          value={form.telefone}
          onChange={(event) => onChange('telefone', event.target.value)}
          placeholder="Telefone"
          className="h-10 rounded-[1rem] border border-slate-200 bg-white px-3 text-[0.9rem] font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Button type="button" onClick={onSave} className="w-full">
          Salvar cadastro
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="w-full">
          Cancelar
        </Button>
      </div>
    </Card>
  )
}

export default function NovaComanda() {
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: empresas } = useCollectionOnce('empresas')
  const { items: rotasValoresBase, error: rotasError } = useCollectionOnce('rotasValores', { empresaId, empresaNome })
  const { items: embarcacoes, error: embarcacoesError } = useCollectionOnce('embarcacoes', { empresaId, empresaNome })
  const [form, setForm] = useState(createInitialForm)
  const [remetenteSugestoes, setRemetenteSugestoes] = useState([])
  const [destinatarioSugestoes, setDestinatarioSugestoes] = useState([])
  const [remetenteLoading, setRemetenteLoading] = useState(false)
  const [destinatarioLoading, setDestinatarioLoading] = useState(false)
  const [quickAddTarget, setQuickAddTarget] = useState(null)
  const [quickAddForm, setQuickAddForm] = useState(emptyCliente)
  const [resultado, setResultado] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [erroOperacao, setErroOperacao] = useState('')
  const [compartilhamentoAberto, setCompartilhamentoAberto] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const clientesBuscaCacheRef = useRef(new Map())
  const erroCargaTela = rotasError || embarcacoesError

  const empresaAtual = useMemo(
    () => empresas.find((item) => item.id === user?.empresaId) || null,
    [empresas, user?.empresaId],
  )
  const totalFrete = useMemo(() => {
    const itens = normalizarItensFrete(form.itens)

    if (itens.length) {
      return itens.reduce((total, item) => total + parseMoneyToCents(item.valorFrete || 0), 0) / 100
    }

    return parseMoneyToCents(form.valorFrete || 0) / 100
  }, [form.itens, form.valorFrete])
  const rotasValores = useMemo(
    () => rotasValoresBase.filter((item) => linhaDisponivelNoModulo(item, 'fretes')),
    [rotasValoresBase],
  )
  const linhaOptions = useMemo(
    () => rotasValores.map((item) => `${item.origem} - ${item.destino}`).filter(Boolean),
    [rotasValores],
  )
  const embarcacaoOptions = useMemo(
    () => embarcacoes.map((item) => item.nome).filter(Boolean),
    [embarcacoes],
  )
  const embarcacaoSelecionada = useMemo(() => {
    if (form.embarcacaoNome) {
      return embarcacoes.find((item) => item.nome === form.embarcacaoNome) || null
    }

    return embarcacoes[0] || null
  }, [embarcacoes, form.embarcacaoNome])
  const horariosPartidaEmbarcacao = useMemo(
    () => normalizarHorariosPartida(embarcacaoSelecionada),
    [embarcacaoSelecionada],
  )
  const horarioSaidaSugerido = useMemo(
    () => escolherProximaPartida(form.horarioChegada, horariosPartidaEmbarcacao),
    [form.horarioChegada, horariosPartidaEmbarcacao],
  )
  const horarioSaidaEfetivo = form.horarioSaidaManual
    ? form.horarioSaidaEmbarcacao
    : form.horarioSaidaEmbarcacao || horarioSaidaSugerido
  const linhaSelecionada = useMemo(
    () => rotasValores.find((item) => `${item.origem} - ${item.destino}` === form.linhaNome) || null,
    [form.linhaNome, rotasValores],
  )
  const previsaoChegadaCalculada = useMemo(
    () => formatarPrevisaoChegada(form.dataComanda, horarioSaidaEfetivo, obterDuracaoLinhaMinutos(linhaSelecionada)),
    [form.dataComanda, horarioSaidaEfetivo, linhaSelecionada],
  )
  const documentSelection = useMemo(() => {
    const items = []
    if (form.possuiNotaFiscal) items.push('Nota fiscal')
    if (form.valorDeclaradoAtivo) items.push('Valor declarado')
    return items
  }, [form.possuiNotaFiscal, form.valorDeclaradoAtivo])

  useEffect(() => {
    if (!compartilhamentoAberto) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [compartilhamentoAberto])

  function salvarBuscaNoCache(term, items) {
    const normalizedTerm = normalizarBuscaCliente(term)

    if (!normalizedTerm) {
      return
    }

    clientesBuscaCacheRef.current.set(normalizedTerm, items)
  }

  function buscarDoCache(term) {
    const normalizedTerm = normalizarBuscaCliente(term)

    if (!normalizedTerm) {
      return []
    }

    if (clientesBuscaCacheRef.current.has(normalizedTerm)) {
      return clientesBuscaCacheRef.current.get(normalizedTerm) || []
    }

    const keys = [...clientesBuscaCacheRef.current.keys()].sort((a, b) => b.length - a.length)
    const prefixKey = keys.find((key) => normalizedTerm.startsWith(key))

    if (!prefixKey) {
      return null
    }

    const baseItems = clientesBuscaCacheRef.current.get(prefixKey) || []
    const filteredItems = baseItems.filter((item) => normalizarBuscaCliente(item.nome).includes(normalizedTerm)).slice(0, 5)
    clientesBuscaCacheRef.current.set(normalizedTerm, filteredItems)
    return filteredItems
  }

  function salvarClienteNosCaches(cliente) {
    const normalizedName = normalizarBuscaCliente(cliente?.nome)

    if (!normalizedName) {
      return
    }

    const prefixes = new Set([normalizedName])
    for (let size = 2; size <= normalizedName.length; size += 1) {
      prefixes.add(normalizedName.slice(0, size))
    }

    for (const prefix of prefixes) {
      const items = clientesBuscaCacheRef.current.get(prefix) || []
      const semDuplicado = items.filter((item) => item.id !== cliente.id)
      clientesBuscaCacheRef.current.set(prefix, [cliente, ...semDuplicado].slice(0, 5))
    }
  }

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      const term = form.remetenteNome.trim()

      if (!term || term.length < 2) {
        setRemetenteSugestoes([])
        setRemetenteLoading(false)
        return
      }

      const cachedItems = buscarDoCache(term)
      if (cachedItems) {
        setRemetenteSugestoes(cachedItems)
        setRemetenteLoading(false)
        return
      }

      setRemetenteLoading(true)
      try {
        const items = await searchCollectionByField('clientes', 'nome', term, 5, { empresaId, empresaNome })

        if (active) {
          salvarBuscaNoCache(term, items)
          setRemetenteSugestoes(items)
          setErroOperacao('')
        }
      } catch (error) {
        reportRuntimeError('NovaComanda.buscarRemetente', error, { term, empresaId, empresaNome })
        if (active) {
          setRemetenteSugestoes([])
          setErroOperacao('Nao foi possivel buscar remetentes agora.')
        }
      } finally {
        if (active) {
          setRemetenteLoading(false)
        }
      }
    }, 360)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [empresaId, empresaNome, form.remetenteNome])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      const term = form.destinatarioNome.trim()

      if (!term || term.length < 2) {
        setDestinatarioSugestoes([])
        setDestinatarioLoading(false)
        return
      }

      const cachedItems = buscarDoCache(term)
      if (cachedItems) {
        setDestinatarioSugestoes(cachedItems)
        setDestinatarioLoading(false)
        return
      }

      setDestinatarioLoading(true)
      try {
        const items = await searchCollectionByField('clientes', 'nome', term, 5, { empresaId, empresaNome })

        if (active) {
          salvarBuscaNoCache(term, items)
          setDestinatarioSugestoes(items)
          setErroOperacao('')
        }
      } catch (error) {
        reportRuntimeError('NovaComanda.buscarDestinatario', error, { term, empresaId, empresaNome })
        if (active) {
          setDestinatarioSugestoes([])
          setErroOperacao('Nao foi possivel buscar destinatarios agora.')
        }
      } finally {
        if (active) {
          setDestinatarioLoading(false)
        }
      }
    }, 360)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [empresaId, empresaNome, form.destinatarioNome])

  function updateForm(key, value) {
    setForm((current) => {
      if (key === 'horarioSaidaEmbarcacao') {
        return {
          ...current,
          horarioSaidaEmbarcacao: value,
          horarioSaidaManual: true,
        }
      }

      if (key === 'horarioChegada') {
        return {
          ...current,
          horarioChegada: value,
          horarioSaidaEmbarcacao: current.horarioSaidaManual ? current.horarioSaidaEmbarcacao : '',
        }
      }

      if (key === 'valorFrete') {
        return {
          ...current,
          valorFrete: value,
          valorFreteManual: true,
          itens: current.itens.map((item, index) => (index === 0 ? { ...item, valorFrete: value } : item)),
        }
      }

      return { ...current, [key]: value }
    })
  }

  function updateFreightItem(itemId, field, value) {
    setForm((current) => {
      const itens = current.itens.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
      const totalCents = normalizarItensFrete(itens).reduce((total, item) => total + parseMoneyToCents(item.valorFrete || 0), 0)

      return {
        ...current,
        itens,
        valorFrete: formatCentsToInput(totalCents),
        valorFreteManual: true,
      }
    })
  }

  function addFreightItem() {
    setForm((current) => {
      const valorPadraoNovoItem = current.itens[0]?.valorFrete || current.valorFrete || ''
      const novoItem = createFreightItem(valorPadraoNovoItem)
      const proximosItens = [...current.itens, novoItem]

      return {
        ...current,
        itens: proximosItens,
        valorFrete: formatCentsToInput(
          normalizarItensFrete(proximosItens)
            .reduce((total, item) => total + parseMoneyToCents(item.valorFrete || 0), 0),
        ),
        valorFreteManual: true,
      }
    })
  }

  function removeFreightItem(itemId) {
    setForm((current) => {
      const itens = current.itens.filter((item) => item.id !== itemId)
      const proximosItens = itens.length ? itens : [createFreightItem()]
      const totalCents = normalizarItensFrete(proximosItens).reduce((total, item) => total + parseMoneyToCents(item.valorFrete || 0), 0)

      return {
        ...current,
        itens: proximosItens,
        valorFrete: formatCentsToInput(totalCents),
        valorFreteManual: true,
      }
    })
  }

  function handleChangeEmbarcacao(nomeEmbarcacao) {
    const embarcacaoEscolhida = embarcacoes.find((item) => item.nome === nomeEmbarcacao)
    const horarioSugerido = escolherProximaPartida(form.horarioChegada, normalizarHorariosPartida(embarcacaoEscolhida))

    setForm((current) => ({
      ...current,
      embarcacaoId: embarcacaoEscolhida?.id || '',
      embarcacaoNome: nomeEmbarcacao,
      horarioSaidaEmbarcacao: current.horarioSaidaManual ? current.horarioSaidaEmbarcacao : horarioSugerido,
      horarioSaidaManual: current.horarioSaidaManual,
    }))
  }

  function handleChangeLinha(linhaNome) {
    const linhaEscolhida = rotasValores.find((item) => `${item.origem} - ${item.destino}` === linhaNome)
    const terminaisDestino = obterTerminaisDestinoLinha(linhaEscolhida)

    setForm((current) => ({
      ...current,
      rotaId: linhaEscolhida?.id || '',
      linhaNome,
      terminalDestino: terminaisDestino[0] || linhaEscolhida?.destino || '',
      valorFrete: current.valorFreteManual ? current.valorFrete : String(linhaEscolhida?.valor || ''),
      itens: current.valorFreteManual
        ? current.itens
        : current.itens.map((item, index) => (index === 0 ? { ...item, valorFrete: String(linhaEscolhida?.valor || '') } : item)),
    }))
  }

  function resetForm() {
    setForm(createInitialForm())
    setResultado(null)
    setQrCode('')
    setQuickAddTarget(null)
    setQuickAddForm(emptyCliente)
    setCompartilhamentoAberto(false)
  }

  function pickCliente(target, cliente) {
    salvarClienteNosCaches(cliente)

    if (target === 'remetente') {
      setForm((current) => ({
        ...current,
        remetenteId: cliente.id,
        remetenteNome: cliente.nome,
        remetenteDocumento: cliente.documento || '',
        remetenteTelefone: cliente.telefone || '',
        remetenteEmail: cliente.email || '',
      }))
      setRemetenteSugestoes([])
      return
    }

    setForm((current) => ({
      ...current,
      destinatarioId: cliente.id,
      destinatarioNome: cliente.nome,
      destinatarioTelefone: cliente.telefone || '',
      destinatarioEmail: cliente.email || '',
    }))
    setDestinatarioSugestoes([])
  }

  function toggleDocument(option) {
    if (option === 'Nota fiscal') {
      updateForm('possuiNotaFiscal', !form.possuiNotaFiscal)
      return
    }

    updateForm('valorDeclaradoAtivo', !form.valorDeclaradoAtivo)
  }

  function toggleFreight(option) {
    updateForm('freteCobranca', option)
  }

  function openQuickAdd(target) {
    setQuickAddTarget(target)
    setQuickAddForm(emptyCliente)
  }

  async function saveQuickAdd() {
    if (!quickAddTarget || !quickAddForm.nome.trim()) {
      return
    }

    try {
      const novo = await addCollectionDocument('clientes', {
        nome: quickAddForm.nome.trim(),
        telefone: quickAddForm.telefone.trim(),
        email: quickAddForm.email.trim(),
        documento: quickAddForm.documento.trim(),
        cidade: quickAddForm.cidade.trim(),
        empresaId: user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      })

      if (quickAddTarget === 'remetente') {
        salvarClienteNosCaches(novo)
        setForm((current) => ({
          ...current,
          remetenteId: novo.id,
          remetenteNome: novo.nome,
          remetenteDocumento: novo.documento || '',
          remetenteTelefone: novo.telefone || '',
          remetenteEmail: novo.email || '',
        }))
        setRemetenteSugestoes([])
      } else {
        salvarClienteNosCaches(novo)
        setForm((current) => ({
          ...current,
          destinatarioId: novo.id,
          destinatarioNome: novo.nome,
          destinatarioTelefone: novo.telefone || '',
          destinatarioEmail: novo.email || '',
        }))
        setDestinatarioSugestoes([])
      }

      setErroOperacao('')
      setQuickAddTarget(null)
      setQuickAddForm(emptyCliente)
    } catch (error) {
      reportRuntimeError('NovaComanda.saveQuickAdd', error, { quickAddTarget })
      setErroOperacao('Nao foi possivel cadastrar o cliente rapido agora.')
    }
  }

  async function salvarClienteAutomatico(target) {
    const isRemetente = target === 'remetente'
    const nome = String(isRemetente ? form.remetenteNome : form.destinatarioNome).trim()
    const telefone = String(isRemetente ? form.remetenteTelefone : form.destinatarioTelefone).trim()
    const email = String(isRemetente ? form.remetenteEmail : form.destinatarioEmail).trim()
    const documento = String(isRemetente ? form.remetenteDocumento : '').trim()
    const clienteId = isRemetente ? form.remetenteId : form.destinatarioId

    if (!nome) {
      return null
    }

    if (clienteId) {
      const updates = {}
      if (telefone) updates.telefone = telefone
      if (email) updates.email = email
      if (documento) updates.documento = documento

      if (Object.keys(updates).length > 0) {
        await updateCollectionDocument('clientes', clienteId, updates)
      }

      return clienteId
    }

    const encontrados = await searchCollectionByField('clientes', 'nome', nome, 10, { empresaId, empresaNome })
    salvarBuscaNoCache(nome, encontrados)
    const nomeNormalizado = nome.toLowerCase()
    const existente = encontrados.find((item) => String(item.nome || '').trim().toLowerCase() === nomeNormalizado)

    if (existente) {
      salvarClienteNosCaches({
        ...existente,
        telefone: telefone || existente.telefone || '',
        email: email || existente.email || '',
        documento: documento || existente.documento || '',
      })
      const updates = {}
      if (telefone && telefone !== (existente.telefone || '')) updates.telefone = telefone
      if (email && email !== (existente.email || '')) updates.email = email
      if (documento && documento !== (existente.documento || '')) updates.documento = documento

      if (Object.keys(updates).length > 0) {
        await updateCollectionDocument('clientes', existente.id, updates)
      }

      setForm((current) =>
        isRemetente
          ? {
              ...current,
              remetenteId: existente.id,
              remetenteTelefone: telefone || existente.telefone || '',
              remetenteEmail: email || existente.email || '',
              remetenteDocumento: documento || existente.documento || '',
            }
          : {
              ...current,
              destinatarioId: existente.id,
              destinatarioTelefone: telefone || existente.telefone || '',
              destinatarioEmail: email || existente.email || '',
            },
      )

      return existente.id
    }

    const novo = await addCollectionDocument('clientes', {
      nome,
      telefone,
      email,
      documento,
      cidade: '',
      empresaId: user?.empresaId || '',
      empresaNome: user?.empresaNome || '',
    })
    salvarClienteNosCaches(novo)

    setForm((current) =>
      isRemetente
        ? { ...current, remetenteId: novo.id }
        : { ...current, destinatarioId: novo.id },
    )

    return novo.id
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setErroOperacao('')

    try {
      const itensFrete = normalizarItensFrete(form.itens)
      const [remetenteId, destinatarioId] = await Promise.all([
        salvarClienteAutomatico('remetente'),
        salvarClienteAutomatico('destinatario'),
      ])
      const codigo = await gerarCodigoEncomenda()
      const qr = await gerarQRCode(codigo)
      const created = await criarEncomenda({
        ...form,
        remetenteId: remetenteId || form.remetenteId,
        destinatarioId: destinatarioId || form.destinatarioId,
        remetenteNome: obterRemetenteNome(form.remetenteNome),
        rotaId: form.rotaId || linhaSelecionada?.id || '',
        linhaNome: form.linhaNome,
        embarcacaoId: form.embarcacaoId || embarcacaoSelecionada?.id || '',
        embarcacaoNome: form.embarcacaoNome || embarcacaoSelecionada?.nome || '',
        horarioSaidaEmbarcacao: horarioSaidaEfetivo,
        previsaoChegada: previsaoChegadaCalculada,
        codigo,
        qrCodeDataUrl: qr,
        rastreioUrl: montarRastreioUrl(codigo),
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
        operadorEmail: user?.email || '',
        empresaId: user?.empresaId || '',
        empresaNome: user?.empresaNome || SYSTEM_NAME,
        empresaTelefoneSac: empresaAtual?.telefoneSac || empresaAtual?.telefone || '',
        valorDeclarado: form.valorDeclaradoAtivo ? form.valorMercadoria : '',
        possuiNotaFiscal: form.possuiNotaFiscal,
        terminalOrigem: obterTerminalOrigemLinha(linhaSelecionada) || SYSTEM_NAME,
        terminalDestino: form.terminalDestino || linhaSelecionada?.terminalDestino || linhaSelecionada?.destino,
        descricao: resumirItensFrete(itensFrete) || form.descricao || form.tipoMercadoria,
        itens: itensFrete,
        quantidade: itensFrete.length || form.quantidade,
        valorFrete: totalFrete,
      })

      setResultado(created)
      setQrCode(qr)
      setCompartilhamentoAberto(true)
    } catch (error) {
      reportRuntimeError('NovaComanda.handleSubmit', error, {
        rotaId: form.rotaId,
        linhaNome: form.linhaNome,
        embarcacaoId: form.embarcacaoId,
        embarcacaoNome: form.embarcacaoNome,
      })
      setErroOperacao('Nao foi possivel salvar a comanda agora.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePrint() {
    if (!resultado) {
      return
    }

    try {
      await abrirComprovante(
        {
          ...resultado,
          qrCodeDataUrl: qrCode || resultado.qrCodeDataUrl,
        },
        '_blank',
      )
      setErroOperacao('')
    } catch (error) {
      reportRuntimeError('NovaComanda.handlePrint', error, { codigo: resultado.codigo })
      setErroOperacao('Nao foi possivel abrir o comprovante agora.')
    }
  }

  async function compartilharComprovante(canal) {
    if (!resultado) {
      return
    }

    setCompartilhando(true)
    setErroOperacao('')

    try {
      const encomendaCompartilhamento = {
        ...resultado,
        qrCodeDataUrl: qrCode || resultado.qrCodeDataUrl,
      }
      const arquivo = await gerarComprovanteArquivo(encomendaCompartilhamento)
      const pdfUrl = URL.createObjectURL(arquivo)
      const mensagem = criarMensagemCompartilhamento(encomendaCompartilhamento)
      const assunto = `Comprovante de postagem ${resultado.codigo || ''}`.trim()

      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
      window.open(pdfUrl, '_blank', 'noopener,noreferrer')

      if (canal === 'email') {
        const emailDestino = String(resultado.destinatarioEmail || '').trim()
        const mailto = `mailto:${encodeURIComponent(emailDestino)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(`${mensagem}\n\nO PDF foi aberto em outra aba para anexar ao e-mail.`)}`
        window.location.href = mailto
      } else {
        const numeroWhatsapp = criarNumeroWhatsapp(resultado.destinatarioTelefone)
        const baseUrl = numeroWhatsapp ? `https://wa.me/${numeroWhatsapp}` : 'https://wa.me/'
        const texto = `${mensagem} O PDF foi aberto em outra aba para voce anexar no WhatsApp.`
        window.open(`${baseUrl}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
      }

      setCompartilhamentoAberto(false)
    } catch (error) {
      reportRuntimeError('NovaComanda.compartilharComprovante', error, {
        canal,
        codigo: resultado.codigo,
      })
      setErroOperacao('Nao foi possivel preparar o compartilhamento do comprovante agora.')
    } finally {
      setCompartilhando(false)
    }
  }

  async function compartilharComprovanteNativo() {
    if (!resultado) {
      return
    }

    setCompartilhando(true)
    setErroOperacao('')

    try {
      const encomendaCompartilhamento = {
        ...resultado,
        qrCodeDataUrl: qrCode || resultado.qrCodeDataUrl,
      }
      const arquivo = await gerarComprovanteArquivo(encomendaCompartilhamento)
      const mensagem = criarMensagemCompartilhamento(encomendaCompartilhamento)
      const assunto = `Comprovante de postagem ${resultado.codigo || ''}`.trim()

      if (!suportaCompartilhamentoNativo(arquivo)) {
        throw new Error('native-share-not-supported')
      }

      await navigator.share({
        title: assunto,
        text: mensagem,
        files: [arquivo],
      })

      setCompartilhamentoAberto(false)
    } catch (error) {
      if (error?.name === 'AbortError') {
        return
      }

      if (error?.message === 'native-share-not-supported') {
        setErroOperacao('Este aparelho nao suporta compartilhamento nativo do PDF. Use e-mail ou WhatsApp abaixo.')
        return
      }

      reportRuntimeError('NovaComanda.compartilharComprovanteNativo', error, {
        codigo: resultado.codigo,
      })
      setErroOperacao('Nao foi possivel abrir o compartilhamento nativo agora.')
    } finally {
      setCompartilhando(false)
    }
  }

  return (
    <Layout containerClassName="max-w-full xl:max-w-[80vw]" contentClassName="max-w-none">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.24),transparent_34%),linear-gradient(180deg,#eef5ff_0%,#dbeafe_100%)]">
        {compartilhamentoAberto ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#0a2d61]/55 px-4 pb-4 pt-10 backdrop-blur-[2px] sm:items-center">
            <div className="w-full max-w-[28rem] rounded-[2rem] bg-white p-6 shadow-[0_24px_70px_rgba(4,18,42,0.38)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1657d8]">Frete gerado</p>
                  <h2 className="mt-2 text-[1.5rem] font-bold leading-tight text-slate-950">Compartilhar comprovante de postagem</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Escolha como deseja enviar o PDF do frete <span className="font-bold text-slate-700">{resultado?.codigo}</span>.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    O comprovante sera aberto em outra aba para anexar no canal escolhido.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCompartilhamentoAberto(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400"
                  aria-label="Fechar compartilhamento"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={compartilharComprovanteNativo}
                  disabled={compartilhando}
                  className="flex w-full items-center justify-between rounded-[1.5rem] border border-[#1657d8]/20 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] px-4 py-4 text-left transition hover:border-[#1c63e7] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    <span className="block text-base font-bold text-slate-950">Compartilhar no celular</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Envia o PDF direto pelo menu nativo do aparelho para WhatsApp, e-mail e outros apps
                    </span>
                  </span>
                  <ShareIcon />
                </button>

                <button
                  type="button"
                  onClick={() => compartilharComprovante('email')}
                  disabled={compartilhando}
                  className="flex w-full items-center justify-between rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-[#1c63e7] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    <span className="block text-base font-bold text-slate-950">Enviar por e-mail</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {resultado?.destinatarioEmail ? resultado.destinatarioEmail : 'Abrir cliente de e-mail para preencher o envio'}
                    </span>
                  </span>
                  <MailIcon />
                </button>

                <button
                  type="button"
                  onClick={() => compartilharComprovante('whatsapp')}
                  disabled={compartilhando}
                  className="flex w-full items-center justify-between rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-[#1c63e7] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    <span className="block text-base font-bold text-slate-950">Enviar por WhatsApp</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {resultado?.destinatarioTelefone ? resultado.destinatarioTelefone : 'Abrir WhatsApp para escolher o contato'}
                    </span>
                  </span>
                  <WhatsAppIcon />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePrint}
                  disabled={compartilhando}
                  className="w-full"
                >
                  Ver comprovante
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCompartilhamentoAberto(false)}
                  disabled={compartilhando}
                  className="w-full"
                >
                  Agora nao
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto flex min-h-screen w-full max-w-[540px] flex-col xl:max-w-none">
          <header className="rounded-b-[2.5rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] px-5 pb-7 pt-7 text-white shadow-[0_20px_55px_rgba(7,45,103,0.42)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white/10 text-white">
                  <BoatLogoIcon />
                </div>
                <div>
                  <p className="text-[2.2rem] font-extrabold uppercase leading-none tracking-[-0.04em]">Novo Frete</p>
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={SYSTEM_ICON_SRC}
                      alt={SYSTEM_NAME}
                      className="h-10 w-10 scale-[1.15] rounded-2xl border border-white/35 bg-white object-cover p-1 shadow-[0_16px_32px_rgba(15,23,42,0.2)]"
                    />
                    <p className="text-[1.1rem] font-medium uppercase tracking-[0.02em] text-blue-100">{SYSTEM_NAME}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                disabled={!resultado}
                className="flex min-w-[6.5rem] flex-col items-center gap-2 rounded-[1.7rem] bg-white px-4 py-4 text-center text-[#0a2d61] shadow-[0_14px_35px_rgba(4,18,42,0.2)] transition disabled:opacity-50"
              >
                <PrinterIcon />
                <span className="text-sm font-bold uppercase">Imprimir</span>
              </button>
            </div>
          </header>

          <main className="flex-1 px-5 pb-6 pt-5">
            {erroCargaTela || erroOperacao ? (
              <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {erroOperacao || 'Nao foi possivel carregar os dados auxiliares desta tela.'}
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <CompactScheduleCardRefined
                dataComanda={form.dataComanda}
                horarioPostagem={form.horarioChegada}
                horarioSaidaEmbarcacao={horarioSaidaEfetivo}
                previsaoChegada={previsaoChegadaCalculada}
                onChange={updateForm}
              />

              <PersonCard
                title="Remetente"
                value={form.remetenteNome}
                subtitle={form.remetenteDocumento || 'Opcional. Se vazio, vai como Entregador'}
                searchValue={form.remetenteNome}
                phoneValue={form.remetenteTelefone}
                emailValue={form.remetenteEmail}
                loading={remetenteLoading}
                suggestions={remetenteSugestoes}
                onSearchChange={(value) => updateForm('remetenteNome', value)}
                onPhoneChange={(value) => updateForm('remetenteTelefone', value)}
                onEmailChange={(value) => updateForm('remetenteEmail', value)}
                onPick={(cliente) => pickCliente('remetente', cliente)}
                onOpenQuickAdd={() => openQuickAdd('remetente')}
              />

              <PersonCard
                title="Destinatario"
                value={form.destinatarioNome}
                subtitle="Selecione quem vai receber"
                searchValue={form.destinatarioNome}
                phoneValue={form.destinatarioTelefone}
                emailValue={form.destinatarioEmail}
                loading={destinatarioLoading}
                suggestions={destinatarioSugestoes}
                onSearchChange={(value) => updateForm('destinatarioNome', value)}
                onPhoneChange={(value) => updateForm('destinatarioTelefone', value)}
                onEmailChange={(value) => updateForm('destinatarioEmail', value)}
                onPick={(cliente) => pickCliente('destinatario', cliente)}
                onOpenQuickAdd={() => openQuickAdd('destinatario')}
              />

              <SelectCard
                title="Embarcacao"
                value={form.embarcacaoNome || embarcacaoSelecionada?.nome || 'Selecionar embarcacao'}
                options={embarcacaoOptions}
                onChange={handleChangeEmbarcacao}
              />

              <SelectCard
                title="Linha"
                value={form.linhaNome || 'Selecionar linha'}
                options={linhaOptions}
                onChange={handleChangeLinha}
              />

              {obterTerminaisDestinoLinha(linhaSelecionada).length > 1 ? (
                <SelectCard
                  title="Terminal destino"
                  value={form.terminalDestino || 'Selecionar terminal'}
                  options={obterTerminaisDestinoLinha(linhaSelecionada)}
                  onChange={(value) => updateForm('terminalDestino', value)}
                />
              ) : null}

              <SegmentedChoice
                title="Tipo de documento"
                icon={<DocumentIcon />}
                options={documentOptions}
                activeValues={documentSelection}
                onToggle={toggleDocument}
              />

              <AmountCard
                title="Valor da mercadoria (declarado)"
                value={form.valorMercadoria}
                onChange={(value) => updateForm('valorMercadoria', value)}
                large
                icon={<MoneyIcon />}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.08fr_0.92fr]">
                <SegmentedChoice
                  title="Frete"
                  icon={<BoatSmallIcon />}
                  options={freightChargeOptions}
                  activeValues={[form.freteCobranca]}
                  onToggle={toggleFreight}
                  single
                />

                <AmountCard
                  title="Total do frete"
                  value={String(totalFrete || '')}
                  onChange={(value) => updateForm('valorFrete', value)}
                  icon={<MoneyIcon />}
                  readOnly={form.itens.length > 1}
                />
              </div>

              <FreightItemsCard
                itens={form.itens}
                onChangeItem={updateFreightItem}
                onAddItem={addFreightItem}
                onRemoveItem={removeFreightItem}
              />

              {quickAddTarget ? (
                <QuickAddPanel
                  target={quickAddTarget}
                  form={quickAddForm}
                  onChange={(field, value) => setQuickAddForm((current) => ({ ...current, [field]: value }))}
                  onSave={saveQuickAdd}
                  onCancel={() => setQuickAddTarget(null)}
                />
              ) : null}

              <SummaryBlock
                form={form}
                total={totalFrete}
                horarioSaidaEfetivo={horarioSaidaEfetivo}
                previsaoChegada={previsaoChegadaCalculada}
                embarcacaoNome={form.embarcacaoNome || embarcacaoSelecionada?.nome || ''}
              />

              <div className="space-y-4 pb-4">
                <Button type="submit" disabled={loading} className="min-h-18 w-full rounded-[1.6rem] text-[1.05rem] uppercase">
                  <span className="inline-flex items-center gap-3">
                    <SaveIcon />
                    {loading ? 'Salvando...' : 'Salvar Frete'}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePrint}
                  disabled={!resultado}
                  className="min-h-18 w-full rounded-[1.6rem] border-2 border-blue-200 bg-white text-[1.05rem] uppercase text-[#1657d8]"
                >
                  <span className="inline-flex items-center gap-3">
                    <PrinterIcon />
                    Imprimir Comprovante
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetForm}
                  className="min-h-14 w-full rounded-[1.3rem]"
                >
                  Limpar tela
                </Button>
              </div>

              {resultado ? (
                <Card className="border-blue-200 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">Ultimo registro</p>
                      <p className="mt-1 text-xl font-bold text-slate-950">{resultado.codigo}</p>
                    </div>
                    <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-[#1657d8]">{resultado.status}</div>
                  </div>

                  {qrCode ? (
                    <img
                      src={qrCode}
                      alt="QR Code do frete"
                      className="mx-auto mt-4 w-full max-w-[220px] rounded-[1.4rem] border border-slate-200 bg-white p-4"
                    />
                  ) : null}
                </Card>
              ) : null}
            </form>
          </main>

        </div>
      </div>
    </Layout>
  )
}

function BoatLogoIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 45c8 0 8 5 15 5s7-5 15-5 8 5 16 5" />
      <path d="M8 54c8 0 8 5 15 5s7-5 15-5 8 5 16 5" />
      <path d="M17 37h29l-4-12H29l-4-6H15" />
      <path d="M25 19h12" />
      <path d="M19 16h5" />
      <path d="M22 9h9l3 4" />
      <path d="M47 28h8" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.8-3.5 4.4-5 7-5s5.2 1.5 7 5" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}

function MoneyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 8.8c-.6-.8-1.7-1.3-2.9-1.3-1.7 0-3 .9-3 2.3 0 1.3 1.1 1.9 2.8 2.3 1.6.4 3.3.8 3.3 2.6 0 1.6-1.4 2.6-3.3 2.6-1.4 0-2.7-.5-3.5-1.5M12 6.8v10.4" />
    </svg>
  )
}

function BoatSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 16c3 0 3 2 5.5 2S12 16 14.5 16 17 18 20 18" />
      <path d="M5 13h12l-2-4H9l-2-3H5" />
      <path d="M8 7h4" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h10l4 4v14H7z" />
      <path d="M17 3v4h4M10 12h7M10 16h4" />
      <path d="M8.5 19.5 11 19l5.4-5.4a1.4 1.4 0 0 0-2-2L9 17l-.5 2.5Z" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 8V3h10v5M6 17H4a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7zM17 12h.01" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h8V3M9 21v-7h6v7" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function PlusSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1657d8]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16v12H4z" />
      <path d="m5 7 7 6 7-6" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1657d8]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#17a34a]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
      <path d="M9.7 9.2c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .6.5.2.5.8 1.8.9 1.9.1.2.1.4 0 .6l-.4.5c-.1.1-.2.3 0 .5.3.6 1 1.5 2 2 .3.1.5.1.7-.1l.5-.6c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.3.3.6-.1.5-.4 1.3-.9 1.6-.4.2-.8.5-2 .3-1-.2-2.3-.9-3.5-2-1.4-1.3-2.2-2.8-2.5-3.8-.3-1.1 0-1.7.3-2.1Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}
