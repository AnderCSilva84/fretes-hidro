import { deleteApp, initializeApp, getApp, getApps } from 'firebase/app'
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDocs,
  getFirestore,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAt,
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
  usuarios: [
    {
      id: 'superadmin-demo',
      uid: 'superadmin-demo',
      nome: 'Superadmin Demo',
      email: 'superadmin@fretes.local',
      perfil: 'superadmin',
      senha: '123456',
      ativo: true,
    },
    {
      id: 'admin-demo',
      uid: 'admin-demo',
      nome: 'Admin Fretes',
      email: 'admin@fretes.local',
      perfil: 'admin',
      senha: '123456',
      ativo: true,
    },
  ],
  clientes: [
    {
      id: 'c1',
      nome: 'Joana Ribeiro',
      telefone: '(91) 98888-1000',
      email: 'joana@fretes.local',
      documento: '123.456.789-00',
      cidade: 'Belém',
    },
    {
      id: 'c2',
      nome: 'Mercado do Porto LTDA',
      telefone: '(91) 98888-2000',
      email: 'recebimento@mercado.local',
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

function readStore() {
  if (typeof window === 'undefined') {
    return structuredClone(seedStore)
  }

  const raw = window.localStorage.getItem(storageKey)

  if (!raw) {
    window.localStorage.setItem(storageKey, JSON.stringify(seedStore))
    return structuredClone(seedStore)
  }

  try {
    return JSON.parse(raw)
  } catch {
    window.localStorage.setItem(storageKey, JSON.stringify(seedStore))
    return structuredClone(seedStore)
  }
}

function writeStore(nextStore) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nextStore))
  for (const callback of listeners.values()) {
    callback(structuredClone(nextStore))
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
  return raw ? JSON.parse(raw) : null
}

function setLocalUser(user) {
  if (typeof window !== 'undefined') {
    if (user) {
      window.localStorage.setItem(authKey, JSON.stringify(user))
    } else {
      window.localStorage.removeItem(authKey)
    }
  }

  notifyAuthListeners(user)
}

function mapDocs(snapshot) {
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
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

  return {
    uid: authUser.uid,
    email: authUser.email || profile?.email || '',
    displayName: authUser.displayName || profile?.nome || '',
    nome: profile?.nome || authUser.displayName || '',
    perfil: profile?.perfil || 'admin',
    ativo: profile?.ativo ?? true,
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

    return sessionUser
  }

  const store = readStore()
  const normalizedEmail = String(email || '').trim().toLowerCase()
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
    email: account.email,
    nome: account.nome,
    perfil: account.perfil || 'admin',
    ativo: account.ativo ?? true,
  }
  setLocalUser(user)
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

export async function listCollectionOnce(collectionName) {
  if (isConfigured && db) {
    const snapshot = await getDocs(collection(db, collectionName))
    return mapDocs(snapshot)
  }

  return structuredClone(readStore()[collectionName] || [])
}

export async function searchCollectionByField(collectionName, fieldName, searchTerm, maxResults = 6) {
  const normalizedTerm = String(searchTerm || '').trim()

  if (!normalizedTerm) {
    return []
  }

  if (isConfigured && db) {
    const searchKey = normalizedTerm.toLowerCase()
    const indexedField = collectionName === 'clientes' && fieldName === 'nome' ? 'nomeBusca' : fieldName
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
  return (store[collectionName] || [])
    .filter((item) =>
      String(item[fieldName] || item.nomeBusca || '').toLowerCase().includes(normalizedTerm.toLowerCase()),
    )
    .slice(0, maxResults)
}

export async function addCollectionDocument(collectionName, payload) {
  const preparedPayload =
    collectionName === 'clientes'
      ? {
          ...payload,
          nomeBusca: String(payload.nome || '').trim().toLowerCase(),
        }
      : payload

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
  writeStore(store)
  return doc
}

export async function updateCollectionDocument(collectionName, documentId, updates) {
  const preparedUpdates =
    collectionName === 'clientes'
      ? {
          ...updates,
          nomeBusca: String(updates.nome || '').trim().toLowerCase(),
        }
      : updates

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
    await deleteDoc(doc(db, collectionName, documentId))
    return true
  }

  const store = readStore()
  store[collectionName] = (store[collectionName] || []).filter((item) => item.id !== documentId)
  writeStore(store)
  return true
}

