import { BoatIcon } from '../components/AppIcons.jsx'
import CollectionManager from '../components/CollectionManager.jsx'
import Layout from '../components/Layout.jsx'

export default function Embarcacoes() {
  return (
    <Layout title="Cadastro de embarcacoes" subtitle="Cadastro da frota usada nas rotas hidroviarias." icon={<BoatIcon className="h-6 w-6" />}>
      <CollectionManager
        collectionName="embarcacoes"
        title="Embarcacoes cadastradas"
        subtitle="Frota utilizada nas rotas hidroviarias com manutencao rapida de cadastro."
        icon={<BoatIcon className="h-6 w-6" />}
        initialValues={{ nome: '', identificacao: '', capacidade: '' }}
        fields={[
          { name: 'nome', label: 'Nome', required: true, fullWidth: true },
          { name: 'identificacao', label: 'Identificacao' },
          { name: 'capacidade', label: 'Capacidade' },
        ]}
        renderSummary={(embarcacao) => (
          <>
            <p className="font-semibold text-slate-900">{embarcacao.nome}</p>
            <p className="text-sm text-slate-500">{embarcacao.identificacao || 'Sem identificacao'}</p>
            <p className="text-sm text-slate-500">{embarcacao.capacidade || 'Sem capacidade'}</p>
          </>
        )}
      />
    </Layout>
  )
}
