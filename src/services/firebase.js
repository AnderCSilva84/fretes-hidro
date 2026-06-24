import { deleteApp, initializeApp, getApp, getApps } from 'firebase/app'
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  getCountFromServer,
  getDocs,
  getFirestore,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAt,
  startAfter,
  endAt,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { obterRemetenteNome } from '../utils/remetente.js'
import { DEFAULT_EMPRESA, ROOT_SUPERADMIN_EMAIL, SYSTEM_NAME, isRootSuperadminEmail, normalizeEmail } from '../utils/systemConfig.js'
import { getIndexedFieldName, normalizeSearchValue, prepareCollectionPayload } from './searchNormalization.js'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
let app = null
let auth = null
let db = null

if (isConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
}

const storageKey = 'fretes-pwa-demo-store'
const authKey = 'fretes-pwa-demo-user'
const listeners = new Map()
let authListeners = new Set()

const seedStore = {
  empresas: [
    {
      id: DEFAULT_EMPRESA.id,
      nome: DEFAULT_EMPRESA.nome,
      nomeBusca: normalizeSearchValue(DEFAULT_EMPRESA.nome),
      cnpj: DEFAULT_EMPRESA.cnpj,
      responsavel: 'Administracao central',
      telefone: '',
      email: ROOT_SUPERADMIN_EMAIL,
      endereco: '',
      observacoes: 'Empresa principal cadastrada para operacao inicial do sistema.',
      ativo: true,
    },
  ],
  usuarios: [
    {
      id: 'superadmin-root',
      uid: 'superadmin-root',
      nome: 'Administrador Principal',
      email: ROOT_SUPERADMIN_EMAIL,
      perfil: 'superadmin',
      senha: '123456',
      ativo: true,
      empresaId: '',
      empresaNome: SYSTEM_NAME,
    },
    {
      id: 'admin-demo',
      uid: 'admin-demo',
      nome: 'Admin Fretes',
      email: 'admin@fretes.local',
      perfil: 'admin',
      senha: '123456',
      ativo: true,
      empresaId: DEFAULT_EMPRESA.id,
      empresaNome: DEFAULT_EMPRESA.nome,
    },
  ],
  clientes: [
    {
      id: 'c1',
      nome: 'Joana Ribeiro',
      nomeBusca: normalizeSearchValue('Joana Ribeiro'),
      telefone: '(91) 98888-1000',
      email: 'joana@fretes.local',
      empresaId: DEFAULT_EMPRESA.id,
      empresaNome: DEFAULT_EMPRESA.nome,
      documento: '123.456.789-00',
      cidade: 'Belém',
    },
    {
      id: 'c2',
      nome: 'Mercado do Porto LTDA',
      nomeBusca: normalizeSearchValue('Mercado do Porto LTDA'),
      telefone: '(91) 98888-2000',
      email: 'recebimento@mercado.local',
      empresaId: DEFAULT_EMPRESA.id,
      empresaNome: DEFAULT_EMPRESA.nome,
      documento: '12.345.678/0001-00',
      cidade: 'Icoaraci',
    },
  ],
  terminais: [
    { id: 't1', nome: 'Terminal Hidroviário de Belém', cidade: 'Belém' },
    { id: 't2', nome: 'Terminal de Cametá', cidade: 'Cametá' },
  ],
  embarcacoes: [
    { id: 'e1', nome: 'Balsa Marajoara', identificacao: 'BLS-01', capacidade: '12t' },
  ],
  rotasValores: [
    {
      id: 'r1',
      origem: 'Belém',
      destino: 'Cametá',
      terminalOrigem: 'THT Tamandaré',
      terminalDestino: 'Terminal de Cametá',
      valor: 85,
      tempoEstimado: '1 dia',
    },
  ],
  encomendas: [
    {
      id: 'demo-encomenda',
      codigo: 'FRT-2026-000001',
      remetenteId: 'c1',
      remetenteNome: 'Joana Ribeiro',
      destinatarioId: 'c2',
      destinatarioNome: 'Mercado do Porto LTDA',
      terminalOrigem: 'Terminal Hidroviário de Belém',
      terminalDestino: 'Terminal de Cametá',
      tipoMercadoria: 'Documentos',
      descricao: 'Envelope com documentação',
      quantidade: 1,
      peso: 1.2,
      valorFrete: 30,
      taxa: 5,
      valorTotal: 35,
      formaPagamento: 'PIX',
      status: 'Postado',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
  ],
  caixa: [],
  resumos: {
    admin: {
      id: 'admin',
      totalEncomendas: 1,
      totalClientes: 2,
      totalTerminais: 2,
    },
    caixa: {
      id: 'caixa',
      totalEntrada: 0,
      totalRegistros: 0,
    },
  },
  movimentacoes: [
    {
      id: 'm1',
      encomendaCodigo: 'FRT-2026-000001',
      status: 'Postado',
      descricao: 'Encomenda recebida e registrada no sistema',
      criadoEm: new Date().toISOString(),
    },
  ],
}

function preencherEmpresaPadrao(item = {}) {
  return {
    ...item,
    empresaId: item.empresaId ?? '',
    empresaNome: item.empresaNome ?? '',
  }
}

function inferTerminalOrigem(origem) {
  const normalized = String(origem || '').trim().toLowerCase()

  if (normalized === 'belém' || normalized === 'belem') {
    return 'THT Tamandaré'
  }

  if (normalized === 'barcarena') {
    return 'Terminal Hidroviario de Barcarena'
  }

  if (normalized === 'são francisco' || normalized === 'sao francisco') {
    return 'Amazonat'
  }

  return ''
}

function migrateStore(store) {
  const nextStore = structuredClone(store || {})

  nextStore.empresas = Array.isArray(nextStore.empresas) && nextStore.empresas.length
    ? nextStore.empresas
    : structuredClone(seedStore.empresas || [])

  nextStore.logsUso = Array.isArray(nextStore.logsUso) ? nextStore.logsUso : []

  nextStore.usuarios = (nextStore.usuarios || []).map((item) => ({
    ...item,
    email: normalizeEmail(item.email),
    nomeBusca: item.nomeBusca || normalizeSearchValue(item.nome),
    emailBusca: item.emailBusca || normalizeSearchValue(item.email),
    empresaId: item.empresaId ?? '',
    empresaNome: item.empresaNome ?? (isRootSuperadminEmail(item.email) ? SYSTEM_NAME : ''),
  }))

  if (!nextStore.usuarios.some((item) => isRootSuperadminEmail(item.email))) {
    nextStore.usuarios.unshift({
      id: 'superadmin-root',
      uid: 'superadmin-root',
      nome: 'Administrador Principal',
      email: ROOT_SUPERADMIN_EMAIL,
      perfil: 'superadmin',
      senha: '123456',
      ativo: true,
      empresaId: '',
      empresaNome: SYSTEM_NAME,
    })
  }

  nextStore.clientes = (nextStore.clientes || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    nomeBusca: item.nomeBusca || normalizeSearchValue(item.nome),
  }))

  nextStore.terminais = (nextStore.terminais || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    nomeBusca: item.nomeBusca || normalizeSearchValue(item.nome),
  }))

  nextStore.embarcacoes = (nextStore.embarcacoes || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    nomeBusca: item.nomeBusca || normalizeSearchValue(item.nome),
  }))

  nextStore.rotasValores = (nextStore.rotasValores || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    terminalOrigem: item.terminalOrigem || inferTerminalOrigem(item.origem),
    origemBusca: item.origemBusca || normalizeSearchValue(item.origem),
    destinoBusca: item.destinoBusca || normalizeSearchValue(item.destino),
    linhaBusca: item.linhaBusca || normalizeSearchValue(`${item.origem || ''} ${item.destino || ''}`.trim()),
  }))

  nextStore.encomendas = (nextStore.encomendas || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    codigoBusca: item.codigoBusca || normalizeSearchValue(item.codigo, { upper: true }),
    remetenteBusca: item.remetenteBusca || normalizeSearchValue(item.remetenteNome),
    destinatarioBusca: item.destinatarioBusca || normalizeSearchValue(item.destinatarioNome),
  }))

  nextStore.movimentacoes = (nextStore.movimentacoes || []).map((item) => preencherEmpresaPadrao(item))

  return nextStore
}

