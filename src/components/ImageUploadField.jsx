import { useId } from 'react'
import Button from './Button.jsx'

export default function ImageUploadField({
  label,
  value = '',
  hint = '',
  onFileChange,
  onClear,
  accept = 'image/*',
}) {
  const inputId = useId()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[1rem] bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Carregar imagem
          </label>
          {value ? (
            <Button type="button" variant="secondary" onClick={onClear}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFileChange}
      />

      <div className="overflow-hidden rounded-[1.4rem] border border-blue-100 bg-slate-50">
        {value ? (
          <img src={value} alt={label} className="h-52 w-full object-cover" />
        ) : (
          <div className="flex h-52 items-center justify-center px-4 text-center text-sm text-slate-500">
            Nenhuma imagem carregada ainda.
          </div>
        )}
      </div>
    </div>
  )
}
