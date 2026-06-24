import Button from '../components/Button.jsx'
import { PeopleIcon } from '../components/AppIcons.jsx'
import CollectionManager from '../components/CollectionManager.jsx'
import Layout from '../components/Layout.jsx'
import useAuth from '../context/useAuth.js'
import { listCollectionOnce } from '../services/firebase.js'
import { gerarClientesPdf } from '../utils/gerarClientesPdf.js'

export default function Clientes() {
  const { user } = useAuth()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''

  async function exportarClientes() {
    const items = await listCollectionOnce('clientes', { empresaId, empresaNome })
    await gerarClientesPdf(items)
  }

  return (
    <Layout title="Cadastro de clientes" subtitle="Remetentes e destinatarios usados nas comandas." icon={<PeopleIcon className="h-6 w-6" />}>
      <CollectionManager
        collectionName="clientes"
        title="Clientes cadastrados"
        subtitle="Lista de atendimento, pesquisa para autocomplete e manutencao de cadastro."
        icon={<PeopleIcon className="h-6 w-6" />}
        actions={[
          <Button key="exportar-clientes" type="button" onClick={exportarClientes}>
            Exportar PDF
          </Button>,
        ]}
        searchConfig={{
          fieldName: 'nome',
          label: 'Buscar cliente',
          placeholder: 'Digite nome ou inicio do nome',
          minChars: 2,
          maxResults: 24,
        }}
        orderField="nomeBusca"
        orderDirection="asc"
        pageSize={12}
        initialValues={{ nome: '', telefone: '', email: '', documento: '', cidade: '' }}
        fields={[
          { name: 'nome', label: 'Nome', required: true, fullWidth: true },
          { name: 'telefone', label: 'Telefone' },
          { name: 'email', label: 'E-mail', type: 'email' },
          { name: 'documento', label: 'Documento' },
          { name: 'cidade', label: 'Cidade' },
        ]}
        renderSummary={(cliente) => (
          <>
            <p className="font-semibold text-slate-900">{cliente.nome}</p>
            <p className="text-sm text-slate-500">{cliente.telefone || 'Sem telefone'}</p>
            <p className="text-sm text-slate-500">{cliente.email || cliente.documento || 'Sem contato digital'}</p>
          </>
        )}
      />
    </Layout>
  )
}