function readStore() {
  if (typeof window === 'undefined') {
    return migrateStore(seedStore)
  }

  const raw = window.localStorage.getItem(storageKey)

  if (!raw) {
    const migratedSeed = migrateStore(seedStore)
    window.localStorage.setItem(storageKey, JSON.stringify(migratedSeed))
    return migratedSeed
  }

  try {
    const migrated = migrateStore(JSON.parse(raw))
    window.localStorage.setItem(storageKey, JSON.stringify(migrated))
    return migrated
  } catch {
    const migratedSeed = migrateStore(seedStore)
    window.localStorage.setItem(storageKey, JSON.stringify(migratedSeed))
    return migratedSeed
  }
}

function writeStore(nextStore) {
  if (typeof window === 'undefined') {
    return
  }

  const migratedStore = migrateStore(nextStore)
  window.localStorage.setItem(storageKey, JSON.stringify(migratedStore))
  for (const callback of listeners.values()) {
    callback(structuredClone(migratedStore))
  }
}

function notifyAuthListeners(user) {
  for (const callback of authListeners) {
    callback(user)
  }
}

function getLocalUser() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(authKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    const rootAccess = isRootSuperadminEmail(parsed?.email)

    return {
      ...parsed,
      email: normalizeEmail(parsed?.email),
      perfil: rootAccess ? 'superadmin' : parsed?.perfil || 'admin',
      empresaId: rootAccess ? '' : parsed?.empresaId || '',
      empresaNome: rootAccess ? SYSTEM_NAME : parsed?.empresaNome || '',
      rootSuperadmin: rootAccess,
    }
  } catch {
    return null
  }
}

function setLocalUser(user) {
  if (typeof window !== 'undefined') {
    if (user) {
      const rootAccess = isRootSuperadminEmail(user?.email)
      window.localStorage.setItem(authKey, JSON.stringify({
        ...user,
        email: normalizeEmail(user?.email),
        perfil: rootAccess ? 'superadmin' : user?.perfil || 'admin',
        empresaId: rootAccess ? '' : user?.empresaId || '',
        empresaNome: rootAccess ? SYSTEM_NAME : user?.empresaNome || '',
        rootSuperadmin: rootAccess,
      }))
    } else {
      window.localStorage.removeItem(authKey)
    }
  }

  notifyAuthListeners(user)
}

function mapDocs(snapshot) {
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
}

function isAdminSummaryCollection(collectionName) {
  return ['clientes', 'terminais'].includes(collectionName)
}

function shouldRestrictByEmpresa(collectionName) {
  return ['clientes', 'terminais', 'embarcacoes', 'rotasValores', 'encomendas', 'movimentacoes', 'caixa'].includes(collectionName)
}

function filterItemsByEmpresa(items, empresaId = '') {
  if (!empresaId) {
    return items
  }

  return items.filter((item) => String(item?.empresaId || '') === String(empresaId))
}

function enrichPayloadWithEmpresa(payload = {}) {
  if (payload.empresaId === undefined && payload.empresaNome === undefined) {
    return payload
  }

  return {
    ...payload,
    empresaId: payload.empresaId || '',
    empresaNome: payload.empresaNome || '',
  }
}

export async function registrarLogUso({ acao, detalhes = '', user = null, empresaId = '', empresaNome = '' }) {
  const timestamp = new Date().toISOString()
  const payload = {
    acao: String(acao || '').trim() || 'acao',
    detalhes: String(detalhes || '').trim(),
    criadoEm: timestamp,
    usuarioEmail: normalizeEmail(user?.email),
    usuarioNome: user?.nome || user?.displayName || '',
    perfil: user?.perfil || '',
    empresaId: empresaId || user?.empresaId || '',
    empresaNome: empresaNome || user?.empresaNome || '',
  }

  if (isConfigured && db) {
    await addDoc(collection(db, 'logsUso'), {
      ...payload,
      criadoEm: serverTimestamp(),
    })
    return payload
  }

  const store = readStore()
  store.logsUso = [
    {
      id: `log-${Date.now()}`,
      ...payload,
    },
    ...(store.logsUso || []),
  ].slice(0, 300)
  writeStore(store)
  return payload
}

async function getUserProfile(uid, email = '') {
  if (isConfigured && db) {
    if (uid) {
      const profileSnapshot = await getDoc(doc(db, 'usuarios', uid))
      if (profileSnapshot.exists()) {
        return { id: profileSnapshot.id, ...profileSnapshot.data() }
      }
    }

    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      return null
    }

    const profileByEmail = await getDocs(query(collection(db, 'usuarios'), where('email', '==', normalizedEmail), limit(1)))
    return mapDocs(profileByEmail)[0] || null
  }

  const store = readStore()
  return (
    (store.usuarios || []).find(
      (item) => item.uid === uid || String(item.email || '').toLowerCase() === String(email || '').toLowerCase(),
    ) || null
  )
}

