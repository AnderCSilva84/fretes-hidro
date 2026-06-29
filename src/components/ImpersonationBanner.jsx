import Button from './Button.jsx'

export default function ImpersonationBanner({ user, onStop }) {
  if (!user?.impersonationActive) {
    return null
  }

  const empresaNome = user?.empresaNome || 'Acesso central'
  const responsavel = user?.impersonatedBy?.nome || user?.impersonatedBy?.email || 'Superadmin'

  return (
    <div className="mx-auto w-full px-4 pt-4 sm:px-5 xl:max-w-[80vw]">
      <div className="rounded-[1.6rem] border border-amber-300 bg-[linear-gradient(135deg,#fff7d6_0%,#ffe9b8_100%)] px-4 py-4 text-slate-900 shadow-[0_16px_36px_rgba(180,120,20,0.16)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-800">Modo de simulacao</p>
            <p className="mt-2 text-sm font-semibold">
              Voce esta navegando como <span className="text-amber-900">{user.nome || user.email}</span> ({user.perfil || 'operador'}) em <span className="text-amber-900">{empresaNome}</span>.
            </p>
            <p className="mt-1 text-sm text-slate-700">Sessao original mantida por {responsavel}. As permissoes e filtros atuais seguem o perfil selecionado.</p>
          </div>
          <div className="flex shrink-0">
            <Button type="button" variant="secondary" onClick={onStop} className="border-amber-400 bg-white/80 text-amber-900 hover:bg-white">
              Encerrar simulacao
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
