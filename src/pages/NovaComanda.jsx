import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import useAuth from '../context/useAuth.js'
import { addCollectionDocument, criarEncomenda, gerarCodigoEncomenda, searchCollectionByField } from '../services/firebase.js'
import { abrirComprovante } from '../utils/encomendaMedia.js'
import { gerarQRCode, montarRastreioUrl } from '../utils/gerarQRCode.js'

const emptyCliente = {
  nome: '',
  telefone: '',
  email: '',
  documento: '',
  cidade: '',
}

const destinosPadrao = ['Belem', 'Barcarena', 'Sao Francisco']
const documentOptions = ['Nota fiscal', 'Valor declarado']
const freightChargeOptions = ['Pago', 'A receber']
const bottomNav = [
  { to: '/nova-comanda', label: 'Novo Frete', active: true, icon: PlusIcon },
  { to: '/encomendas', label: 'Consultar', icon: ListIcon },
  { to: '/dashboard', label: 'Historico', icon: HistoryIcon },
  { to: '/caixa', label: 'Mais', icon: DotsIcon },
]

function createInitialForm() {
  return {
    dataComanda: new Date().toISOString().slice(0, 10),
    horarioChegada: new Date().toTimeString().slice(0, 5),
    remetenteId: '',
    remetenteNome: '',
    remetenteDocumento: '',
    remetenteTelefone: '',
    remetenteEmail: '',
    destinatarioId: '',
    destinatarioNome: '',
    destinatarioTelefone: '',
    destinatarioEmail: '',
    terminalDestino: 'Sao Francisco',
    possuiNotaFiscal: false,
    valorDeclaradoAtivo: true,
    valorMercadoria: '',
    freteCobranca: 'A receber',
    valorFrete: '',
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

function AppIcon({ children, className = '' }) {
  return (
    <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#1c63e7] ${className}`}>
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

function TopInfo({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-[1.75rem] bg-white/92 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <AppIcon>{icon}</AppIcon>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">{label}</p>
        <p className="mt-1 text-[2rem] font-bold leading-none text-slate-950">{value}</p>
      </div>
    </div>
  )
}

function PersonCard({
  title,
  value,
  subtitle,
  searchValue,
  loading,
  suggestions,
  onSearchChange,
  onPick,
  onClear,
  onOpenQuickAdd,
}) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <AppIcon>
          <PersonIcon />
        </AppIcon>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">{title}</p>
              <p className="mt-1 text-[1.05rem] font-bold text-slate-950">{value || 'Selecionar'}</p>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClear}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                aria-label={`Limpar ${title}`}
              >
                <CloseIcon />
              </button>
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400">
                <ChevronDownIcon />
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar ou digitar nome"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-900 outline-none transition focus:border-[#1c63e7] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

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

          <div className="mt-4 flex justify-end">
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
      </div>
    </Card>
  )
}

function SelectCard({ title, value, options, onChange }) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <AppIcon>
          <PinIcon />
        </AppIcon>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">{title}</p>
              <p className="mt-1 text-[1.05rem] font-bold text-slate-950">{value}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400">
              <ChevronDownIcon />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
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
      </div>
    </Card>
  )
}

