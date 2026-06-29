import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ListIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { getViagemById, listarPassagensPorViagem } from '../services/firebase.js'
import { formatDateAndTimeBR } from '../utils/date.js'
import { abrirManifestoViagem } from '../utils/manifestoViagemPdf.js'

export default function ManifestoViagem() {
  const { viagemId } = useParams()
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const [viagem, setViagem] = useState(null)
  const [passagens, setPassagens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoading(true)
      const [viagemItem, passagensItens] = await Promise.all([
        getViagemById(viagemId, { empresaId, empresaNome }),
        listarPassagensPorViagem(viagemId, { empresaId, empresaNome }),
      ])

      if (active) {
        setViagem(viagemItem)
        setPassagens(passagensItens)
        setLoading(false)
      }
    }

    void carregar()
    return () => {
      active = false
    }
  }, [empresaId, empresaNome, viagemId])

  const resumo = useMemo(() => ({
    vendido: passagens.filter((item) => item.status !== 'Cancelada').length,
    embarcado: passagens.filter((item) => item.status === 'Embarcado').length,
    pendente: passagens.filter((item) => !['Embarcado', 'Cancelada'].includes(item.status)).length,
    cancelado: passagens.filter((item) => item.status === 'Cancelada').length,
  }), [passagens])

  return (
    <Layout title="Manifesto da viagem" subtitle="Lista operacional de passageiros por partida." icon={<ListIcon className="h-6 w-6" />}>
      <PageShell
        title="Passageiros da viagem"
        subtitle={viagem ? `${viagem.origem} - ${viagem.destino} • ${formatDateAndTimeBR(viagem.dataViagem, viagem.horarioSaida)}` : 'Carregando viagem...'}
        icon={<ListIcon className="h-6 w-6" />}
        actions={[
          <Button key="pdf" type="button" onClick={() => abrirManifestoViagem(viagem, passagens)} disabled={!viagem} className="w-full sm:w-auto">
            Gerar PDF
          </Button>,
        ]}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <ResumoCard label="Vendidos" value={resumo.vendido} />
          <ResumoCard label="Embarcados" value={resumo.embarcado} />
          <ResumoCard label="Pendentes" value={resumo.pendente} />
          <ResumoCard label="Cancelados" value={resumo.cancelado} />
        </div>

        <div className="mt-5 space-y-3">
          {passagens.map((item) => (
            <div key={item.id} className="rounded-[1.5rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-slate-950">{item.passageiroNome}</p>
                  <p className="text-sm text-slate-500">{item.passageiroDocumento || 'Sem documento'}</p>
                </div>
                <div className="grid gap-2 text-sm sm:flex sm:flex-wrap sm:items-center">
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-[#1657d8]">{item.status}</span>
                  <span>R$ {Number(item.valor || 0).toFixed(2)}</span>
                  <span>{item.formaPagamento || '-'}</span>
                  <span>{item.embarcadoEm || '-'}</span>
                </div>
              </div>
            </div>
          ))}

          {!loading && passagens.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
              Nenhuma passagem registrada para esta viagem.
            </div>
          ) : null}
        </div>
      </PageShell>
    </Layout>
  )
}

function ResumoCard({ label, value }) {
  return (
    <div className="rounded-[1.4rem] border border-blue-100 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  )
}
