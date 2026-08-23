import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BoatIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { gerarViagemOperacionalId } from '../services/firebase.js'

function parseCapacidade(embarcacao) {
  const bruto = String(embarcacao?.capacidadePassageiros || embarcacao?.capacidade || '').match(/\d+/)
  return bruto ? Number(bruto[0]) : 0
}

export default function VendaPorMapa() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: rotas } = useCollectionOnce('rotasValores', { empresaId, empresaNome })
  const { items: embarcacoes } = useCollectionOnce('embarcacoes', { empresaId, empresaNome })
  const [form, setForm] = useState({
    dataViagem: new Date().toISOString().slice(0, 10),
    rotaId: '',
    embarcacaoId: '',
    horarioSaida: '',
  })

  const rota = useMemo(() => rotas.find((item) => item.id === form.rotaId) || null, [form.rotaId, rotas])
  const embarcacoesDisponiveis = useMemo(() => {
    if (!rota) return []
    return embarcacoes.filter((item) => {
      const rotasIds = Array.isArray(item.rotasIds) ? item.rotasIds : []
      return rotasIds.length ? rotasIds.includes(rota.id) : true
    })
  }, [embarcacoes, rota])
  const embarcacao = useMemo(() => embarcacoesDisponiveis.find((item) => item.id === form.embarcacaoId) || null, [embarcacoesDisponiveis, form.embarcacaoId])
  const horarios = useMemo(() => {
    const valores = embarcacao?.horariosPartida || rota?.horariosSaida || []
    if (Array.isArray(valores) && valores.length) return valores
    return []
  }, [embarcacao, rota])

  function abrirMapa(event) {
    event.preventDefault()
    if (!rota || !embarcacao || !form.horarioSaida) return
    const viagemId = gerarViagemOperacionalId({
      rotaId: rota.id,
      embarcacaoId: embarcacao.id,
      dataViagem: form.dataViagem,
      horarioSaida: form.horarioSaida,
    })
    const params = new URLSearchParams({
      rotaId: rota.id,
      embarcacaoId: embarcacao.id,
      embarcacaoNome: embarcacao.nome || '',
      origem: rota.origem || '',
      destino: rota.destino || '',
      dataViagem: form.dataViagem,
      horarioSaida: form.horarioSaida,
      capacidadeTotal: String(parseCapacidade(embarcacao)),
      valorPadrao: String(rota.valor || 0),
    })
    navigate(`/mapa-embarcacao/${viagemId}?${params.toString()}`)
  }

  return (
    <Layout title="Venda por mapa" subtitle="Selecione a saída e venda diretamente pelo assento." icon={<BoatIcon className="h-6 w-6" />}>
      <div className="mx-auto max-w-3xl">
        <PageShell title="Selecionar saída" subtitle="O mapa de assentos será a única tela de venda." showEyebrow={false}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={abrirMapa}>
            <Input label="Data da viagem" type="date" value={form.dataViagem} onChange={(event) => setForm((current) => ({ ...current, dataViagem: event.target.value }))} required />
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Linha</span>
              <select value={form.rotaId} onChange={(event) => setForm((current) => ({ ...current, rotaId: event.target.value, embarcacaoId: '', horarioSaida: '' }))} className="min-h-12 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-slate-900 shadow-sm outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100" required>
                <option value="">Selecione a linha</option>
                {rotas.map((item) => <option key={item.id} value={item.id}>{item.origem} - {item.destino}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Embarcação</span>
              <select value={form.embarcacaoId} onChange={(event) => setForm((current) => ({ ...current, embarcacaoId: event.target.value, horarioSaida: '' }))} disabled={!rota} className="min-h-12 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-slate-900 shadow-sm outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" required>
                <option value="">{rota ? 'Selecione a embarcação' : 'Selecione a linha primeiro'}</option>
                {embarcacoesDisponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            {horarios.length ? <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <span>Horário de saída</span>
              <select value={form.horarioSaida} onChange={(event) => setForm((current) => ({ ...current, horarioSaida: event.target.value }))} className="min-h-12 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-slate-900 shadow-sm outline-none focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100" required>
                <option value="">Selecione o horário</option>
                {horarios.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label> : <Input label="Horário de saída" type="time" value={form.horarioSaida} onChange={(event) => setForm((current) => ({ ...current, horarioSaida: event.target.value }))} disabled={!embarcacao} required />}

            {embarcacao ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1657d8]">Embarcação selecionada</p><p className="mt-1 font-bold text-slate-950">{embarcacao.nome} • {parseCapacidade(embarcacao)} assentos</p></div> : null}
            <Button type="submit" disabled={!rota || !embarcacao || !form.horarioSaida} className="w-full sm:col-span-2">Abrir mapa de assentos</Button>
          </form>
        </PageShell>
      </div>
    </Layout>
  )
}