export async function searchByCodigo(codigo) {
  if (isConfigured && db) {
    const snapshot = await getDocs(
      query(collection(db, 'encomendas'), where('codigo', '==', codigo), limit(1)),
    )
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))[0] || null
  }

  const store = readStore()
  return store.encomendas.find((item) => item.codigo === codigo) || null
}

export async function getMovimentacoesPorCodigo(codigo) {
  if (isConfigured && db) {
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
  return store.movimentacoes.filter((item) => item.encomendaCodigo === codigo)
}

export async function gerarCodigoEncomenda() {
  const ano = new Date().getFullYear()
  const prefixo = `FRT-${ano}-`

  if (isConfigured && db) {
    const snapshot = await getDocs(
      query(
        collection(db, 'encomendas'),
        where('codigo', '>=', prefixo),
        where('codigo', '<', `${prefixo}\uf8ff`),
        orderBy('codigo', 'desc'),
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
    dataComanda: dados.dataComanda || '',
    horarioChegada: dados.horarioChegada || '',
    remetenteId: dados.remetenteId || '',
    remetenteNome: dados.remetenteNome || '',
    remetenteTelefone: dados.remetenteTelefone || '',
    remetenteEmail: dados.remetenteEmail || '',
    operadorNome: dados.operadorNome || '',
    operadorEmail: dados.operadorEmail || '',
    destinatarioId: dados.destinatarioId || '',
    destinatarioNome: dados.destinatarioNome || '',
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
      criadoEm: serverTimestamp(),
    })

    await addDoc(collection(db, 'caixa'), {
      tipo: 'entrada',
      origem: 'Frete postado',
      encomendaCodigo: codigo,
      valor: valorTotal,
      formaPagamento: encomendaBase.formaPagamento,
      criadoEm: serverTimestamp(),
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
    criadoEm: agora,
  }
  const entradaCaixa = {
    id: `caixa-${Date.now()}`,
    tipo: 'entrada',
    origem: 'Frete postado',
    encomendaCodigo: codigo,
    valor: valorTotal,
    formaPagamento: encomendaBase.formaPagamento,
    criadoEm: agora,
  }

  store.encomendas = [...(store.encomendas || []), encomenda]
  store.movimentacoes = [...(store.movimentacoes || []), movimentacao]
  store.caixa = [...(store.caixa || []), entradaCaixa]
  writeStore(store)
  return encomenda
}

export async function criarUsuario({ nome, email, senha, perfil = 'operador', ativo = true }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedNome = String(nome || '').trim()
  const normalizedSenha = String(senha || '')
  const normalizedPerfil = String(perfil || 'operador').trim().toLowerCase()

  if (!normalizedNome || !normalizedEmail || !normalizedSenha) {
    throw new Error('Preencha nome, e-mail e senha.')
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
        email: normalizedEmail,
        perfil: normalizedPerfil,
        ativo: Boolean(ativo),
        criadoEm: new Date().toISOString(),
      }

      await setDoc(doc(db, 'usuarios', credential.user.uid), profile)
      await signOut(secondaryAuth)
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
    email: normalizedEmail,
    senha: normalizedSenha,
    perfil: normalizedPerfil,
    ativo: Boolean(ativo),
    criadoEm: new Date().toISOString(),
  }

  store.usuarios = [...(store.usuarios || []), createdUser]
  writeStore(store)

  return createdUser
}

export async function atualizarStatusEncomenda(encomenda, novoStatus, descricao = '') {
  const statusAtualizado = String(novoStatus || '').trim() || 'Postado'
  const observacao = descricao.trim()
  const timestamp = new Date().toISOString()

  if (isConfigured && db) {
    await updateDoc(doc(db, 'encomendas', encomenda.id), {
      status: statusAtualizado,
      atualizadoEm: serverTimestamp(),
    })

    await addDoc(collection(db, 'movimentacoes'), {
      encomendaCodigo: encomenda.codigo,
      status: statusAtualizado,
      descricao: observacao || `Status alterado para ${statusAtualizado}`,
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
      criadoEm: timestamp,
    },
  ]
  writeStore(store)
  return true
}