async function buildSessionUser(authUser) {
  if (!authUser) {
    return null
  }

  const profile = await getUserProfile(authUser.uid, authUser.email)
  const normalizedEmail = normalizeEmail(authUser.email || profile?.email)
  const rootAccess = isRootSuperadminEmail(normalizedEmail)

  return {
    uid: authUser.uid,
    email: normalizedEmail,
    displayName: authUser.displayName || profile?.nome || '',
    nome: profile?.nome || authUser.displayName || '',
    perfil: rootAccess ? 'superadmin' : profile?.perfil || 'admin',
    ativo: profile?.ativo ?? true,
    empresaId: rootAccess ? '' : profile?.empresaId || '',
    empresaNome: rootAccess ? SYSTEM_NAME : profile?.empresaNome || '',
    rootSuperadmin: rootAccess,
  }
}

export const firebaseEnabled = isConfigured
export { app, auth, db }

export function onAuthChange(callback) {
  if (isConfigured && auth) {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        callback(null)
        return
      }

      const sessionUser = await buildSessionUser(nextUser)

      if (sessionUser && sessionUser.ativo === false) {
        await signOut(auth)
        callback(null)
        return
      }

      callback(sessionUser)
    })
  }

  authListeners.add(callback)
  callback(getLocalUser())

  return () => {
    authListeners.delete(callback)
  }
}

export async function entrar(email, senha) {
  if (isConfigured && auth) {
    const credential = await signInWithEmailAndPassword(auth, email, senha)
    const sessionUser = await buildSessionUser(credential.user)

    if (sessionUser && sessionUser.ativo === false) {
      await signOut(auth)
      throw new Error('Este usuário está inativo.')
    }

    await registrarLogUso({
      acao: 'login',
      detalhes: `Login realizado por ${sessionUser?.email || 'usuario'}.`,
      user: sessionUser,
    })
    return sessionUser
  }

  const store = readStore()
  const normalizedEmail = normalizeEmail(email)
  const account = (store.usuarios || []).find(
    (item) =>
      String(item.email || '').toLowerCase() === normalizedEmail &&
      String(item.senha || '') === String(senha || ''),
  )

  if (!account) {
    throw new Error('E-mail ou senha inválidos.')
  }

  if (account.ativo === false) {
    throw new Error('Este usuário está inativo.')
  }

  const user = {
    uid: account.uid || account.id,
    displayName: account.nome,
    email: normalizeEmail(account.email),
    nome: account.nome,
    perfil: isRootSuperadminEmail(account.email) ? 'superadmin' : account.perfil || 'admin',
    ativo: account.ativo ?? true,
    empresaId: isRootSuperadminEmail(account.email) ? '' : account.empresaId || '',
    empresaNome: isRootSuperadminEmail(account.email) ? SYSTEM_NAME : account.empresaNome || '',
    rootSuperadmin: isRootSuperadminEmail(account.email),
  }
  setLocalUser(user)
  await registrarLogUso({
    acao: 'login',
    detalhes: `Login realizado por ${user.email}.`,
    user,
  })
  return user
}

export async function sair() {
  if (isConfigured && auth) {
    await signOut(auth)
    return
  }

  setLocalUser(null)
}

export function subscribeCollection(collectionName, callback) {
  if (isConfigured && db) {
    return onSnapshot(collection(db, collectionName), (snapshot) => {
      callback(mapDocs(snapshot))
    })
  }

  const listenerId = `${collectionName}-${Date.now()}-${Math.random()}`
  const store = readStore()
  callback(structuredClone(store[collectionName] || []))
  listeners.set(listenerId, (nextStore) => {
    callback(structuredClone(nextStore[collectionName] || []))
  })

  return () => {
    listeners.delete(listenerId)
  }
}

export async function listCollectionOnce(collectionName, { empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    const constraints = []

    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      constraints.push(where('empresaId', '==', empresaId))
    }

    const snapshot = constraints.length
      ? await getDocs(query(collection(db, collectionName), ...constraints))
      : await getDocs(collection(db, collectionName))
    return filterItemsByEmpresa(mapDocs(snapshot), shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '')
  }

  return filterItemsByEmpresa(structuredClone(readStore()[collectionName] || []), shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '')
}

export async function listCollectionPage(
  collectionName,
  {
    orderField = 'criadoEm',
    orderDirection = 'desc',
    maxResults = 12,
    cursor = null,
    empresaId = '',
    empresaNome = '',
  } = {},
) {
  if (isConfigured && db) {
    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      const snapshot = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
      const sortedItems = [...mapDocs(snapshot)].sort((a, b) => {
        const left = String(a?.[orderField] || '')
        const right = String(b?.[orderField] || '')
        return orderDirection === 'asc' ? left.localeCompare(right) : right.localeCompare(left)
      })
      const startIndex = Number.isFinite(Number(cursor)) ? Number(cursor) : 0
      const items = sortedItems.slice(startIndex, startIndex + maxResults)
      const nextCursor = startIndex + items.length

      return {
        items,
        cursor: nextCursor < sortedItems.length ? nextCursor : null,
        hasMore: nextCursor < sortedItems.length,
      }
    }

    const constraints = [orderBy(orderField, orderDirection)]

    if (cursor) {
      constraints.push(startAfter(cursor))
    }

    constraints.push(limit(maxResults))

    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints))

    return {
    items: filterItemsByEmpresa(mapDocs(snapshot), shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : ''),
      cursor: snapshot.docs.at(-1) || null,
      hasMore: snapshot.docs.length === maxResults,
    }
  }

  const sortedItems = [...filterItemsByEmpresa(readStore()[collectionName] || [], shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '')].sort((a, b) => {
    const left = String(a?.[orderField] || '')
    const right = String(b?.[orderField] || '')
    return orderDirection === 'asc' ? left.localeCompare(right) : right.localeCompare(left)
  })
  const startIndex = Number.isFinite(Number(cursor)) ? Number(cursor) : 0
  const items = sortedItems.slice(startIndex, startIndex + maxResults)
  const nextCursor = startIndex + items.length

  return {
    items,
    cursor: nextCursor < sortedItems.length ? nextCursor : null,
    hasMore: nextCursor < sortedItems.length,
  }
}

