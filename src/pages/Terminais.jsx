import { useEffect, useState } from 'react'
import { PinIcon } from '../components/AppIcons.jsx'
import Button from '../components/Button.jsx'
import ImageUploadField from '../components/ImageUploadField.jsx'
import Input from '../components/Input.jsx'
import Layout from '../components/Layout.jsx'
import PageShell from '../components/PageShell.jsx'
import useAuth from '../context/useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { addCollectionDocument, deleteCollectionDocument, listCollectionPage, searchCollectionByField, updateCollectionDocument } from '../services/firebase.js'
import { readFileAsDataUrl } from '../utils/fileDataUrl.js'
import { isTerminalEnvironment } from '../utils/appEnvironment.js'

const PAGE_SIZE = 12

const initialForm = {
  nome: '',
  cidade: '',
  endereco: '',
  latitude: '',
  longitude: '',
  observacao: '',
  imagemUrl: '',
  empresaId: '',
  empresaNome: '',
}

export default function Terminais() {
  const { user } = useAuth()
  const readOnly = isTerminalEnvironment()
  const empresaId = user?.rootSuperadmin ? '' : user?.empresaId || ''
  const empresaNome = user?.empresaNome || ''
  const { items: empresas } = useCollectionOnce('empresas')
  const [items, setItems] = useState([])
  const [form, setForm] = useState({
    ...initialForm,
    empresaId: empresaId || '',
    empresaNome: empresaNome || '',
  })
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
        const result = await listCollectionPage('terminais', {
          orderField: 'nomeBusca',
          orderDirection: 'asc',
          maxResults: PAGE_SIZE,
          empresaId,
          empresaNome,
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
  }, [empresaId, empresaNome])

  function resetForm() {
    setForm({
      ...initialForm,
      empresaId: user?.rootSuperadmin ? '' : user?.empresaId || '',
      empresaNome: user?.rootSuperadmin ? '' : user?.empresaNome || '',
    })
  }

  function cancelarEdicao() {
    setEditingId('')
    resetForm()
  }

  function iniciarEdicao(item) {
    setEditingId(item.id)
    setForm({
      nome: item.nome || '',
      cidade: item.cidade || '',
      endereco: item.endereco || '',
      latitude: String(item.latitude ?? item.lat ?? ''),
      longitude: String(item.longitude ?? item.lng ?? ''),
      observacao: item.observacao || '',
      imagemUrl: item.imagemUrl || item.imagemDataUrl || '',
      empresaId: item.empresaId || '',
      empresaNome: item.empresaNome || '',
    })
  }

  async function carregarListaInicial() {
    setLoadingList(true)

    try {
      const result = await listCollectionPage('terminais', {
        orderField: 'nomeBusca',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        empresaId,
        empresaNome,
      })

      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } finally {
      setLoadingList(false)
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    setForm((current) => ({ ...current, imagemUrl: dataUrl }))
    event.target.value = ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    try {
      const latitude = Number.parseFloat(form.latitude)
      const longitude = Number.parseFloat(form.longitude)
      const payload = {
        nome: form.nome.trim(),
        cidade: form.cidade.trim(),
        endereco: form.endereco.trim(),
        latitude: Number.isFinite(latitude) ? latitude : '',
        longitude: Number.isFinite(longitude) ? longitude : '',
        lat: Number.isFinite(latitude) ? latitude : '',
        lng: Number.isFinite(longitude) ? longitude : '',
        observacao: form.observacao.trim(),
        imagemUrl: form.imagemUrl,
        imagemDataUrl: form.imagemUrl,
        empresaId: user?.rootSuperadmin ? form.empresaId : user?.empresaId || '',
        empresaNome: user?.rootSuperadmin ? form.empresaNome : user?.empresaNome || '',
      }

      if (editingId) {
        await updateCollectionDocument('terminais', editingId, payload)
      } else {
        await addCollectionDocument('terminais', payload)
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
      const result = await searchCollectionByField('terminais', 'nome', term, 24, { empresaId, empresaNome })
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
      const result = await listCollectionPage('terminais', {
        orderField: 'nomeBusca',
        orderDirection: 'asc',
        maxResults: PAGE_SIZE,
        cursor,
        empresaId,
        empresaNome,
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingList(false)
    }
  }

  async function excluir(item) {
    const confirmed = window.confirm(`Excluir o terminal ${item.nome || 'sem nome'}?`)

    if (!confirmed) {
      return
    }

    setBusy(true)

    try {
      await deleteCollectionDocument('terminais', item.id)

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
    <Layout title="Cadastro de terminais" subtitle="Organize os pontos de postagem e destino com imagem e localizacao georeferenciada." icon={<PinIcon className="h-6 w-6" />}>
      <div className="space-y-6">
        {!readOnly ? <PageShell title="Novo terminal" subtitle="Cadastre o terminal com dados visuais e coordenadas para uso no dashboard." icon={<PinIcon className="h-6 w-6" />}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <Input className="md:col-span-2" label="Nome" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} required />
            <Input label="Cidade" value={form.cidade} onChange={(event) => setForm((current) => ({ ...current, cidade: event.target.value }))} />
            <Input label="Endereco" value={form.endereco} onChange={(event) => setForm((current) => ({ ...current, endereco: event.target.value }))} />
            <Input label="Latitude" type="number" step="0.000001" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} />
            <Input label="Longitude" type="number" step="0.000001" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} />

            {user?.rootSuperadmin ? (
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Empresa</span>
                <select
                  value={form.empresaId}
                  onChange={(event) => {
                    const empresaSelecionada = empresas.find((item) => item.id === event.target.value)
                    setForm((current) => ({
                      ...current,
                      empresaId: event.target.value,
                      empresaNome: empresaSelecionada?.nome || '',
                    }))
                  }}
                  className="min-h-10 rounded-[1.1rem] border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Selecione a empresa</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Observacao</span>
              <textarea
                rows="4"
                value={form.observacao}
                onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
                className="w-full rounded-[1rem] border border-blue-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1c63e7] focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="md:col-span-2">
              <ImageUploadField
                label="Imagem do terminal"
                value={form.imagemUrl}
                hint="Use foto da fachada, cais ou ponto de apoio para facilitar a identificacao."
                onFileChange={handleImageChange}
                onClear={() => setForm((current) => ({ ...current, imagemUrl: '' }))}
              />
            </div>

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="submit" disabled={busy}>
                {editingId ? 'Atualizar terminal' : 'Salvar terminal'}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={cancelarEdicao}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>
        </PageShell> : null}

        <PageShell title="Terminais cadastrados" subtitle="Bases da empresa com consulta rapida, foto e coordenadas." icon={<PinIcon className="h-6 w-6" />}>
          <form className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleSearch}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input
                className="flex-1"
                label="Buscar terminal"
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
            {items.map((terminal) => (
              <div key={terminal.id} className="overflow-hidden rounded-[1.7rem] border border-blue-100 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                {terminal.imagemUrl || terminal.imagemDataUrl ? (
                  <img src={terminal.imagemUrl || terminal.imagemDataUrl} alt={terminal.nome} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-blue-50 text-sm text-slate-500">Sem imagem</div>
                )}
                <div className="space-y-2 p-4">
                  <p className="text-lg font-bold text-slate-950">{terminal.nome}</p>
                  <p className="text-sm text-slate-500">{terminal.cidade || 'Cidade nao informada'}</p>
                  <p className="text-sm text-slate-500">{terminal.endereco || 'Endereco nao informado'}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                    {terminal.latitude ?? terminal.lat ? `${terminal.latitude ?? terminal.lat}, ${terminal.longitude ?? terminal.lng}` : 'Sem coordenadas'}
                  </p>
                  <p className="text-sm text-slate-500">{terminal.empresaNome || 'Sem empresa vinculada'}</p>
                  {!readOnly ? <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={() => iniciarEdicao(terminal)} disabled={busy}>
                      Editar
                    </Button>
                    <Button type="button" variant="danger" onClick={() => excluir(terminal)} disabled={busy}>
                      Excluir
                    </Button>
                  </div> : null}
                </div>
              </div>
            ))}

            {items.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                {loadingList ? 'Carregando terminais...' : 'Nenhum terminal cadastrado ainda.'}
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
