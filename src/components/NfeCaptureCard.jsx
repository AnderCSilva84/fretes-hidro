import { useRef } from 'react'
import Button from './Button.jsx'
import Card from './Card.jsx'

function formatFieldLabel(field) {
  const labels = {
    remetenteNome: 'Remetente',
    remetenteDocumento: 'Documento',
    destinatarioNome: 'Destinatario',
    valorMercadoria: 'Valor',
    descricao: 'Descricao',
    quantidadeVolumes: 'Volumes',
    peso: 'Peso',
  }

  return labels[field] || field
}

export default function NfeCaptureCard({
  busy = false,
  error = '',
  onFileSelect,
  lastFields = [],
  extractedData = null,
  model = '',
}) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  function handleChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <Card className="border-blue-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))]">
      <div className="flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] bg-[#edf4ff] text-[#1657d8]">
          <CameraIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[1.05rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Leitura da nota</p>
          <p className="mt-2 text-[1.2rem] font-bold leading-snug text-slate-950">Uma foto para preencher os campos principais</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            O sistema tenta extrair so remetente, documento, destinatario, valor, descricao, volumes e peso.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button type="button" onClick={() => cameraInputRef.current?.click()} disabled={busy} className="min-h-14 rounded-[1.2rem]">
          {busy ? 'Lendo nota...' : 'Fotografar nota'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => galleryInputRef.current?.click()}
          disabled={busy}
          className="min-h-14 rounded-[1.2rem]"
        >
          Escolher foto
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      {error ? (
        <div className="mt-4 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error}
        </div>
      ) : null}

      {lastFields.length ? (
        <div className="mt-4 rounded-[1.3rem] border border-emerald-200 bg-emerald-50/80 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-[0.04em] text-emerald-800">Preenchido</span>
            {lastFields.map((field) => (
              <span key={field} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                {formatFieldLabel(field)}
              </span>
            ))}
          </div>
          {model ? <p className="mt-3 text-xs font-medium text-emerald-800/80">Modelo: {model}</p> : null}
        </div>
      ) : null}

      {extractedData ? (
        <div className="mt-4 grid gap-3 rounded-[1.3rem] border border-slate-200 bg-white/90 p-4 sm:grid-cols-2">
          {extractedData.remetenteNome ? <FieldPreview label="Remetente" value={extractedData.remetenteNome} /> : null}
          {extractedData.destinatarioNome ? <FieldPreview label="Destinatario" value={extractedData.destinatarioNome} /> : null}
          {extractedData.valorMercadoria ? <FieldPreview label="Valor" value={extractedData.valorMercadoria} /> : null}
          {extractedData.quantidadeVolumes ? <FieldPreview label="Volumes" value={extractedData.quantidadeVolumes} /> : null}
          {extractedData.peso ? <FieldPreview label="Peso" value={extractedData.peso} /> : null}
          {extractedData.descricao ? <FieldPreview label="Descricao" value={extractedData.descricao} fullWidth /> : null}
        </div>
      ) : null}
    </Card>
  )
}

function FieldPreview({ label, value, fullWidth = false }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  )
}