export async function searchCollectionByField(collectionName, fieldName, searchTerm, maxResults = 6, { empresaId = '', empresaNome = '' } = {}) {
  const normalizedTerm = String(searchTerm || '').trim()

  if (!normalizedTerm) {
    return []
  }

  if (isConfigured && db) {
    const indexedField = getIndexedFieldName(collectionName, fieldName)
    const searchKey = indexedField === 'codigoBusca'
      ? normalizeSearchValue(normalizedTerm, { upper: true })
      : normalizeSearchValue(normalizedTerm)
    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      const snapshot = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
      return mapDocs(snapshot)
        .filter((item) => String(item[indexedField] || item[fieldName] || '').toLowerCase().includes(searchKey.toLowerCase()))
        .sort((a, b) => String(a[indexedField] || '').localeCompare(String(b[indexedField] || '')))
        .slice(0, maxResults)
    }

    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        orderBy(indexedField),
        startAt(searchKey),
        endAt(`${searchKey}\uf8ff`),
        limit(maxResults),
      ),
    )

    return mapDocs(snapshot)
  }

  const store = readStore()
  return filterItemsByEmpresa(store[collectionName] || [], shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '')
    .filter((item) =>
      String(item[getIndexedFieldName(collectionName, fieldName)] || item[fieldName] || '')
        .toLowerCase()
        .includes(normalizedTerm.toLowerCase()),
    )
    .slice(0, maxResults)
}

export async function addCollectionDocument(collectionName, payload) {
  const preparedPayload = prepareCollectionPayload(collectionName, enrichPayloadWithEmpresa(payload))

  if (isConfigured && db) {
    const docRef = await addDoc(collection(db, collectionName), preparedPayload)

    return { id: docRef.id, ...preparedPayload }
  }

  const store = readStore()
  const doc = {
    id: `${collectionName}-${Date.now()}`,
    ...preparedPayload,
  }
  store[collectionName] = [...(store[collectionName] || []), doc]

  if (isAdminSummaryCollection(collectionName)) {
    const resumoAdmin = garantirResumoAdminLocal(store)

    if (collectionName === 'clientes') {
      resumoAdmin.totalClientes += 1
    }

    if (collectionName === 'terminais') {
      resumoAdmin.totalTerminais += 1
    }
  }

  writeStore(store)
  return doc
}

export async function updateCollectionDocument(collectionName, documentId, updates) {
  const preparedUpdates = prepareCollectionPayload(collectionName, enrichPayloadWithEmpresa(updates))

  if (isConfigured && db) {
    await updateDoc(doc(db, collectionName, documentId), preparedUpdates)
    return { id: documentId, ...preparedUpdates }
  }

  const store = readStore()
  store[collectionName] = (store[collectionName] || []).map((item) =>
    item.id === documentId ? { ...item, ...preparedUpdates } : item,
  )
  writeStore(store)
  return { id: documentId, ...preparedUpdates }
}

export async function deleteCollectionDocument(collectionName, documentId) {
  if (isConfigured && db) {
    if (collectionName === 'caixa') {
      const caixaRef = doc(db, collectionName, documentId)
      const snapshot = await getDoc(caixaRef)
      const item = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null

      await deleteDoc(caixaRef)

      if (item) {
        await ajustarResumoCaixa({
          deltaEntrada: item.tipo === 'entrada' ? -Number(item.valor || 0) : 0,
          deltaRegistros: -1,
        })
      }

      return true
    }

    await deleteDoc(doc(db, collectionName, documentId))

    return true
  }

  const store = readStore()
  let itemRemovido = null

  if (collectionName === 'caixa') {
    itemRemovido = (store[collectionName] || []).find((item) => item.id === documentId) || null
  }

  store[collectionName] = (store[collectionName] || []).filter((item) => item.id !== documentId)

  if (collectionName === 'caixa' && itemRemovido) {
    const resumoAtual = garantirResumoCaixaLocal(store)
    resumoAtual.totalEntrada = Math.max(
      0,
      Number(resumoAtual.totalEntrada || 0) - (itemRemovido.tipo === 'entrada' ? Number(itemRemovido.valor || 0) : 0),
    )
    resumoAtual.totalRegistros = Math.max(0, Number(resumoAtual.totalRegistros || 0) - 1)
  }

  if (isAdminSummaryCollection(collectionName)) {
    const resumoAdmin = garantirResumoAdminLocal(store)

    if (collectionName === 'clientes') {
      resumoAdmin.totalClientes = Math.max(0, Number(resumoAdmin.totalClientes || 0) - 1)
    }

    if (collectionName === 'terminais') {
      resumoAdmin.totalTerminais = Math.max(0, Number(resumoAdmin.totalTerminais || 0) - 1)
    }
  }

  writeStore(store)
  return true
}

export async function searchByCodigo(codigo, { empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (empresaId) {
      const snapshot = await getDocs(query(collection(db, 'encomendas'), where('empresaId', '==', empresaId)))
      const found = mapDocs(snapshot).find((item) => item.codigoBusca === normalizeSearchValue(codigo, { upper: true })) || null
      return found
    }

    const snapshot = await getDocs(
      query(collection(db, 'encomendas'), where('codigoBusca', '==', normalizeSearchValue(codigo, { upper: true })), limit(1)),
    )
    const found = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))[0] || null
    return filterItemsByEmpresa(found ? [found] : [], empresaId, empresaNome)[0] || null
  }

  const store = readStore()
  return filterItemsByEmpresa(store.encomendas.filter((item) => item.codigo === codigo), empresaId, empresaNome)[0] || null
}

