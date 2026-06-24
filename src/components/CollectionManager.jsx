import { useEffect, useState } from 'react'
import Button from './Button.jsx'
import Input from './Input.jsx'
import PageShell from './PageShell.jsx'
import useAuth from '../context/useAuth.js'
import {
  addCollectionDocument,
  deleteCollectionDocument,
  listCollectionPage,
  searchCollectionByField,
  updateCollectionDocument,
} from '../services/firebase.js'

function buildInitialForm(fields, initialValues, item = null) {
  return fields.reduce((accumulator, field) => {
    const sourceValue = item?.[field.name] ?? initialValues[field.name] ?? ''
    accumulator[field.name] = sourceValue ?? ''
    return accumulator
  }, {})
}

export default function CollectionManager({
  collectionName,
  title,
  subtitle,
  icon,
  fields,
  initialValues,
  renderSummary,
  actions,
  searchConfig = null,
  orderField = 'criadoEm',
  orderDirection = 'desc',
  pageSize = 12,
  scopeByEmpresa = true,
}) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialValues)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false)

  const empresaId = scopeByEmpresa && !user?.rootSuperadmin ? user?.empresaId || '' : ''
  const empresaPayload = scopeByEmpresa
    ? {
        empresaId: empresaId || user?.empresaId || '',
        empresaNome: user?.empresaNome || '',
      }
    : {}

  async function carregarListaInicial() {
    setListBusy(true)

    try {
      const result = await listCollectionPage(collectionName, {
        orderField,
        orderDirection,
        maxResults: pageSize,
        empresaId,
        empresaNome: user?.empresaNome || '',
      })

      setItems(result.items)
      setCursor(result.cursor)
      setHasMore(result.hasMore)
      setSearchActive(false)
    } finally {
      setListBusy(false)
    }
  }

  useEffect(() => {
    let active = true

    async function carregar() {
      setListBusy(true)

      try {
        const result = await listCollectionPage(collectionName, {
          orderField,
          orderDirection,
          maxResults: pageSize,
          empresaId,
          empresaNome: user?.empresaNome || '',
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
          setListBusy(false)
        }
      }
    }

    void carregar()

    return () => {
      active = false
    }
  }, [collectionName, empresaId, orderDirection, orderField, pageSize, user?.empresaNome])

  function startEdit(item) {
    setEditingId(item.id)
    setForm(buildInitialForm(fields, initialValues, item))
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(initialValues)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    try {
      const payload = fields.reduce((accumulator, field) => {
        const rawValue = form[field.name]
        accumulator[field.name] = field.type === 'number' ? Number(rawValue || 0) : rawValue
        return accumulator
      }, {})

      if (editingId) {
        await updateCollectionDocument(collectionName, editingId, { ...payload, ...empresaPayload })
      } else {
        await addCollectionDocument(collectionName, { ...payload, ...empresaPayload })
      }

      if (searchActive && searchConfig) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }
      cancelEdit()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`Excluir ${item.nome || item.origem || item.codigo || 'registro'}?`)

    if (!confirmed) {
      return
    }

    setBusy(true)
    try {
      await deleteCollectionDocument(collectionName, item.id)
      if (searchActive && searchConfig) {
        await handleSearch(null, searchTerm)
      } else {
        await carregarListaInicial()
      }
      if (editingId === item.id) {
        cancelEdit()
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSearch(event, forcedTerm = null) {
    if (event) {
      event.preventDefault()
    }

    if (!searchConfig) {
      return
    }

    const term = String(forcedTerm ?? searchTerm).trim()

    if (!term) {
      await carregarListaInicial()
      return
    }

    if (term.length < (searchConfig.minChars || 2)) {
      return
    }

    setListBusy(true)

    try {
      const result = await searchCollectionByField(
        collectionName,
        searchConfig.fieldName,
        term,
        searchConfig.maxResults || Math.max(pageSize, 12),
        { empresaId, empresaNome: user?.empresaNome || '' },
      )

      setItems(result)
      setCursor(null)
      setHasMore(false)
      setSearchActive(true)
    } finally {
      setListBusy(false)
    }
  }

  async function handleClearSearch() {
    setSearchTerm('')
    await carregarListaInicial()
  }

  async function handleLoadMore() {
    if (!hasMore || searchActive) {
      return
    }

    setListBusy(true)

    try {
      const result = await listCollectionPage(collectionName, {
        orderField,
        orderDirection,
        maxResults: pageSize,
        cursor,
        empresaId,
        empresaNome: user?.empresaNome || '',
      })

      setItems((current) => [...current, ...result.items])
      setCursor(result.cursor)
      setHasMore(result.hasMore)
    } finally {
      setListBusy(false)
    }
  }

  return (
    <PageShell title={title} subtitle={subtitle} icon={icon} actions={actions}>
      <div className="space-y-6">
        <div className="rounded-[1.7rem] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(28,99,231,0.05)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1657d8]">Cadastro</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">{editingId ? 'Editar registro' : 'Novo registro'}</h3>
            </div>
            {editingId ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#1657d8]">
                Edicao
              </span>
            ) : null}
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            {fields.map((field) => (
              <Input
                key={field.name}
                className={field.fullWidth ? 'md:col-span-2' : ''}
                label={field.label}
                type={field.type || 'text'}
                step={field.step}
                min={field.min}
                value={form[field.name]}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                required={field.required}
              />
            ))}
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="submit" disabled={busy}>
                {editingId ? 'Atualizar registro' : 'Salvar registro'}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {searchConfig ? (
          <form className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4" onSubmit={handleSearch}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input
                className="flex-1"
                label={searchConfig.label || 'Buscar'}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchConfig.placeholder || 'Digite para buscar'}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={listBusy}>
                  Buscar
                </Button>
                <Button type="button" variant="secondary" onClick={handleClearSearch} disabled={listBusy || !searchTerm}>
                  Limpar
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {searchActive
                ? 'Exibindo resultado da busca sob demanda.'
                : 'Carga inicial reduzida. Use a busca para consultar sem ler toda a colecao.'}
            </p>
          </form>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[1.6rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
            >
              {renderSummary(item)}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => startEdit(item)} disabled={busy}>
                  Editar
                </Button>
                <Button type="button" variant="danger" onClick={() => handleDelete(item)} disabled={busy}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}

          {items.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              {listBusy ? 'Carregando registros...' : 'Nenhum registro cadastrado ainda.'}
            </div>
          ) : null}
        </div>

        {!searchActive && hasMore ? (
          <div className="flex justify-center">
            <Button type="button" variant="secondary" onClick={handleLoadMore} disabled={listBusy}>
              {listBusy ? 'Carregando...' : 'Carregar mais'}
            </Button>
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
