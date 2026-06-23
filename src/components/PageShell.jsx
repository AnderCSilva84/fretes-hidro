import Card from './Card.jsx'

export default function PageShell({ title, subtitle, icon, children, actions }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#1657d8]">
              {icon}
            </div>
          ) : null}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#1657d8]">Painel</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950 lg:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <Card className="border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,255,0.98))] shadow-[0_16px_40px_rgba(28,99,231,0.08)]">
        {children}
      </Card>
    </div>
  )
}