export async function searchEncomendas(searchTerm, maxResults = 20, { empresaId = '', empresaNome = '' } = {}) {
  const normalizedTerm = String(searchTerm || '').trim()

  if (!normalizedTerm) {
    return []
  }

  if (isConfigured && db) {
    if (empresaId) {
      const snapshot = await getDocs(query(collection(db, 'encomendas'), where('empresaId', '==', empresaId)))
      const searchLower = normalizedTerm.toLowerCase()
      return mapDocs(snapshot)
        .filter((item) =>
          String(item.codigo || '').toLowerCase().includes(searchLower) ||
          String(item.destinatarioNome || '').toLowerCase().includes(searchLower) ||
          String(item.remetenteNome || '').toLowerCase().includes(searchLower),
        )
        .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
        .slice(0, maxResults)
    }

    const codigoTerm = normalizeSearchValue(normalizedTerm, { upper: true })
    const results = []
    const seenIds = new Set()
    const codigoConstraints = []

    if (empresaId) {
      codigoConstraints.push(where('empresaId', '==', empresaId))
    }

    codigoConstraints.push(orderBy('codigoBusca'))
    codigoConstraints.push(startAt(codigoTerm))
    codigoConstraints.push(endAt(`${codigoTerm}\uf8ff`))
    codigoConstraints.push(limit(maxResults))

    const codigoSnapshot = await getDocs(
      query(collection(db, 'encomendas'), ...codigoConstraints),
    )

    for (const item of mapDocs(codigoSnapshot)) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id)
        results.push(item)
      }
    }

    if (results.length < maxResults) {
      try {
        const nomeTerm = normalizedTerm.toLowerCase()
        const destinatarioConstraints = []

        if (empresaId) {
          destinatarioConstraints.push(where('empresaId', '==', empresaId))
        }

        destinatarioConstraints.push(orderBy('destinatarioBusca'))
        destinatarioConstraints.push(startAt(nomeTerm))
        destinatarioConstraints.push(endAt(`${nomeTerm}\uf8ff`))
        destinatarioConstraints.push(limit(maxResults))

        const destinatarioSnapshot = await getDocs(
          query(collection(db, 'encomendas'), ...destinatarioConstraints),
        )

        for (const item of mapDocs(destinatarioSnapshot)) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id)
            results.push(item)
          }

          if (results.length >= maxResults) {
            break
          }
        }
      } catch {
        // Mantem a busca primaria por codigo quando a busca auxiliar ainda nao estiver pronta.
      }
    }

    return filterItemsByEmpresa(results, empresaId, empresaNome).slice(0, maxResults)
  }

  const searchLower = normalizedTerm.toLowerCase()
  return filterItemsByEmpresa(readStore().encomendas || [], empresaId, empresaNome)
    .filter((item) =>
      String(item.codigo || '').toLowerCase().includes(searchLower) ||
      String(item.destinatarioNome || '').toLowerCase().includes(searchLower) ||
      String(item.remetenteNome || '').toLowerCase().includes(searchLower),
    )
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
    .slice(0, maxResults)
}

export async function getMovimentacoesPorCodigo(codigo, { empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (empresaId) {
      const snapshot = await getDocs(query(collection(db, 'movimentacoes'), where('empresaId', '==', empresaId)))
      return mapDocs(snapshot)
        .filter((item) => item.encomendaCodigo === codigo)
        .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')))
    }

    const snapshot = await getDocs(
      query(
        collection(db, 'movimentacoes'),
        where('encomendaCodigo', '==', codigo),
        orderBy('criadoEm', 'asc'),
      ),
    )
    return mapDocs(snapshot)
  }

  const store = readStore()
  return filterItemsByEmpresa(store.movimentacoes.filter((item) => item.encomendaCodigo === codigo), empresaId, empresaNome)
}

export async function listCaixaEntries({ dataInicial = '', dataFinal = '', maxResults = 200, empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (empresaId) {
      const snapshot = await getDocs(query(collection(db, 'caixa'), where('empresaId', '==', empresaId)))
      return mapDocs(snapshot)
        .filter((item) => {
          const data = item?.criadoEm ? new Date(item.criadoEm) : null

          if (!data || Number.isNaN(data.getTime())) {
            return false
          }

          if (dataInicial && data < new Date(`${dataInicial}T00:00:00`)) {
            return false
          }

          if (dataFinal && data > new Date(`${dataFinal}T23:59:59.999`)) {
            return false
          }

          return true
        })
        .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
        .slice(0, maxResults)
    }

    const constraints = [orderBy('criadoEm', 'asc')]

    if (dataInicial) {
      constraints.push(startAt(new Date(`${dataInicial}T00:00:00`)))
    }

    if (dataFinal) {
      constraints.push(endAt(new Date(`${dataFinal}T23:59:59.999`)))
    }

    constraints.push(limit(maxResults))

    const snapshot = await getDocs(query(collection(db, 'caixa'), ...constraints))
    return mapDocs(snapshot).reverse()
  }

  return [...filterItemsByEmpresa(readStore().caixa || [], empresaId, empresaNome)]
    .filter((item) => {
      const data = item?.criadoEm ? new Date(item.criadoEm) : null

      if (!data || Number.isNaN(data.getTime())) {
        return false
      }

      if (dataInicial && data < new Date(`${dataInicial}T00:00:00`)) {
        return false
      }

      if (dataFinal && data > new Date(`${dataFinal}T23:59:59.999`)) {
        return false
      }

      return true
    })
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
    .slice(0, maxResults)
}

export async function gerarCodigoEncomenda() {
  const ano = new Date().getFullYear()
  const prefixo = `FRT-${ano}-`

  if (isConfigured && db) {
    const snapshot = await getDocs(
      query(
        collection(db, 'encomendas'),
        where('codigoBusca', '>=', prefixo),
        where('codigoBusca', '<', `${prefixo}\uf8ff`),
        orderBy('codigoBusca', 'desc'),
        limit(1),
      ),
    )
    const ultimoCodigo = snapshot.docs[0]?.data()?.codigo
    const ultimoNumero = ultimoCodigo ? Number(ultimoCodigo.split('-').pop()) : 0
    return `${prefixo}${String(ultimoNumero + 1).padStart(6, '0')}`
  }

  const store = readStore()
  const ultimo = [...(store.encomendas || [])]
    .map((item) => item.codigo)
    .filter((codigo) => codigo.startsWith(prefixo))
    .sort()
    .at(-1)
  const ultimoNumero = ultimo ? Number(ultimo.split('-').pop()) : 0
  return `${prefixo}${String(ultimoNumero + 1).padStart(6, '0')}`
}

