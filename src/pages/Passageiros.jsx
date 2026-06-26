import { PeopleIcon } from '../components/AppIcons.jsx'
import CollectionManager from '../components/CollectionManager.jsx'
import Layout from '../components/Layout.jsx'

export default function Passageiros() {
  return (
    <Layout title="Passageiros" subtitle="Cadastro dedicado para venda de passagens com busca leve e paginada." icon={<PeopleIcon className="h-6 w-6" />}>
      <CollectionManager
        collectionName="passageiros"
        title="Passageiros cadastrados"
        subtitle="Base de passageiros separada dos clientes de frete para manter o dominio limpo."
        icon={<PeopleIcon className="h-6 w-6" />}
        searchConfig={{
          fieldName: 'nome',
          label: 'Buscar passageiro',
          placeholder: 'Digite nome ou inicio do nome',
          minChars: 2,
          maxResults: 24,
        }}
        orderField="nomeBusca"
        orderDirection="asc"
        pageSize={12}
        initialValues={{ nome: '', telefone: '', documento: '', email: '', tipo: 'Adulto' }}
        fields={[
          { name: 'nome', label: 'Nome', required: true, fullWidth: true },
          { name: 'telefone', label: 'Telefone' },
          { name: 'documento', label: 'Documento', required: true },
          { name: 'email', label: 'E-mail', type: 'email' },
          { name: 'tipo', label: 'Tipo' },
        ]}
        renderSummary={(item) => (
          <>
            <p className="font-semibold text-slate-900">{item.nome}</p>
            <p className="text-sm text-slate-500">{item.documento || 'Sem documento'}</p>
            <p className="text-sm text-slate-500">{item.telefone || item.email || item.tipo || 'Sem contato adicional'}</p>
          </>
        )}
      />
    </Layout>
  )
}
