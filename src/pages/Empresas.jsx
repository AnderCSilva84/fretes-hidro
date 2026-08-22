import { useEffect, useState } from 'react'
import { BuildingIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import ImageUploadField from '../components/ImageUploadField.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useBranding from '../context/useBranding.js'
import { addCollectionDocument, deleteCollectionDocument, listCollectionPage, searchCollectionByField, updateCollectionDocument } from '../services/firebase.js'
import { readFileAsDataUrl } from '../utils/fileDataUrl.js'

const PAGE_SIZE = 12

const initialForm = {
  nome: '',
  cnpj: '',
  responsavel: '',
  telefone: '',
  telefoneSac: '',
  email: '',
  endereco: '',
  observacoes: '',
  corPrimaria: '#0f4da5',
  corSecundaria: '#072d67',
  corDestaque: '#2f9e44',
  logoUrl: '',
  ativo: true,
}

export default function Empresas() {
  const { user } = useAuth()
  const { company: empresaAtual } = useBranding()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

  useEffect(() => {
    let active = true

    async function carregar() {
      setLoadingList(true)

      try {
        const result = await listCollectionPage('empresas', {
          orderField: 'nomeBusca',
          orderDirection: 'asc',
          maxResults: PAGE_SIZE,
        })

        if (!active) {
          return
        }

        setItems(result.items)
        setCursor(result.cursor)
        setHasMore(result.hasMore)
        setSearchActive(false)
      } finally {
        if (active) {
          setLoadingList(false)
        }
      }
    }

    void carregar()

    return () => {
      active = false
    }
  }, [])

  async function carregarListaInicial() {
    setLoadingList(true)

    try {
      const result = await listCollectionPage('empresas', {
        orderField: 'nomeBusca',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
      })

      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } finally {
      setLoadingList(false)
    }
  }

  function cancelarEdicao() {
    setEditingId('')
    setForm(initialForm)
  }

  function iniciarEdicao(item) {
    setEditingId(item.id)
    setForm({
      nome: item.nome || '',
      cnpj: item.cnpj || '',
      responsavel: item.responsavel || '',
      telefone: item.telefone || '',
      telefoneSac: item.telefoneSac || '',
      email: item.email || '',
      endereco: item.endereco || '',
      observacoes: item.observacoes || '',
      corPrimaria: item.corPrimaria || '#0f4da5',
      corSecundaria: item.corSecundaria || '#072d67',
      corDestaque: item.corDestaque || '#2f9e44',
      logoUrl: item.logoUrl || item.logoDataUrl || '',
      ativo: item.ativo !== false,
    })
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    setForm((current) => ({ ...current, logoUrl: dataUrl }))
    event.target.value = ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    try {
      const payload = {
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim(),
        responsavel: form.responsavel.trim(),
        telefone: form.telefone.trim(),
        telefoneSac: form.telefoneSac.trim(),
        email: form.email.trim(),
        endereco: form.endereco.trim(),
        observacoes: form.observacoes.trim(),
        corPrimaria: form.corPrimaria,
        corSecundaria: form.corSecundaria,
        corDestaque: form.corDestaque,
        logoUrl: form.logoUrl,
        logoDataUrl: form.logoUrl,
        ativo: form.ativo,
      }

      if (editingId) {
        await updateCollectionDocument('empresas', editingId, payload)
      } else {
        await addCollectionDocument('empresas', payload)
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('company-branding-updated'))
      }

      if (searchActive) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }

      cancelarEdicao()
    } finally {
      setBusy(false)
    }
  }

  async function handleSearch(event, forcedTerm = null) {
    if (event) {
      event.preventDefault()
    }

    const term = String(forcedTerm ?? searchTerm).trim()

    if (!term) {
      await carregarListaInicial()
      return
    }

    if (term.length < 2) {
      return
    }

    setLoadingList(true)

    try {
      const result = await searchCollectionByField('empresas', 'nome', term, 24)
      setItems(result)
      setCursor(null)
      setHasMore(false)
      setSearchActive(true)
    } finally {
      setLoadingList(false)
    }
  }

  async function limparBusca() {
    setSearchTerm('')
    await carregarListaInicial()
  }

  async function carregarMais() {
    if (!hasMore || searchActive) {
      return
    }

    setLoadingList(true)

    try {
      const result = await listCollectionPage('empresas', {
        orderField: 'nomeBusca',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        cursor,
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingList(false)
    }
  }

  async function excluir(item) {
    if (!user?.rootSuperadmin) {
      return
    }

    const confirmed = window.confirm(`Excluir a empresa ${item.nome || 'sem nome'}?`)

    if (!confirmed) {
      return
    }

    setBusy(true)

    try {
      await deleteCollectionDocument('empresas', item.id)

      if (searchActive) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }

      if (editingId === item.id) {
        cancelarEdicao()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Empresas" subtitle="Cadastro multiempresa com identidade visual e configuracao administrativa." icon={<BuildingIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        <PageShell
          title="Cadastrar empresa"
          subtitle="Somente superadmin gerencia quais empresas operam no sistema e como cada uma aparece na interface."
          icon={<BuildingIcon className="h-6 w-6" />}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              className="md:col-span-2"
              label="Nome da empresa"
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              required
            />
            <Input label="CNPJ" value={form.cnpj} onChange={(event) => setForm((current) => ({ ...current, cnpj: event.target.value }))} />
            <Input label="Responsavel" value={form.responsavel} onChange={(event) => setForm((current) => ({ ...current, responsavel: event.target.value }))} />
            <Input label="Telefone" value={form.telefone} onChange={(event) => setForm((current) => ({ ...current, telefone: event.target.value }))} />
            <Input label="Telefone SAC" value={form.telefoneSac} onChange={(event) => setForm((current) => ({ ...current, telefoneSac: event.target.value }))} />
            <Input label="E-mail" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            <Input className="md:col-span-2" label="Endereco" value={form.endereco} onChange={(event) => setForm((current) => ({ ...current, endereco: event.target.value }))} />

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Observacoes</span>
              <textarea
                rows="4"
                value={form.observacoes}
                onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
                className="w-full rounded-[1rem] border border-blue-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4 md:col-span-2">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Cores da interface</p>
                <p className="text-xs text-slate-500">Essas cores passam a personalizar o topo, menu lateral e destaques da empresa.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['corPrimaria', 'Cor primaria'],
                  ['corSecundaria', 'Cor secundaria'],
                  ['corDestaque', 'Cor de destaque'],
                ].map(([fieldName, label]) => (
                  <label key={fieldName} className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    <span>{label}</span>
                    <div className="flex items-center gap-3 rounded-[1rem] border border-blue-200 bg-white px-3 py-2">
                      <input
                        type="color"
                        value={form[fieldName]}
                        onChange={(event) => setForm((current) => ({ ...current, [fieldName]: event.target.value }))}
                        className="h-10 w-14 rounded-md border-0 bg-transparent p-0"
                      />
                      <span className="text-sm text-slate-600">{form[fieldName]}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <ImageUploadField
                label="Logo da empresa"
                value={form.logoUrl}
                hint="A logo aparece no topo e no menu lateral para a empresa logada."
                onFileChange={handleLogoChange}
                onClear={() => setForm((current) => ({ ...current, logoUrl: '' }))}
              />
            </div>

            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
              />
              Empresa ativa e disponivel para operacao
            </label>

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="submit" disabled={busy}>
                {editingId ? 'Atualizar empresa' : 'Salvar empresa'}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={cancelarEdicao}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>
        </PageShell>

        <PageShell
          title="Empresas cadastradas"
          subtitle="Consulta e manutencao das empresas disponiveis na operacao."
          icon={<BuildingIcon className="h-6 w-6" />}
        >
          <form className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleSearch}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input
                className="flex-1"
                label="Buscar empresa"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Digite o nome"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={loadingList}>
                  Buscar
                </Button>
                <Button type="button" variant="secondary" onClick={limparBusca} disabled={loadingList || !searchTerm}>
                  Limpar
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((empresa) => (
              <div key={empresa.id} className="overflow-hidden rounded-[1.7rem] border border-blue-100 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                <div
                  className="h-24 px-4 py-4 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${empresa.corSecundaria || '#072d67'} 0%, ${empresa.corPrimaria || '#0f4da5'} 58%, ${empresa.corDestaque || '#2f9e44'} 100%)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold">{empresa.nome}</p>
                      <p className="text-sm text-white/85">{empresa.cnpj || 'CNPJ nao informado'}</p>
                    </div>
                    {empresa.logoUrl || empresa.logoDataUrl ? (
                      <img
                        src={empresa.logoUrl || empresa.logoDataUrl}
                        alt={empresa.nome}
                        className="h-14 w-14 rounded-2xl border border-white/35 bg-white object-cover p-1"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 p-4">
                  <p className="text-sm text-slate-600">{empresa.email || empresa.telefone || 'Sem contato principal'}</p>
                  <p className="text-sm text-slate-500">Responsavel: {empresa.responsavel || 'Nao informado'}</p>
                  <p className="text-sm text-slate-500">SAC: {empresa.telefoneSac || 'Nao informado'}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[empresa.corPrimaria, empresa.corSecundaria, empresa.corDestaque].filter(Boolean).map((cor) => (
                      <span key={`${empresa.id}-${cor}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: cor }} />
                        {cor}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${empresa.ativo === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {empresa.ativo === false ? 'Inativa' : 'Ativa'}
                    </span>
                    {empresaAtual?.id === empresa.id ? (
                      <span className="rounded-full bg-[var(--brand-primary-fade)] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)]">
                        Empresa em uso
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={() => iniciarEdicao(empresa)} disabled={busy}>
                      Editar
                    </Button>
                    {user?.rootSuperadmin ? (
                      <Button type="button" variant="danger" onClick={() => excluir(empresa)} disabled={busy}>
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                {loadingList ? 'Carregando empresas...' : 'Nenhuma empresa cadastrada ainda.'}
              </div>
            ) : null}
          </div>

          {!searchActive && hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="secondary" onClick={carregarMais} disabled={loadingList}>
                {loadingList ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </PageShell>
      </div>
    </Layout>
  )
}