export async function criarEncomenda(dados) {
  const codigo = dados.codigo || (await gerarCodigoEncomenda())
  const agora = new Date().toISOString()
  const valorTotal = Number(dados.valorFrete || 0) + Number(dados.taxa || 0)
  const encomendaBase = {
    codigo,
    codigoBusca: String(codigo || '').trim().toUpperCase(),
    dataComanda: dados.dataComanda || '',
    horarioChegada: dados.horarioChegada || '',
    horarioSaidaEmbarcacao: dados.horarioSaidaEmbarcacao || '',
    previsaoChegada: dados.previsaoChegada || '',
    rotaId: dados.rotaId || '',
    linhaNome: dados.linhaNome || '',
    embarcacaoId: dados.embarcacaoId || '',
    embarcacaoNome: dados.embarcacaoNome || '',
    remetenteId: dados.remetenteId || '',
    remetenteNome: obterRemetenteNome(dados.remetenteNome),
    remetenteBusca: String(obterRemetenteNome(dados.remetenteNome) || '').trim().toLowerCase(),
    remetenteTelefone: dados.remetenteTelefone || '',
    remetenteEmail: dados.remetenteEmail || '',
    operadorNome: dados.operadorNome || '',
    operadorEmail: dados.operadorEmail || '',
    destinatarioId: dados.destinatarioId || '',
    destinatarioNome: dados.destinatarioNome || '',
    destinatarioBusca: String(dados.destinatarioNome || '').trim().toLowerCase(),
    destinatarioTelefone: dados.destinatarioTelefone || '',
    destinatarioEmail: dados.destinatarioEmail || '',
    terminalOrigem: dados.terminalOrigem || '',
    terminalDestino: dados.terminalDestino || '',
    freteCobranca: dados.freteCobranca || 'A receber',
    possuiNotaFiscal: Boolean(dados.possuiNotaFiscal),
    valorDeclarado: Number(dados.valorDeclarado || 0),
    tipoMercadoria: dados.tipoMercadoria || '',
    descricao: dados.descricao || '',
    quantidade: Number(dados.quantidade || 0),
    peso: Number(dados.peso || 0),
    valorFrete: Number(dados.valorFrete || 0),
    taxa: Number(dados.taxa || 0),
    valorTotal,
    formaPagamento: dados.formaPagamento || 'Não informado',
    qrCodeDataUrl: dados.qrCodeDataUrl || '',
    rastreioUrl: dados.rastreioUrl || '',
    empresaId: dados.empresaId || '',
    empresaNome: dados.empresaNome || '',
    status: 'Postado',
    criadoEm: agora,
    atualizadoEm: agora,
  }

  if (isConfigured && db) {
    const encomendaRef = await addDoc(collection(db, 'encomendas'), {
      ...encomendaBase,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })

    await addDoc(collection(db, 'movimentacoes'), {
      encomendaCodigo: codigo,
      status: 'Postado',
      descricao: 'Encomenda registrada no sistema',
      empresaId: encomendaBase.empresaId,
      empresaNome: encomendaBase.empresaNome,
      criadoEm: serverTimestamp(),
    })

    await addDoc(collection(db, 'caixa'), {
      tipo: 'entrada',
      origem: 'Frete postado',
      encomendaCodigo: codigo,
      valor: valorTotal,
      formaPagamento: encomendaBase.formaPagamento,
      empresaId: encomendaBase.empresaId,
      empresaNome: encomendaBase.empresaNome,
      criadoEm: serverTimestamp(),
    })

    await ajustarResumoCaixa({
      deltaEntrada: valorTotal,
      deltaRegistros: 1,
    })
    return { id: encomendaRef.id, ...encomendaBase }
  }

  const store = readStore()
  const encomenda = {
    id: `encomenda-${Date.now()}`,
    ...encomendaBase,
  }
  const movimentacao = {
    id: `mov-${Date.now()}`,
    encomendaCodigo: codigo,
    status: 'Postado',
    descricao: 'Encomenda registrada no sistema',
    empresaId: encomendaBase.empresaId,
    empresaNome: encomendaBase.empresaNome,
    criadoEm: agora,
  }
  const entradaCaixa = {
    id: `caixa-${Date.now()}`,
    tipo: 'entrada',
    origem: 'Frete postado',
    encomendaCodigo: codigo,
    valor: valorTotal,
    formaPagamento: encomendaBase.formaPagamento,
    empresaId: encomendaBase.empresaId,
    empresaNome: encomendaBase.empresaNome,
    criadoEm: agora,
  }

  store.encomendas = [...(store.encomendas || []), encomenda]
  store.movimentacoes = [...(store.movimentacoes || []), movimentacao]
  store.caixa = [...(store.caixa || []), entradaCaixa]
  const resumoAtual = garantirResumoCaixaLocal(store)
  resumoAtual.totalEntrada = Number(resumoAtual.totalEntrada || 0) + valorTotal
  resumoAtual.totalRegistros = Number(resumoAtual.totalRegistros || 0) + 1
  const resumoAdmin = garantirResumoAdminLocal(store)
  resumoAdmin.totalEncomendas = Number(resumoAdmin.totalEncomendas || 0) + 1
  writeStore(store)
  return encomenda
}

export async function getCollectionCount(collectionName, { empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      const snapshot = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
      return mapDocs(snapshot).length
    }

    const snapshot = await getCountFromServer(collection(db, collectionName))
    return snapshot.data().count || 0
  }

  return filterItemsByEmpresa(readStore()[collectionName] || [], shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '').length
}

export async function listRecentDocuments(collectionName, fieldName = 'criadoEm', maxResults = 5, { empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      const snapshot = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
      return mapDocs(snapshot)
        .sort((a, b) => String(b[fieldName] || '').localeCompare(String(a[fieldName] || '')))
        .slice(0, maxResults)
    }

    const snapshot = await getDocs(
      query(collection(db, collectionName), orderBy(fieldName, 'desc'), limit(maxResults)),
    )
    return mapDocs(snapshot)
  }

  return [...filterItemsByEmpresa(readStore()[collectionName] || [], shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '')]
    .sort((a, b) => String(b[fieldName] || '').localeCompare(String(a[fieldName] || '')))
    .slice(0, maxResults)
}

export async function getTotalByField(collectionName, filterField, filterValue, sumField) {
  if (isConfigured && db) {
    const snapshot = await getDocs(
      query(collection(db, collectionName), where(filterField, '==', filterValue)),
    )

    return mapDocs(snapshot).reduce((sum, item) => sum + Number(item[sumField] || 0), 0)
  }

  return (readStore()[collectionName] || [])
    .filter((item) => item[filterField] === filterValue)
    .reduce((sum, item) => sum + Number(item[sumField] || 0), 0)
}