function SegmentedChoice({ title, icon, options, activeValues, onToggle, single = false }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <AppIcon>{icon}</AppIcon>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">{title}</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-2">
              {options.map((option, index) => {
                const active = activeValues.includes(option)

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onToggle(option, single)}
                    className={`flex min-h-16 items-center gap-3 px-5 text-left text-base font-semibold transition ${
                      index === 0 ? 'border-r border-slate-200' : ''
                    } ${active ? 'bg-blue-50 text-[#1549b3]' : 'bg-white text-slate-800 hover:bg-slate-50'}`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${active ? 'border-[#1c63e7]' : 'border-slate-300'}`}>
                      {active ? <span className="h-3.5 w-3.5 rounded-full bg-[#1c63e7]" /> : null}
                    </span>
                    {option}
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

function AmountCard({ title, value, onChange, large = false, icon }) {
  return (
    <Card className={large ? '' : 'h-full'}>
      <div className="flex items-center gap-4">
        <AppIcon>{icon}</AppIcon>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">{title}</p>
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0,00"
            className={`mt-2 w-full border-none bg-transparent p-0 font-bold text-slate-900 outline-none ${large ? 'text-[2.25rem]' : 'text-[2rem]'}`}
          />
        </div>
      </div>
    </Card>
  )
}

function ObservationsCard({ value, onChange }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <AppIcon>
          <NoteIcon />
        </AppIcon>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium uppercase tracking-[0.04em] text-slate-500">Observacoes</p>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            placeholder="Ex.: informacoes adicionais..."
            className="mt-2 w-full resize-none border-none bg-transparent p-0 text-[1.15rem] font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
    </Card>
  )
}

function SummaryBlock({ form, total }) {
  const documentType = form.valorDeclaradoAtivo ? 'Valor Declarado' : form.possuiNotaFiscal ? 'Nota Fiscal' : 'Nao definido'

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
        <SummaryItem label="Remetente" value={form.remetenteNome || 'Nao informado'} />
        <SummaryItem label="Destino" value={form.terminalDestino || 'Nao informado'} />
        <SummaryItem label="Destinatario" value={form.destinatarioNome || 'Nao informado'} />
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
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
        <input
          value={form.documento}
          onChange={(event) => onChange('documento', event.target.value)}
          placeholder="CPF/CNPJ"
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
        <input
          value={form.email}
          onChange={(event) => onChange('email', event.target.value)}
          placeholder="E-mail"
          type="email"
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        />
        <input
          value={form.telefone}
          onChange={(event) => onChange('telefone', event.target.value)}
          placeholder="Telefone"
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
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

  const totalFrete = Number(form.valorFrete || 0)
  const documentSelection = useMemo(() => {
    const items = []
    if (form.possuiNotaFiscal) items.push('Nota fiscal')
    if (form.valorDeclaradoAtivo) items.push('Valor declarado')
    return items
  }, [form.possuiNotaFiscal, form.valorDeclaradoAtivo])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      const term = form.remetenteNome.trim()

      if (!term) {
        setRemetenteSugestoes([])
        setRemetenteLoading(false)
        return
      }

      setRemetenteLoading(true)
      const items = await searchCollectionByField('clientes', 'nome', term, 5)

      if (active) {
        setRemetenteSugestoes(items)
        setRemetenteLoading(false)
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [form.remetenteNome])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(async () => {
      const term = form.destinatarioNome.trim()

      if (!term) {
        setDestinatarioSugestoes([])
        setDestinatarioLoading(false)
        return
      }

      setDestinatarioLoading(true)
      const items = await searchCollectionByField('clientes', 'nome', term, 5)

      if (active) {
        setDestinatarioSugestoes(items)
        setDestinatarioLoading(false)
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [form.destinatarioNome])

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setForm(createInitialForm())
    setResultado(null)
    setQrCode('')
    setQuickAddTarget(null)
    setQuickAddForm(emptyCliente)
  }

  function clearPerson(target) {
    if (target === 'remetente') {
      setForm((current) => ({
        ...current,
        remetenteId: '',
        remetenteNome: '',
        remetenteDocumento: '',
        remetenteTelefone: '',
        remetenteEmail: '',
      }))
      setRemetenteSugestoes([])
      return
    }

    setForm((current) => ({
      ...current,
      destinatarioId: '',
      destinatarioNome: '',
      destinatarioTelefone: '',
      destinatarioEmail: '',
    }))
    setDestinatarioSugestoes([])
  }

  function pickCliente(target, cliente) {
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

    const novo = await addCollectionDocument('clientes', {
      nome: quickAddForm.nome.trim(),
      telefone: quickAddForm.telefone.trim(),
      email: quickAddForm.email.trim(),
      documento: quickAddForm.documento.trim(),
      cidade: quickAddForm.cidade.trim(),
    })

    if (quickAddTarget === 'remetente') {
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
      setForm((current) => ({
        ...current,
        destinatarioId: novo.id,
        destinatarioNome: novo.nome,
        destinatarioTelefone: novo.telefone || '',
        destinatarioEmail: novo.email || '',
      }))
      setDestinatarioSugestoes([])
    }

    setQuickAddTarget(null)
    setQuickAddForm(emptyCliente)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const codigo = await gerarCodigoEncomenda()
      const qr = await gerarQRCode(codigo)
      const created = await criarEncomenda({
        ...form,
        codigo,
        qrCodeDataUrl: qr,
        rastreioUrl: montarRastreioUrl(codigo),
        operadorNome: user?.nome || user?.displayName || user?.email || 'Operador',
        operadorEmail: user?.email || '',
        valorDeclarado: form.valorDeclaradoAtivo ? form.valorMercadoria : '',
        possuiNotaFiscal: form.possuiNotaFiscal,
        terminalOrigem: 'LUZ DA AURORA III',
        descricao: form.descricao || form.tipoMercadoria,
      })

      setResultado(created)
      setQrCode(qr)
    } finally {
      setLoading(false)
    }
  }

  async function handlePrint() {
    if (!resultado) {
      return
    }

    await abrirComprovante(
      {
        ...resultado,
        qrCodeDataUrl: qrCode || resultado.qrCodeDataUrl,
      },
      '_blank',
    )
  }

  return (
    <Layout immersive>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
        <div className="mx-auto flex min-h-screen w-full max-w-[540px] flex-col">
          <header className="rounded-b-[2.5rem] bg-[linear-gradient(135deg,#072d67_0%,#0f4da5_45%,#0a2d61_100%)] px-5 pb-7 pt-7 text-white shadow-[0_20px_55px_rgba(7,45,103,0.42)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white/10 text-white">
                  <BoatLogoIcon />
                </div>
                <div>
                  <p className="text-[2.2rem] font-extrabold uppercase leading-none tracking-[-0.04em]">Novo Frete</p>
                  <p className="mt-2 text-[1.1rem] font-medium uppercase tracking-[0.02em] text-blue-100">LUZ DA AURORA III</p>
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
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TopInfo icon={<CalendarIcon />} label="Data" value={formatDateLabel(form.dataComanda)} />
                <TopInfo icon={<ClockIcon />} label="Horario de chegada" value={form.horarioChegada || '--:--'} />
              </div>

              <div className="hidden">
                <input type="date" value={form.dataComanda} onChange={(event) => updateForm('dataComanda', event.target.value)} />
                <input type="time" value={form.horarioChegada} onChange={(event) => updateForm('horarioChegada', event.target.value)} />
              </div>

              <PersonCard
                title="Remetente"
                value={form.remetenteNome}
                subtitle={form.remetenteDocumento || 'CPF/CNPJ (opcional)'}
                searchValue={form.remetenteNome}
                loading={remetenteLoading}
                suggestions={remetenteSugestoes}
                onSearchChange={(value) => updateForm('remetenteNome', value)}
                onPick={(cliente) => pickCliente('remetente', cliente)}
                onClear={() => clearPerson('remetente')}
                onOpenQuickAdd={() => openQuickAdd('remetente')}
              />

              <PersonCard
                title="Destinatario"
                value={form.destinatarioNome}
                subtitle="Selecione quem vai receber"
                searchValue={form.destinatarioNome}
                loading={destinatarioLoading}
                suggestions={destinatarioSugestoes}
                onSearchChange={(value) => updateForm('destinatarioNome', value)}
                onPick={(cliente) => pickCliente('destinatario', cliente)}
                onClear={() => clearPerson('destinatario')}
                onOpenQuickAdd={() => openQuickAdd('destinatario')}
              />

              <SelectCard
                title="Destino"
                value={form.terminalDestino}
                options={destinosPadrao}
                onChange={(value) => updateForm('terminalDestino', value)}
              />

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
                  title="Valor do frete"
                  value={form.valorFrete}
                  onChange={(value) => updateForm('valorFrete', value)}
                  icon={<MoneyIcon />}
                />
              </div>

              <ObservationsCard value={form.descricao} onChange={(value) => updateForm('descricao', value)} />

              {quickAddTarget ? (
                <QuickAddPanel
                  target={quickAddTarget}
                  form={quickAddForm}
                  onChange={(field, value) => setQuickAddForm((current) => ({ ...current, [field]: value }))}
                  onSave={saveQuickAdd}
                  onCancel={() => setQuickAddTarget(null)}
                />
              ) : null}

              <SummaryBlock form={form} total={totalFrete} />

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

          <footer className="sticky bottom-0 mt-auto rounded-t-[2rem] border-t border-slate-200 bg-white/96 px-4 pb-4 pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="grid grid-cols-4 gap-2">
              {bottomNav.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex flex-col items-center gap-2 rounded-2xl px-2 py-2 text-center"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.active ? 'bg-[#1c63e7] text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon />
                    </div>
                    <span className={`text-sm font-semibold ${item.active ? 'text-[#1c63e7]' : 'text-slate-600'}`}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </footer>
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

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
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

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6h10M9 12h10M9 18h10M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
      <path d="M12 7v6l4 2" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  )
}
