import { useState } from 'react'
import { ClipboardIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { getLocalMigrationSummary, migrateLocalStoreToFirestore } from '../services/firebase.js'

const LABELS = {
  empresas: 'Empresas', usuarios: 'Usuarios', clientes: 'Clientes', terminais: 'Terminais',
  embarcacoes: 'Embarcacoes', rotasValores: 'Linhas e rotas', encomendas: 'Encomendas',
  viagens: 'Viagens', programacoesViagem: 'Programacoes', passageiros: 'Passageiros',
  passagens: 'Passagens', checkins: 'Check-ins', caixa: 'Caixas', movimentacoes: 'Movimentacoes', logsUso: 'Logs',
}

export default function MigracaoDados() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(() => getLocalMigrationSummary())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function migrate() {
    if (!window.confirm(`Enviar ${summary.total} registros locais deste computador para a base central do NAVIA?`)) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await migrateLocalStoreToFirestore(user)
      setSummary(getLocalMigrationSummary())
      setMessage(`${result.total} registros enviados para a base central. Os dispositivos agora podem usar as mesmas informacoes.`)
    } catch (migrationError) {
      setError(migrationError?.message || 'Nao foi possivel concluir a migracao.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Migracao de dados" subtitle="Centralize os cadastros locais para todos os dispositivos." icon={<ClipboardIcon className="h-6 w-6" />}>
      <PageShell title="Dados deste computador" subtitle="A copia preserva os registros locais e pode ser executada novamente sem duplicar cadastros." icon={<ClipboardIcon className="h-6 w-6" />}>
        {!summary.firebaseConfigured && <p className="rounded-2xl bg-amber-50 p-4 font-semibold text-amber-800">Este deploy ainda nao esta conectado ao Firebase.</p>}
        {!summary.available && <p className="rounded-2xl bg-slate-50 p-4 text-slate-700">Nenhum banco local foi encontrado neste computador.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary.collections).filter(([, count]) => count > 0).map(([name, count]) => (
            <div key={name} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{LABELS[name] || name}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{count}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-bold text-slate-900">Total: {summary.total} registros locais</p>{summary.completed && <p className="text-sm text-emerald-700">Ultima migracao: {new Date(summary.completed).toLocaleString('pt-BR')}</p>}</div>
          <Button type="button" onClick={migrate} disabled={busy || !summary.available || !summary.firebaseConfigured}>{busy ? 'Migrando...' : 'Migrar para a base central'}</Button>
        </div>
        {message && <p className="mt-4 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800">{message}</p>}
        {error && <p className="mt-4 rounded-2xl bg-rose-50 p-4 font-semibold text-rose-800">{error}</p>}
      </PageShell>
    </Layout>
  )
}