function garantirResumoCaixaLocal(store) {
  if (!store.resumos || typeof store.resumos !== 'object') {
    store.resumos = {}
  }

  if (!store.resumos.caixa || typeof store.resumos.caixa !== 'object') {
    const caixa = store.caixa || []
    store.resumos.caixa = {
      id: 'caixa',
      totalEntrada: caixa
        .filter((item) => item.tipo === 'entrada')
        .reduce((sum, item) => sum + Number(item.valor || 0), 0),
      totalRegistros: caixa.length,
    }
  }

  return store.resumos.caixa
}

function garantirResumoAdminLocal(store) {
  if (!store.resumos || typeof store.resumos !== 'object') {
    store.resumos = {}
  }

  if (!store.resumos.admin || typeof store.resumos.admin !== 'object') {
    store.resumos.admin = {
      id: 'admin',
      totalEncomendas: (store.encomendas || []).length,
      totalClientes: (store.clientes || []).length,
      totalTerminais: (store.terminais || []).length,
    }
  }

  return store.resumos.admin
}

async function ajustarResumoCaixa({ deltaEntrada = 0, deltaRegistros = 0 }) {
  if (isConfigured && db) {
    await setDoc(
      doc(db, 'resumos', 'caixa'),
      {
        totalEntrada: increment(deltaEntrada),
        totalRegistros: increment(deltaRegistros),
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    )
    return
  }

  const store = readStore()
  const resumo = garantirResumoCaixaLocal(store)
  resumo.totalEntrada = Math.max(0, Number(resumo.totalEntrada || 0) + Number(deltaEntrada || 0))
  resumo.totalRegistros = Math.max(0, Number(resumo.totalRegistros || 0) + Number(deltaRegistros || 0))
  writeStore(store)
}

export async function getAdminResumo({ empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    const [encomendasCount, clientesCount, terminaisCount] = await Promise.all([
      getCollectionCount('encomendas', { empresaId, empresaNome }),
      getCollectionCount('clientes', { empresaId, empresaNome }),
      getCollectionCount('terminais', { empresaId, empresaNome }),
    ])

    return {
      totalEncomendas: encomendasCount,
      totalClientes: clientesCount,
      totalTerminais: terminaisCount,
    }
  }

  const store = readStore()
  if (empresaId) {
    return {
      totalEncomendas: filterItemsByEmpresa(store.encomendas || [], empresaId).length,
      totalClientes: filterItemsByEmpresa(store.clientes || [], empresaId).length,
      totalTerminais: filterItemsByEmpresa(store.terminais || [], empresaId).length,
    }
  }

  const resumo = garantirResumoAdminLocal(store)
  writeStore(store)
  return {
    totalEncomendas: Number(resumo.totalEncomendas || 0),
    totalClientes: Number(resumo.totalClientes || 0),
    totalTerminais: Number(resumo.totalTerminais || 0),
  }
}

export async function getCaixaResumo({ empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (empresaId || empresaNome) {
      const snapshot = await getDocs(collection(db, 'caixa'))
      const itens = filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome)
      return {
        totalEntrada: itens
          .filter((item) => item.tipo === 'entrada')
          .reduce((sum, item) => sum + Number(item.valor || 0), 0),
        totalRegistros: itens.length,
      }
    }

    const resumoRef = doc(db, 'resumos', 'caixa')
    const resumoSnapshot = await getDoc(resumoRef)

    if (resumoSnapshot.exists()) {
      return {
        totalEntrada: Number(resumoSnapshot.data()?.totalEntrada || 0),
        totalRegistros: Number(resumoSnapshot.data()?.totalRegistros || 0),
      }
    }

    const snapshot = await getDocs(collection(db, 'caixa'))
    const itens = mapDocs(snapshot)
    const resumo = {
      totalEntrada: itens
        .filter((item) => item.tipo === 'entrada')
        .reduce((sum, item) => sum + Number(item.valor || 0), 0),
      totalRegistros: itens.length,
    }

    await setDoc(
      resumoRef,
      {
        ...resumo,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    )

    return resumo
  }

  const store = readStore()
  if (empresaId || empresaNome) {
    const itens = filterItemsByEmpresa(store.caixa || [], empresaId, empresaNome)
    return {
      totalEntrada: itens
        .filter((item) => item.tipo === 'entrada')
        .reduce((sum, item) => sum + Number(item.valor || 0), 0),
      totalRegistros: itens.length,
    }
  }

  const resumo = garantirResumoCaixaLocal(store)
  writeStore(store)
  return {
    totalEntrada: Number(resumo.totalEntrada || 0),
    totalRegistros: Number(resumo.totalRegistros || 0),
  }
}

export async function criarUsuario({ nome, email, senha, perfil = 'operador', ativo = true, empresaId = '', empresaNome = '', actorUser = null }) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedNome = String(nome || '').trim()
  const normalizedSenha = String(senha || '')
  const normalizedPerfil = String(perfil || 'operador').trim().toLowerCase()
  const actorIsRoot = isRootSuperadminEmail(actorUser?.email)

  if (!normalizedNome || !normalizedEmail || !normalizedSenha) {
    throw new Error('Preencha nome, e-mail e senha.')
  }

  if (normalizedPerfil !== 'operador' && !actorIsRoot) {
    throw new Error('Somente o superadmin principal pode criar usuarios admin.')
  }

  if (normalizedPerfil === 'superadmin' && !isRootSuperadminEmail(normalizedEmail)) {
    throw new Error('O acesso superadmin principal e reservado ao e-mail adm@acs.com.')
  }

  if (isConfigured && auth && db) {
    const existingProfile = await getUserProfile('', normalizedEmail)
    if (existingProfile) {
      throw new Error('Já existe um usuário com este e-mail.')
    }

    const secondaryApp = initializeApp(firebaseConfig, `user-creator-${Date.now()}`)
    const secondaryAuth = getAuth(secondaryApp)

    try {
      await setPersistence(secondaryAuth, inMemoryPersistence)
      const credential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, normalizedSenha)
      await updateProfile(credential.user, { displayName: normalizedNome })

      const profile = {
        uid: credential.user.uid,
        nome: normalizedNome,
        nomeBusca: normalizeSearchValue(normalizedNome),
        email: normalizedEmail,
        emailBusca: normalizeSearchValue(normalizedEmail),
        perfil: normalizedPerfil,
        ativo: Boolean(ativo),
        empresaId: normalizedPerfil === 'operador' ? empresaId || '' : '',
        empresaNome: normalizedPerfil === 'operador' ? empresaNome || '' : SYSTEM_NAME,
        criadoEm: new Date().toISOString(),
      }

      await setDoc(doc(db, 'usuarios', credential.user.uid), profile)
      await signOut(secondaryAuth)
      await registrarLogUso({
        acao: 'usuario_criado',
        detalhes: `${normalizedNome} (${normalizedEmail}) com perfil ${normalizedPerfil}.`,
        user: actorUser,
        empresaId: profile.empresaId,
        empresaNome: profile.empresaNome,
      })
      return { id: credential.user.uid, ...profile }
    } catch (error) {
      if (error?.code === 'auth/email-already-in-use') {
        throw new Error('Ja existe um login no Firebase com este e-mail.', { cause: error })
      }

      if (error?.code === 'auth/weak-password') {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.', { cause: error })
      }

      throw error
    } finally {
      await deleteApp(secondaryApp)
    }
  }

  const store = readStore()
  const existingProfile = (store.usuarios || []).find(
    (item) => String(item.email || '').toLowerCase() === normalizedEmail,
  )

  if (existingProfile) {
    throw new Error('Já existe um usuário com este e-mail.')
  }

  const localUserId = `usuario-${Date.now()}`
  const createdUser = {
    id: localUserId,
    uid: localUserId,
    nome: normalizedNome,
    nomeBusca: normalizeSearchValue(normalizedNome),
    email: normalizedEmail,
    emailBusca: normalizeSearchValue(normalizedEmail),
    senha: normalizedSenha,
    perfil: normalizedPerfil,
    ativo: Boolean(ativo),
    empresaId: normalizedPerfil === 'operador' ? empresaId || '' : '',
    empresaNome: normalizedPerfil === 'operador' ? empresaNome || '' : SYSTEM_NAME,
    criadoEm: new Date().toISOString(),
  }

  store.usuarios = [...(store.usuarios || []), createdUser]
  writeStore(store)
  await registrarLogUso({
    acao: 'usuario_criado',
    detalhes: `${normalizedNome} (${normalizedEmail}) com perfil ${normalizedPerfil}.`,
    user: actorUser,
    empresaId: createdUser.empresaId,
    empresaNome: createdUser.empresaNome,
  })

  return createdUser
}

