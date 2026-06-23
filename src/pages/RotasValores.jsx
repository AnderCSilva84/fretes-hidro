import { RouteIcon } from '../components/AppIcons.jsx'
import CollectionManager from '../components/CollectionManager.jsx'
import Layout from '../components/Layout.jsx'

export default function RotasValores() {
  return (
    <Layout title="Cadastro de rotas e valores" subtitle="Controle tarifario por origem e destino." icon={<RouteIcon className="h-6 w-6" />}>
      <CollectionManager
        collectionName="rotasValores"
        title="Rotas cadastradas"
        subtitle="Controle tarifario por origem e destino com manutencao rapida de cadastro."
        icon={<RouteIcon className="h-6 w-6" />}
        initialValues={{ origem: '', destino: '', valor: '', tempoEstimado: '' }}
        fields={[
          { name: 'origem', label: 'Origem', required: true },
          { name: 'destino', label: 'Destino', required: true },
          { name: 'valor', label: 'Valor', type: 'number', step: '0.01' },
          { name: 'tempoEstimado', label: 'Tempo estimado', fullWidth: true },
        ]}
        renderSummary={(rota) => (
          <>
            <p className="font-semibold text-slate-900">
              {rota.origem} - {rota.destino}
            </p>
            <p className="text-sm text-slate-500">Valor: R$ {Number(rota.valor || 0).toFixed(2)}</p>
            <p className="text-sm text-slate-500">Tempo: {rota.tempoEstimado || 'Nao informado'}</p>
          </>
        )}
      />
    </Layout>
  )
}
