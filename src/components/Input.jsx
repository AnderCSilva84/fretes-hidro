export default function Input({ label, error, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-2 text-sm font-medium text-slate-700 ${className}`}>
      {label ? <span>{label}</span> : null}
      <input
        className="min-h-12 rounded-2xl border border-blue-200 bg-white px-4 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
        {...props}
      />
      {error ? <span className="text-xs font-normal text-rose-600">{error}</span> : null}
    </label>
  )
}