export async function atualizarUsuario(documentId, updates, actorUser = null) {
  const normalizedNome = String(updates?.nome || '').trim()
  const normalizedPerfil = String(updates?.perfil || 'operador').trim().toLowerCase()
  const normalizedEmpresaId = normalizedPerfil === 'operador' ? String(updates?.empresaId || '') : ''
  const normalizedEmpresaNome = normalizedPerfil === 'operador' ? String(updates?.empresaNome || '') : SYSTEM_NAME
  const actorIsRoot = isRootSuperadminEmail(actorUser?.email)

  if (!normalizedNome) {
    throw new Error('Informe o nome do usuario.')
  }

  if (normalizedPerfil !== 'operador' && !actorIsRoot) {
    throw new Error('Somente o superadmin principal pode manter usuarios como admin.')
  }

  const payload = {
    nome: normalizedNome,
    nomeBusca: normalizeSearchValue(normalizedNome),
    perfil: normalizedPerfil,
    ativo: Boolean(updates?.ativo),
    empresaId: normalizedEmpresaId,
    empresaNome: normalizedEmpresaNome,
  }

  if (isConfigured && db) {
    const userRef = doc(db, 'usuarios', documentId)
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      throw new Error('Usuario nao encontrado.')
    }

    const currentUser = { id: snapshot.id, ...snapshot.data() }

    if (isRootSuperadminEmail(currentUser.email)) {
      throw new Error('O superadmin principal nao pode ser alterado por esta tela.')
    }

    await updateDoc(userRef, payload)
    await registrarLogUso({
      acao: 'usuario_editado',
      detalhes: `${currentUser.nome || currentUser.email} atualizado para perfil ${normalizedPerfil}.`,
      user: actorUser,
      empresaId: payload.empresaId,
      empresaNome: payload.empresaNome,
    })
    return { id: documentId, ...currentUser, ...payload }
  }

  const store = readStore()
  const currentUser = (store.usuarios || []).find((item) => item.id === documentId) || null

  if (!currentUser) {
    throw new Error('Usuario nao encontrado.')
  }

  if (isRootSuperadminEmail(currentUser.email)) {
    throw new Error('O superadmin principal nao pode ser alterado por esta tela.')
  }

  store.usuarios = (store.usuarios || []).map((item) =>
    item.id === documentId
      ? {
          ...item,
          ...payload,
        }
      : item,
  )
  writeStore(store)
  await registrarLogUso({
    acao: 'usuario_editado',
    detalhes: `${currentUser.nome || currentUser.email} atualizado para perfil ${normalizedPerfil}.`,
    user: actorUser,
    empresaId: payload.empresaId,
    empresaNome: payload.empresaNome,
  })
  return { ...currentUser, ...payload, id: documentId }
}

export async function atualizarStatusEncomenda(encomenda, novoStatus, descricao = '', extraUpdates = {}) {
  const statusAtualizado = String(novoStatus || '').trim() || 'Postado'
  const observacao = descricao.trim()
  const timestamp = new Date().toISOString()

  if (isConfigured && db) {
    await updateDoc(doc(db, 'encomendas', encomenda.id), {
      status: statusAtualizado,
      ...extraUpdates,
      atualizadoEm: serverTimestamp(),
    })

    await addDoc(collection(db, 'movimentacoes'), {
      encomendaCodigo: encomenda.codigo,
      status: statusAtualizado,
      descricao: observacao || `Status alterado para ${statusAtualizado}`,
      empresaId: encomenda.empresaId || '',
      empresaNome: encomenda.empresaNome || '',
      criadoEm: serverTimestamp(),
    })

    return true
  }

  const store = readStore()
  store.encomendas = (store.encomendas || []).map((item) =>
    item.id === encomenda.id
      ? {
          ...item,
          status: statusAtualizado,
          ...extraUpdates,
          atualizadoEm: timestamp,
        }
      : item,
  )

  store.movimentacoes = [
    ...(store.movimentacoes || []),
      {
        id: `mov-${Date.now()}`,
        encomendaCodigo: encomenda.codigo,
        status: statusAtualizado,
        descricao: observacao || `Status alterado para ${statusAtualizado}`,
        empresaId: encomenda.empresaId || '',
        empresaNome: encomenda.empresaNome || '',
        criadoEm: timestamp,
      },
  ]
  writeStore(store)
  return true
}
