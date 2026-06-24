import { BuildingIcon } from '../components/AppIcons.jsx'
import CollectionManager from '../components/CollectionManager.jsx'
import Layout from '../components/Layout.jsx'

const initialValues = {
  nome: '',
  cnpj: '',
  responsavel: '',
  telefone: '',
  email: '',
  endereco: '',
  observacoes: '',
}

export default function Empresas() {
  return (
    <Layout title="Empresas" subtitle="Cadastro das transportadoras que vao operar de forma independente no sistema." icon={<BuildingIcon className="h-6 w-6" />}>
      <CollectionManager
        collectionName="empresas"
        title="Empresas cadastradas"
        subtitle="Base multiempresa com dados institucionais e contato principal."
        icon={<BuildingIcon className="h-6 w-6" />}
        searchConfig={{
          fieldName: 'nome',
          label: 'Buscar empresa',
          placeholder: 'Digite o nome da empresa',
          minChars: 2,
          maxResults: 24,
        }}
        orderField="nomeBusca"
        orderDirection="asc"
        pageSize={12}
        scopeByEmpresa={false}
        initialValues={initialValues}
        fields={[
          { name: 'nome', label: 'Nome da empresa', required: true, fullWidth: true },
          { name: 'cnpj', label: 'CNPJ' },
          { name: 'responsavel', label: 'Responsavel' },
          { name: 'telefone', label: 'Telefone' },
          { name: 'email', label: 'E-mail', type: 'email' },
          { name: 'endereco', label: 'Endereco', fullWidth: true },
          { name: 'observacoes', label: 'Observacoes', fullWidth: true },
        ]}
        renderSummary={(empresa) => (
          <>
            <p className="font-semibold text-slate-900">{empresa.nome}</p>
            <p className="text-sm text-slate-500">{empresa.cnpj || 'CNPJ opcional nao informado'}</p>
            <p className="text-sm text-slate-500">{empresa.email || empresa.telefone || 'Sem contato principal'}</p>
          </>
        )}
      />
    </Layout>
  )
}
