import { useRef } from 'react'

export default function Input({ label, error, className = '', onClick, ...props }) {
  const inputRef = useRef(null)

  function handleClick(event) {
    onClick?.(event)

    if (!['date', 'time'].includes(props.type) || props.disabled || event.defaultPrevented) {
      return
    }

    try {
      inputRef.current?.showPicker?.()
    } catch {
      // Browsers sem showPicker continuam usando o seletor nativo pelo foco.
    }
  }

  return (
    <label className={`flex flex-col gap-2 text-sm font-medium text-slate-700 ${className}`}>
      {label ? <span>{label}</span> : null}
      <input
        ref={inputRef}
        className="min-h-9 w-full min-w-0 max-w-full rounded-[1rem] border border-blue-200 bg-white px-3 text-[0.85rem] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 sm:min-h-10 sm:text-sm"
        onClick={handleClick}
        {...props}
      />
      {error ? <span className="text-xs font-normal text-rose-600">{error}</span> : null}
    </label>
  )
}
