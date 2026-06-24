import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ClipboardIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import { listCollectionPage } from '../services/firebase.js'
import { isRootSuperadminUser } from '../utils/systemConfig.js'

function formatarData(valor) {
  if (!valor) {
    return 'Nao informado'
  }

  const dateValue = valor?.toDate ? valor.toDate() : new Date(valor)

  if (Number.isNaN(dateValue.getTime())) {
    return 'Nao informado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(dateValue)
}

export default function LogsUso() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)

    try {
      const result = await listCollectionPage('logsUso', {
        orderField: 'criadoEm',
        orderDirection: 'desc',
        maxResults: 50,
      })

      setItems(result.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function carregarInicial() {
      try {
        const result = await listCollectionPage('logsUso', {
          orderField: 'criadoEm',
          orderDirection: 'desc',
          maxResults: 50,
        })

        if (!active) {
          return
        }

        setItems(result.items)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void carregarInicial()

    return () => {
      active = false
    }
  }, [])

  if (!isRootSuperadminUser(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Layout title="Logs de uso" subtitle="Auditoria resumida de acessos e acoes sensiveis do sistema." icon={<ClipboardIcon className="h-6 w-6" />}>
      <PageShell
        title="Ultimos eventos"
        subtitle="Visao reservada ao superadmin principal."
        icon={<ClipboardIcon className="h-6 w-6" />}
        actions={[
          <Button key="recarregar-logs" type="button" variant="secondary" onClick={carregar} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </Button>,
        ]}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[1.4rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-slate-900">{item.acao}</p>
                <p className="text-xs text-slate-500">{formatarData(item.criadoEm)}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.detalhes || 'Sem detalhes adicionais.'}</p>
              <p className="mt-2 text-xs text-slate-500">
                Usuario: {item.usuarioNome || item.usuarioEmail || 'Nao informado'} • Perfil: {item.perfil || 'N/D'} • Empresa: {item.empresaNome || 'Central'}
              </p>
            </div>
          ))}

          {items.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500">
              {loading ? 'Carregando logs...' : 'Nenhum log registrado ainda.'}
            </div>
          ) : null}
        </div>
      </PageShell>
    </Layout>
  )
}
