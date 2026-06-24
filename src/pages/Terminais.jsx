import { PinIcon } from '../components/AppIcons.jsx'
import CollectionManager from '../components/CollectionManager.jsx'
import Layout from '../components/Layout.jsx'

export default function Terminais() {
  return (
    <Layout title="Cadastro de terminais" subtitle="Organize os pontos de postagem e destino." icon={<PinIcon className="h-6 w-6" />}>
      <CollectionManager
        collectionName="terminais"
        title="Terminais cadastrados"
        subtitle="Pontos de postagem e destino com manutencao rapida de cadastro."
        icon={<PinIcon className="h-6 w-6" />}
        orderField="nome"
        orderDirection="asc"
        pageSize={12}
        initialValues={{ nome: '', cidade: '', observacao: '' }}
        fields={[
          { name: 'nome', label: 'Nome', required: true, fullWidth: true },
          { name: 'cidade', label: 'Cidade' },
          { name: 'observacao', label: 'Observacao', fullWidth: true },
        ]}
        renderSummary={(terminal) => (
          <>
            <p className="font-semibold text-slate-900">{terminal.nome}</p>
            <p className="text-sm text-slate-500">{terminal.cidade || 'Sem cidade'}</p>
            <p className="text-sm text-slate-500">{terminal.observacao || 'Sem observacao'}</p>
          </>
        )}
      />
    </Layout>
  )
}
