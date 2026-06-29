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
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  startAt,
  startAfter,
  endAt,
  serverTimestamp,
  updateDoc,
  where,
  runTransaction,
  writeBatch,
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
import { enqueueOfflineAction, getOfflineQueueSummary, listOfflineQueue, pruneOfflineQueue, subscribeOfflineQueue, updateOfflineAction } from './offlineQueue.js'
import { obterRemetenteNome } from '../utils/remetente.js'
import { reportRuntimeError } from '../utils/runtimeDiagnostics.js'
import { enrichUserModuleAccess, normalizeModuleAccess } from '../utils/accessControl.js'
import { DEFAULT_EMPRESA, ROOT_SUPERADMIN_EMAIL, SYSTEM_NAME, isRootSuperadminEmail, normalizeEmail } from '../utils/systemConfig.js'
import { isTarifaAntecipada } from '../utils/tarifaUtils.js'
import { getIndexedFieldName, normalizeSearchValue, prepareCollectionPayload } from './searchNormalization.js'
import { calcularHorarioChegada, gerarCodigoPassagem, normalizarDocumento } from '../utils/passagemUtils.js'
import { getWeekdayLabelBR } from '../utils/date.js'

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
let firestoreCacheEnabled = false

if (isConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  auth = getAuth(app)

  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
    firestoreCacheEnabled = true
  } catch {
    db = getFirestore(app)
  }
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
  viagens: [],
  programacoesViagem: [],
  passageiros: [],
  passagens: [],
  checkins: [],
  caixa: [],
  resumos: {
    admin: {
      id: 'admin',
      totalEncomendas: 1,
      totalClientes: 2,
      totalTerminais: 2,
      totalPassagens: 0,
      totalViagens: 0,
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

function normalizarTextoComparacao(valor = '') {
  return normalizeSearchValue(String(valor || '').trim())
}

function usuarioExigeEmpresa(perfil = '') {
  return String(perfil || '').trim().toLowerCase() !== 'superadmin'
}

function validarEmpresaObrigatoria({ perfil = '', empresaId = '', empresaNome = '' }) {
  if (!usuarioExigeEmpresa(perfil)) {
    return
  }

  if (!String(empresaId || '').trim() || !String(empresaNome || '').trim()) {
    throw new Error('Todo usuario nao-superadmin precisa estar vinculado a uma empresa.')
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

function normalizeTerminaisDestino(rawTerminais, terminalDestinoFallback = '') {
  const base = Array.isArray(rawTerminais)
    ? rawTerminais
    : String(rawTerminais || terminalDestinoFallback || '')
      .split('|')

  return [...new Set(
    base
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )]
}

function migrateStore(store) {
  const nextStore = structuredClone(store || {})

  nextStore.empresas = Array.isArray(nextStore.empresas) && nextStore.empresas.length
    ? nextStore.empresas
    : structuredClone(seedStore.empresas || [])

  nextStore.logsUso = Array.isArray(nextStore.logsUso) ? nextStore.logsUso : []

  nextStore.usuarios = (nextStore.usuarios || []).map((item) => ({
    ...item,
    ...enrichUserModuleAccess(item),
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
      acessoFretes: true,
      acessoPassagens: true,
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

  nextStore.rotasValores = (nextStore.rotasValores || []).map((item) => {
    const terminaisDestino = normalizeTerminaisDestino(item.terminaisDestino, item.terminalDestino)

    return {
      ...preencherEmpresaPadrao(item),
      terminalOrigem: item.terminalOrigem || inferTerminalOrigem(item.origem),
      terminalDestino: item.terminalDestino || terminaisDestino[0] || '',
      terminaisDestino,
      percentualGratuidade: Number(item.percentualGratuidade || 0),
      origemBusca: item.origemBusca || normalizeSearchValue(item.origem),
      destinoBusca: item.destinoBusca || normalizeSearchValue(item.destino),
      linhaBusca: item.linhaBusca || normalizeSearchValue(`${item.origem || ''} ${item.destino || ''}`.trim()),
    }
  })

  nextStore.encomendas = (nextStore.encomendas || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    codigoBusca: item.codigoBusca || normalizeSearchValue(item.codigo, { upper: true }),
    remetenteBusca: item.remetenteBusca || normalizeSearchValue(item.remetenteNome),
    destinatarioBusca: item.destinatarioBusca || normalizeSearchValue(item.destinatarioNome),
  }))

  nextStore.viagens = (nextStore.viagens || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    codigoBusca: item.codigoBusca || normalizeSearchValue(item.codigoViagem, { upper: true }),
    origemBusca: item.origemBusca || normalizeSearchValue(item.origem),
    destinoBusca: item.destinoBusca || normalizeSearchValue(item.destino),
    viagemBusca: item.viagemBusca || normalizeSearchValue(`${item.origem || ''} ${item.destino || ''} ${item.dataViagem || ''}`.trim()),
  }))

  nextStore.programacoesViagem = (nextStore.programacoesViagem || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    embarcacaoBusca: item.embarcacaoBusca || normalizeSearchValue(item.embarcacaoNome),
    rotaBusca: item.rotaBusca || normalizeSearchValue(`${item.origem || ''} ${item.destino || ''}`.trim()),
  }))

  nextStore.passageiros = (nextStore.passageiros || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    nomeBusca: item.nomeBusca || normalizeSearchValue(item.nome),
    documentoBusca: item.documentoBusca || normalizeSearchValue(item.documento),
  }))

  nextStore.passagens = (nextStore.passagens || []).map((item) => ({
    ...preencherEmpresaPadrao(item),
    codigoBusca: item.codigoBusca || normalizeSearchValue(item.codigo, { upper: true }),
    passageiroBusca: item.passageiroBusca || normalizeSearchValue(item.passageiroNome),
    documentoBusca: item.documentoBusca || normalizeSearchValue(item.passageiroDocumento),
    viagemBusca: item.viagemBusca || normalizeSearchValue(`${item.origem || ''} ${item.destino || ''} ${item.dataViagem || ''}`.trim()),
  }))

  nextStore.checkins = (nextStore.checkins || []).map((item) => preencherEmpresaPadrao(item))

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
      ...enrichUserModuleAccess(parsed),
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
        ...enrichUserModuleAccess(user),
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

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function shouldUseFirestoreQueuedWrites() {
  return Boolean(isConfigured && db && firestoreCacheEnabled && isBrowserOffline())
}

export function getOfflineCapabilities() {
  return {
    usesFirebase: isConfigured,
    usesLocalStore: !isConfigured,
    localCacheEnabled: firestoreCacheEnabled,
    supportsQueuedWrites: Boolean(isConfigured && db && firestoreCacheEnabled),
  }
}

export function getOfflineSyncSummary() {
  return getOfflineQueueSummary()
}

export function subscribeOfflineSync(callback) {
  return subscribeOfflineQueue(callback)
}

function getFirstLeaderboardEntry(counter = new Map(), fallbackLabel = '-', suffixBuilder = null) {
  const sorted = [...counter.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1]
    }

    return String(left[0]).localeCompare(String(right[0]))
  })
  const topEntry = sorted[0]

  if (!topEntry) {
    return {
      label: fallbackLabel,
      total: 0,
    }
  }

  return {
    label: suffixBuilder ? suffixBuilder(topEntry[0], topEntry[1]) : String(topEntry[0]),
    total: Number(topEntry[1] || 0),
  }
}

function normalizeTarifaTipo(value = '') {
  return String(value || '').trim().toLowerCase()
}

const PASSAGENS_WEEKDAY_ORDER = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const PASSAGENS_HOUR_RANGE = Array.from({ length: 15 }, (_, index) => 5 + index)

function normalizeHorarioLabel(value = '') {
  const trimmed = String(value || '').trim()

  if (!trimmed) {
    return ''
  }

  const rawHour = Number.parseInt(trimmed.split(':')[0], 10)

  if (!Number.isFinite(rawHour)) {
    return ''
  }

  return `${String(rawHour).padStart(2, '0')}h`
}

function computePassagensAnalytics(passagens = [], viagens = []) {
  const passagensValidas = (passagens || []).filter((item) => item.status !== 'Cancelada')
  const passagensEmbarcadas = passagensValidas.filter((item) => item.status === 'Embarcado')
  const passagensPendentes = passagensValidas.filter((item) => item.status !== 'Embarcado')
  const passagensImpactandoCapacidade = passagensValidas.filter((item) => passagemImpactaCapacidade(item))
  const gratuidades = passagensValidas.filter((item) => normalizeTarifaTipo(item.tarifaTipo) === 'gratuidade')
  const passagensTransportadasBase = passagensEmbarcadas.length ? passagensEmbarcadas : passagensValidas
  const horaPicoCounter = new Map(PASSAGENS_HOUR_RANGE.map((hour) => [`${String(hour).padStart(2, '0')}h`, 0]))
  const embarcacaoCounter = new Map()
  const weekdayCounter = new Map(PASSAGENS_WEEKDAY_ORDER.map((label) => [label, 0]))
  const viagensMap = new Map((viagens || []).map((item) => [item.id, item]))

  for (const item of passagensTransportadasBase) {
    const hora = normalizeHorarioLabel(item.horarioSaida)

    if (horaPicoCounter.has(hora)) {
      horaPicoCounter.set(hora, Number(horaPicoCounter.get(hora) || 0) + 1)
    }

    const embarcacao = String(item.embarcacaoNome || '').trim() || 'Embarcacao nao informada'
    embarcacaoCounter.set(embarcacao, Number(embarcacaoCounter.get(embarcacao) || 0) + 1)

    const weekday = getWeekdayLabelBR(item.dataViagem, 'Sem data')

    if (weekdayCounter.has(weekday)) {
      weekdayCounter.set(weekday, Number(weekdayCounter.get(weekday) || 0) + 1)
    }
  }

  const viagensConsideradas = (viagens || []).filter((item) => Number(item.capacidadeTotal || 0) > 0)
  const capacidadeTotal = viagensConsideradas.reduce((total, item) => total + Number(item.capacidadeTotal || 0), 0)
  const ocupacaoPercentual = capacidadeTotal > 0
    ? (passagensImpactandoCapacidade.length / capacidadeTotal) * 100
    : 0
  const gratuidadesPercentual = passagensValidas.length > 0
    ? (gratuidades.length / passagensValidas.length) * 100
    : 0
  const topEmbarcacao = getFirstLeaderboardEntry(
    embarcacaoCounter,
    'Sem embarcacao',
  )
  const weekdayDistribution = PASSAGENS_WEEKDAY_ORDER.map((label) => ({
    label,
    total: Number(weekdayCounter.get(label) || 0),
  }))
  const hourDistribution = PASSAGENS_HOUR_RANGE.map((hour) => {
    const label = `${String(hour).padStart(2, '0')}h`
    return {
      label,
      total: Number(horaPicoCounter.get(label) || 0),
    }
  })
  const topWeekday = getFirstLeaderboardEntry(
    new Map(weekdayDistribution.map((item) => [item.label, item.total])),
    '-',
  )

  return {
    totalPassagens: passagens.length,
    totalViagensAtivas: (viagens || []).filter((item) => ['Aberta', 'Embarcando'].includes(item.status)).length,
    totalEmbarcadas: passagensEmbarcadas.length,
    totalPendentes: passagensPendentes.length,
    horarioPico: getFirstLeaderboardEntry(horaPicoCounter, '-').label,
    embarcacaoDestaque: topEmbarcacao.label,
    embarcacaoDestaqueTotal: topEmbarcacao.total,
    taxaOcupacao: ocupacaoPercentual,
    percentualGratuidades: gratuidadesPercentual,
    diasMaiorMovimento: topWeekday.label,
    diasMaiorMovimentoTotal: topWeekday.total,
    diasMaiorMovimentoChart: weekdayDistribution,
    horariosPicoChart: hourDistribution,
    capacidadeTotal,
    passageirosTransportados: passagensImpactandoCapacidade.length,
    conflitosCapacidade: [...viagensMap.values()].filter((item) => Number(item.vagasDisponiveis || 0) < 0).length,
  }
}

function isAdminSummaryCollection(collectionName) {
  return ['clientes', 'terminais'].includes(collectionName)
}

function shouldRestrictByEmpresa(collectionName) {
  return ['clientes', 'terminais', 'embarcacoes', 'rotasValores', 'encomendas', 'movimentacoes', 'caixa', 'viagens', 'programacoesViagem', 'passageiros', 'passagens', 'checkins'].includes(collectionName)
}

function filterItemsByEmpresa(items, empresaId = '') {
  if (!empresaId) {
    return items
  }

  return items.filter((item) => String(item?.empresaId || '') === String(empresaId))
}

function getDateFromUnknownValue(value) {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    const dateValue = value.toDate()
    return Number.isNaN(dateValue?.getTime?.()) ? null : dateValue
  }

  const dateValue = new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

function getComparableValue(value) {
  const dateValue = getDateFromUnknownValue(value)

  if (dateValue) {
    return dateValue.getTime()
  }

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  return String(value ?? '').toLowerCase()
}

function compareValues(left, right, direction = 'desc') {
  const normalizedDirection = direction === 'asc' ? 'asc' : 'desc'
  const leftValue = getComparableValue(left)
  const rightValue = getComparableValue(right)

  if (leftValue === rightValue) {
    return 0
  }

  if (normalizedDirection === 'asc') {
    return leftValue > rightValue ? 1 : -1
  }

  return leftValue > rightValue ? -1 : 1
}

function sortItemsByField(items, orderField = 'criadoEm', orderDirection = 'desc') {
  return [...items].sort((a, b) => {
    const primary = compareValues(a?.[orderField], b?.[orderField], orderDirection)

    if (primary !== 0) {
      return primary
    }

    return compareValues(a?.id, b?.id, 'asc')
  })
}

function getCursorItemId(cursor) {
  if (!cursor) {
    return ''
  }

  if (typeof cursor.id === 'string' && cursor.id.trim()) {
    return cursor.id
  }

  return ''
}

function cursorIsFirestoreSnapshot(cursor) {
  return Boolean(cursor && typeof cursor.data === 'function' && typeof cursor.id === 'string')
}

function paginateSortedItems(items, cursor, maxResults = 12) {
  const cursorId = getCursorItemId(cursor)
  const startIndex = cursorId
    ? Math.max(0, items.findIndex((item) => item.id === cursorId) + 1)
    : 0
  const pagedItems = items.slice(startIndex, startIndex + maxResults)
  const lastItem = pagedItems.at(-1) || null

  return {
    items: pagedItems,
    cursor: lastItem,
    hasMore: startIndex + pagedItems.length < items.length,
  }
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

  const sessionUser = {
    ...normalizeModuleAccess({ ...profile, rootSuperadmin: rootAccess }),
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

  validarAcessoUsuarioComEmpresa(sessionUser)
  return sessionUser
}

function validarAcessoUsuarioComEmpresa(profile) {
  if (!profile) {
    return
  }

  if (usuarioExigeEmpresa(profile.perfil) && !String(profile.empresaId || '').trim()) {
    throw new Error('Este usuario precisa estar vinculado a uma empresa antes de acessar o sistema.')
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
    ...normalizeModuleAccess({ ...account, rootSuperadmin: isRootSuperadminEmail(account.email) }),
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
  validarAcessoUsuarioComEmpresa(user)
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

export async function syncOfflineActions() {
  if (!isConfigured || !db) {
    return getOfflineQueueSummary()
  }

  const queue = listOfflineQueue()
  const pendentes = queue.filter((item) => ['pending', 'syncing', 'error'].includes(item.status))

  for (const item of pendentes) {
    updateOfflineAction(item.id, {
      status: 'syncing',
      conflictMessage: '',
    })

    try {
      if (item.type === 'venda_passagem') {
        const passagem = await buscarPassagemPorCodigo(item.payload?.passagemCodigo, {
          empresaId: item.payload?.empresaId || '',
          empresaNome: item.payload?.empresaNome || '',
        })
        const viagem = await getViagemById(item.payload?.viagemId, {
          empresaId: item.payload?.empresaId || '',
          empresaNome: item.payload?.empresaNome || '',
        })

        if (!passagem) {
          updateOfflineAction(item.id, {
            status: 'conflict',
            conflictMessage: 'A venda nao apareceu na base sincronizada.',
          })
          continue
        }

        const excedeuCapacidade = item.payload?.impactaCapacidade &&
          viagem &&
          Number(viagem.vagasVendidas || 0) > Number(viagem.capacidadeTotal || 0)

        updateOfflineAction(item.id, {
          status: excedeuCapacidade ? 'conflict' : 'synced',
          conflictMessage: excedeuCapacidade
            ? 'A sincronizacao concluiu, mas a viagem ficou acima da capacidade. Revise este embarque.'
            : '',
        })
        continue
      }

      if (item.type === 'cancelamento_passagem') {
        const passagem = await buscarPassagemPorCodigo(item.payload?.passagemCodigo, {
          empresaId: item.payload?.empresaId || '',
          empresaNome: item.payload?.empresaNome || '',
        })

        updateOfflineAction(item.id, {
          status: passagem?.status === 'Cancelada' ? 'synced' : 'conflict',
          conflictMessage: passagem?.status === 'Cancelada'
            ? ''
            : 'O cancelamento ainda nao foi refletido na base sincronizada.',
        })
        continue
      }

      if (item.type === 'abertura_caixa_passagem') {
        const viagem = await getViagemById(item.payload?.viagemId, {
          empresaId: item.payload?.empresaId || '',
          empresaNome: item.payload?.empresaNome || '',
        })

        updateOfflineAction(item.id, {
          status: ['Aberta', 'Embarcando'].includes(viagem?.status) ? 'synced' : 'conflict',
          conflictMessage: ['Aberta', 'Embarcando'].includes(viagem?.status)
            ? ''
            : 'A abertura do caixa nao apareceu como ativa na sincronizacao.',
        })
        continue
      }

      if (item.type === 'fechamento_caixa_passagem') {
        const viagem = await getViagemById(item.payload?.viagemId, {
          empresaId: item.payload?.empresaId || '',
          empresaNome: item.payload?.empresaNome || '',
        })

        updateOfflineAction(item.id, {
          status: viagem?.status === 'Fechada' ? 'synced' : 'conflict',
          conflictMessage: viagem?.status === 'Fechada'
            ? ''
            : 'O fechamento do caixa nao foi confirmado na sincronizacao.',
        })
        continue
      }

      if (item.type === 'embarque_passagem') {
        const passagem = await buscarPassagemPorCodigo(item.payload?.passagemCodigo, {
          empresaId: item.payload?.empresaId || '',
          empresaNome: item.payload?.empresaNome || '',
        })

        updateOfflineAction(item.id, {
          status: passagem?.status === 'Embarcado' ? 'synced' : 'conflict',
          conflictMessage: passagem?.status === 'Embarcado'
            ? ''
            : 'O embarque nao apareceu como confirmado na sincronizacao.',
        })
        continue
      }

      updateOfflineAction(item.id, {
        status: 'synced',
      })
    } catch (error) {
      updateOfflineAction(item.id, {
        status: 'error',
        conflictMessage: error.message || 'Falha ao sincronizar a fila offline.',
      })
    }
  }

  pruneOfflineQueue()
  return getOfflineQueueSummary()
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
    const usarRestricaoEmpresa = shouldRestrictByEmpresa(collectionName) && empresaId
    const cursorCompativel = !cursor || cursorIsFirestoreSnapshot(cursor)

    if (cursorCompativel) {
      const constraints = []

      if (usarRestricaoEmpresa) {
        constraints.push(where('empresaId', '==', empresaId))
      }

      constraints.push(orderBy(orderField, orderDirection))

      if (cursor) {
        constraints.push(startAfter(cursor))
      }

      constraints.push(limit(maxResults))

      try {
        const snapshot = await getDocs(query(collection(db, collectionName), ...constraints))

        return {
          items: filterItemsByEmpresa(mapDocs(snapshot), shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : ''),
          cursor: snapshot.docs.at(-1) || null,
          hasMore: snapshot.docs.length === maxResults,
        }
      } catch (error) {
        reportRuntimeError('firebase.listCollectionPage.indexFallback', error, {
          collectionName,
          orderField,
          orderDirection,
          empresaId,
          empresaNome,
        })
      }
    }

    const baseItems = await listCollectionOnce(collectionName, {
      empresaId: shouldRestrictByEmpresa(collectionName) ? empresaId : '',
      empresaNome: shouldRestrictByEmpresa(collectionName) ? empresaNome : '',
    })

    return paginateSortedItems(sortItemsByField(baseItems, orderField, orderDirection), cursor, maxResults)
  }

  const sortedItems = sortItemsByField(
    filterItemsByEmpresa(readStore()[collectionName] || [], shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : ''),
    orderField,
    orderDirection,
  )

  if (Number.isFinite(Number(cursor))) {
    const startIndex = Number(cursor)
    const items = sortedItems.slice(startIndex, startIndex + maxResults)
    const nextCursor = startIndex + items.length

    return {
      items,
      cursor: nextCursor < sortedItems.length ? nextCursor : null,
      hasMore: nextCursor < sortedItems.length,
    }
  }

  return paginateSortedItems(sortedItems, cursor, maxResults)
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
    const constraints = []

    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      constraints.push(where('empresaId', '==', empresaId))
    }

    constraints.push(orderBy(indexedField))
    constraints.push(startAt(searchKey))
    constraints.push(endAt(`${searchKey}\uf8ff`))
    constraints.push(limit(maxResults))

    try {
      const snapshot = await getDocs(query(collection(db, collectionName), ...constraints))
      return filterItemsByEmpresa(mapDocs(snapshot), shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '')
    } catch {
      if (shouldRestrictByEmpresa(collectionName) && empresaId) {
        const snapshot = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
        return mapDocs(snapshot)
          .filter((item) => String(item[indexedField] || item[fieldName] || '').toLowerCase().includes(searchKey.toLowerCase()))
          .sort((a, b) => String(a[indexedField] || '').localeCompare(String(b[indexedField] || '')))
          .slice(0, maxResults)
      }

      throw new Error('Nao foi possivel executar a busca indexada.')
    }
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

  if (collectionName === 'passagens') {
    const resumoAdmin = garantirResumoAdminLocal(store)
    resumoAdmin.totalPassagens = Number(resumoAdmin.totalPassagens || 0) + 1
  }

  if (collectionName === 'viagens') {
    const resumoAdmin = garantirResumoAdminLocal(store)
    resumoAdmin.totalViagens = Number(resumoAdmin.totalViagens || 0) + 1
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

  if (collectionName === 'passagens') {
    const resumoAdmin = garantirResumoAdminLocal(store)
    resumoAdmin.totalPassagens = Math.max(0, Number(resumoAdmin.totalPassagens || 0) - 1)
  }

  if (collectionName === 'viagens') {
    const resumoAdmin = garantirResumoAdminLocal(store)
    resumoAdmin.totalViagens = Math.max(0, Number(resumoAdmin.totalViagens || 0) - 1)
  }

  writeStore(store)
  return true
}

export async function excluirUsuarioSistema(documentId, actorUser = null) {
  if (!isRootSuperadminEmail(actorUser?.email)) {
    throw new Error('Somente o superadmin principal pode excluir usuarios.')
  }

  if (!documentId) {
    throw new Error('Usuario nao informado.')
  }

  if (String(actorUser?.uid || actorUser?.id || '') === String(documentId)) {
    throw new Error('Nao e permitido excluir o usuario da sessao atual.')
  }

  if (isConfigured && db) {
    const usuarioRef = doc(db, 'usuarios', documentId)
    const usuarioSnapshot = await getDoc(usuarioRef)

    if (!usuarioSnapshot.exists()) {
      throw new Error('Usuario nao encontrado.')
    }

    const usuario = { id: usuarioSnapshot.id, ...usuarioSnapshot.data() }

    if (isRootSuperadminEmail(usuario.email)) {
      throw new Error('O superadmin principal nao pode ser excluido.')
    }

    await deleteDoc(usuarioRef)
    await registrarLogUso({
      acao: 'usuario_excluido',
      detalhes: `Usuario ${usuario.nome || usuario.email || documentId} removido do sistema.`,
      user: actorUser,
      empresaId: usuario.empresaId || '',
      empresaNome: usuario.empresaNome || '',
    })
    return true
  }

  const store = readStore()
  const usuario = (store.usuarios || []).find((item) => item.id === documentId || item.uid === documentId)

  if (!usuario) {
    throw new Error('Usuario nao encontrado.')
  }

  if (isRootSuperadminEmail(usuario.email)) {
    throw new Error('O superadmin principal nao pode ser excluido.')
  }

  store.usuarios = (store.usuarios || []).filter((item) => item.id !== documentId && item.uid !== documentId)
  writeStore(store)
  await registrarLogUso({
    acao: 'usuario_excluido',
    detalhes: `Usuario ${usuario.nome || usuario.email || documentId} removido do sistema.`,
    user: actorUser,
    empresaId: usuario.empresaId || '',
    empresaNome: usuario.empresaNome || '',
  })
  return true
}

export async function deleteHistoricoCaixaPassagem(viagemId, actorUser = null) {
  if (!isRootSuperadminEmail(actorUser?.email)) {
    throw new Error('Somente o superadmin principal pode excluir historicos de caixa.')
  }

  if (!viagemId) {
    throw new Error('Historico de caixa nao informado.')
  }

  if (isConfigured && db) {
    const viagemRef = doc(db, 'viagens', viagemId)
    const viagemSnapshot = await getDoc(viagemRef)

    if (!viagemSnapshot.exists()) {
      throw new Error('Historico de caixa nao encontrado.')
    }

    const viagem = { id: viagemSnapshot.id, ...viagemSnapshot.data() }
    const [passagensSnapshot, caixaSnapshot, checkinsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'passagens'), where('viagemId', '==', viagemId))),
      getDocs(query(collection(db, 'caixa'), where('viagemId', '==', viagemId))),
      getDocs(query(collection(db, 'checkins'), where('viagemId', '==', viagemId))),
    ])

    const passagens = mapDocs(passagensSnapshot)
    const caixaItems = mapDocs(caixaSnapshot)
    const checkins = mapDocs(checkinsSnapshot)

    for (const item of passagens) {
      await deleteDoc(doc(db, 'passagens', item.id))
    }

    for (const item of caixaItems) {
      await deleteDoc(doc(db, 'caixa', item.id))
    }

    for (const item of checkins) {
      await deleteDoc(doc(db, 'checkins', item.id))
    }

    await deleteDoc(viagemRef)

    const deltaEntrada = caixaItems.reduce((total, item) => total - (item.tipo === 'entrada' ? Number(item.valor || 0) : 0), 0)
    const deltaRegistros = caixaItems.length ? -caixaItems.length : 0

    if (deltaEntrada !== 0 || deltaRegistros !== 0) {
      await ajustarResumoCaixa({
        deltaEntrada,
        deltaRegistros,
      })
    }

    await registrarLogUso({
      acao: 'historico_caixa_excluido',
      detalhes: `Historico de caixa da viagem ${viagem.origem || '-'} - ${viagem.destino || '-'} em ${viagem.dataViagem || '-'} removido.`,
      user: actorUser,
      empresaId: viagem.empresaId || '',
      empresaNome: viagem.empresaNome || '',
    })
    return true
  }

  const store = readStore()
  const viagem = (store.viagens || []).find((item) => item.id === viagemId)

  if (!viagem) {
    throw new Error('Historico de caixa nao encontrado.')
  }

  const passagens = (store.passagens || []).filter((item) => item.viagemId === viagemId)
  const caixaItems = (store.caixa || []).filter((item) => item.viagemId === viagemId)

  store.passagens = (store.passagens || []).filter((item) => item.viagemId !== viagemId)
  store.caixa = (store.caixa || []).filter((item) => item.viagemId !== viagemId)
  store.checkins = (store.checkins || []).filter((item) => item.viagemId !== viagemId)
  store.viagens = (store.viagens || []).filter((item) => item.id !== viagemId)

  const resumoAdmin = garantirResumoAdminLocal(store)
  resumoAdmin.totalPassagens = Math.max(0, Number(resumoAdmin.totalPassagens || 0) - passagens.length)
  resumoAdmin.totalViagens = Math.max(0, Number(resumoAdmin.totalViagens || 0) - 1)

  const resumoCaixa = garantirResumoCaixaLocal(store)
  const totalEntradaRemovido = caixaItems.reduce((total, item) => total + (item.tipo === 'entrada' ? Number(item.valor || 0) : 0), 0)
  resumoCaixa.totalEntrada = Number(resumoCaixa.totalEntrada || 0) - totalEntradaRemovido
  resumoCaixa.totalRegistros = Math.max(0, Number(resumoCaixa.totalRegistros || 0) - caixaItems.length)

  writeStore(store)
  await registrarLogUso({
    acao: 'historico_caixa_excluido',
    detalhes: `Historico de caixa da viagem ${viagem.origem || '-'} - ${viagem.destino || '-'} em ${viagem.dataViagem || '-'} removido.`,
    user: actorUser,
    empresaId: viagem.empresaId || '',
    empresaNome: viagem.empresaNome || '',
  })
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
          const data = getDateFromUnknownValue(item?.criadoEm)

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
      const data = getDateFromUnknownValue(item?.criadoEm)

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
  const itens = Array.isArray(dados.itens)
    ? dados.itens
      .map((item, index) => ({
        id: item.id || `item-${index + 1}`,
        descricao: String(item.descricao || '').trim(),
        observacao: String(item.observacao || '').trim(),
        valorFrete: Number(item.valorFrete || 0),
      }))
      .filter((item) => item.descricao || item.observacao || item.valorFrete > 0)
    : []
  const valorFreteCalculado = itens.length
    ? itens.reduce((total, item) => total + Number(item.valorFrete || 0), 0)
    : Number(dados.valorFrete || 0)
  const valorTotal = valorFreteCalculado + Number(dados.taxa || 0)
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
    itens,
    quantidade: Number(dados.quantidade || 0),
    peso: Number(dados.peso || 0),
    valorFrete: valorFreteCalculado,
    taxa: Number(dados.taxa || 0),
    valorTotal,
    formaPagamento: dados.formaPagamento || 'Não informado',
    qrCodeDataUrl: dados.qrCodeDataUrl || '',
    rastreioUrl: dados.rastreioUrl || '',
    empresaId: dados.empresaId || '',
    empresaNome: dados.empresaNome || '',
    empresaTelefoneSac: dados.empresaTelefoneSac || '',
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
      try {
        const snapshot = await getCountFromServer(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
        return snapshot.data().count || 0
      } catch (error) {
        reportRuntimeError('firebase.getCollectionCount.fallbackByEmpresa', error, {
          collectionName,
          empresaId,
          empresaNome,
        })

        const snapshot = await getDocs(query(collection(db, collectionName), where('empresaId', '==', empresaId)))
        return filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome).length
      }
    }

    try {
      const snapshot = await getCountFromServer(collection(db, collectionName))
      return snapshot.data().count || 0
    } catch (error) {
      reportRuntimeError('firebase.getCollectionCount.fallbackGlobal', error, {
        collectionName,
      })

      const snapshot = await getDocs(collection(db, collectionName))
      return mapDocs(snapshot).length
    }
  }

  return filterItemsByEmpresa(readStore()[collectionName] || [], shouldRestrictByEmpresa(collectionName) ? empresaId : '', shouldRestrictByEmpresa(collectionName) ? empresaNome : '').length
}

export async function listRecentDocuments(collectionName, fieldName = 'criadoEm', maxResults = 5, { empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    if (shouldRestrictByEmpresa(collectionName) && empresaId) {
      try {
        const snapshot = await getDocs(
          query(collection(db, collectionName), where('empresaId', '==', empresaId), orderBy(fieldName, 'desc'), limit(maxResults)),
        )
        return mapDocs(snapshot)
      } catch (error) {
        reportRuntimeError('firebase.listRecentDocuments.indexFallback', error, {
          collectionName,
          fieldName,
          maxResults,
          empresaId,
          empresaNome,
        })

        const snapshot = await getDocs(
          query(collection(db, collectionName), where('empresaId', '==', empresaId)),
        )

        return mapDocs(snapshot)
          .sort((a, b) => String(b[fieldName] || '').localeCompare(String(a[fieldName] || '')))
          .slice(0, maxResults)
      }
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
      totalPassagens: (store.passagens || []).length,
      totalViagens: (store.viagens || []).length,
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
    const [encomendasCount, clientesCount, terminaisCount, passagensCount, viagensCount] = await Promise.all([
      getCollectionCount('encomendas', { empresaId, empresaNome }),
      getCollectionCount('clientes', { empresaId, empresaNome }),
      getCollectionCount('terminais', { empresaId, empresaNome }),
      getCollectionCount('passagens', { empresaId, empresaNome }),
      getCollectionCount('viagens', { empresaId, empresaNome }),
    ])

    return {
      totalEncomendas: encomendasCount,
      totalClientes: clientesCount,
      totalTerminais: terminaisCount,
      totalPassagens: passagensCount,
      totalViagens: viagensCount,
    }
  }

  const store = readStore()
  if (empresaId) {
    return {
      totalEncomendas: filterItemsByEmpresa(store.encomendas || [], empresaId).length,
      totalClientes: filterItemsByEmpresa(store.clientes || [], empresaId).length,
      totalTerminais: filterItemsByEmpresa(store.terminais || [], empresaId).length,
      totalPassagens: filterItemsByEmpresa(store.passagens || [], empresaId).length,
      totalViagens: filterItemsByEmpresa(store.viagens || [], empresaId).length,
    }
  }

  const resumo = garantirResumoAdminLocal(store)
  writeStore(store)
  return {
    totalEncomendas: Number(resumo.totalEncomendas || 0),
    totalClientes: Number(resumo.totalClientes || 0),
    totalTerminais: Number(resumo.totalTerminais || 0),
    totalPassagens: Number(resumo.totalPassagens || 0),
    totalViagens: Number(resumo.totalViagens || 0),
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

export async function getCaixaResumoHoje({ empresaId = '', empresaNome = '' } = {}) {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  const hoje = `${ano}-${mes}-${dia}`
  const itens = await listCaixaEntries({
    dataInicial: hoje,
    dataFinal: hoje,
    maxResults: 2000,
    empresaId,
    empresaNome,
  })

  return {
    totalEntrada: itens
      .filter((item) => item.tipo === 'entrada')
      .reduce((sum, item) => sum + Number(item.valor || 0), 0),
    totalRegistros: itens.length,
  }
}

export async function criarUsuario({ nome, email, senha, perfil = 'operador', ativo = true, empresaId = '', empresaNome = '', acessoFretes = true, acessoPassagens = true, actorUser = null }) {
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

  const normalizedModules = normalizeModuleAccess({ acessoFretes, acessoPassagens })

  if (!normalizedModules.acessoFretes && !normalizedModules.acessoPassagens) {
    throw new Error('Selecione pelo menos um ambiente de acesso.')
  }

  validarEmpresaObrigatoria({
    perfil: normalizedPerfil,
    empresaId,
    empresaNome,
  })

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
        acessoFretes: normalizedModules.acessoFretes,
        acessoPassagens: normalizedModules.acessoPassagens,
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
    acessoFretes: normalizedModules.acessoFretes,
    acessoPassagens: normalizedModules.acessoPassagens,
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

  const normalizedModules = normalizeModuleAccess(updates)

  if (!normalizedModules.acessoFretes && !normalizedModules.acessoPassagens) {
    throw new Error('Selecione pelo menos um ambiente de acesso.')
  }

  validarEmpresaObrigatoria({
    perfil: normalizedPerfil,
    empresaId: normalizedEmpresaId,
    empresaNome: normalizedEmpresaNome,
  })

  const payload = {
    nome: normalizedNome,
    nomeBusca: normalizeSearchValue(normalizedNome),
    perfil: normalizedPerfil,
    ativo: Boolean(updates?.ativo),
    acessoFretes: normalizedModules.acessoFretes,
    acessoPassagens: normalizedModules.acessoPassagens,
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

const COLECOES_COM_EMPRESA = [
  'clientes',
  'terminais',
  'embarcacoes',
  'rotasValores',
  'encomendas',
  'movimentacoes',
  'caixa',
  'viagens',
  'programacoesViagem',
  'passageiros',
  'passagens',
  'checkins',
]

function montarPayloadEmpresa(empresa) {
  return {
    empresaId: empresa.id,
    empresaNome: empresa.nome || '',
  }
}

function usuarioCorrespondeMigracao(item, nomeOrigem, emailOrigem = '') {
  const nomeAtual = normalizarTextoComparacao(item?.nome || '')
  const emailAtual = normalizarTextoComparacao(item?.email || '')
  const nomeEsperado = normalizarTextoComparacao(nomeOrigem)
  const emailEsperado = normalizarTextoComparacao(emailOrigem)

  return Boolean(
    (nomeEsperado && nomeAtual.includes(nomeEsperado)) ||
    (emailEsperado && emailAtual === emailEsperado),
  )
}

function registroPertenceEmpresaOrigemOuSemEmpresa(item, empresasOrigem = []) {
  const empresaIdAtual = String(item?.empresaId || '').trim()
  const empresaNomeAtual = normalizarTextoComparacao(item?.empresaNome || '')

  if (!empresaIdAtual) {
    return true
  }

  return empresasOrigem.some((empresaOrigem) =>
    empresaIdAtual === String(empresaOrigem?.id || '').trim() ||
    empresaNomeAtual === normalizarTextoComparacao(empresaOrigem?.nome || ''),
  )
}

export async function mesclarEmpresaOrigemEmDestino({
  usuarioOrigemNome = 'Leda',
  usuarioOrigemEmail = '',
  empresasOrigemNomes = [DEFAULT_EMPRESA.nome, 'Amazonat', 'Luz da Aurora III'],
  empresaDestinoNome = 'Luz da Aurora',
  actorUser = null,
} = {}) {
  if (!isRootSuperadminEmail(actorUser?.email)) {
    throw new Error('Somente o superadmin principal pode executar esta migracao.')
  }

  if (isConfigured && db) {
    const empresasSnapshot = await getDocs(collection(db, 'empresas'))
    const empresas = mapDocs(empresasSnapshot)
    const empresasOrigem = empresasOrigemNomes.map((nomeOrigem, index) =>
      empresas.find((item) => normalizarTextoComparacao(item.nome) === normalizarTextoComparacao(nomeOrigem))
        || {
          id: index === 0 ? DEFAULT_EMPRESA.id : '',
          nome: nomeOrigem || DEFAULT_EMPRESA.nome,
        },
    )
    const empresaDestino = empresas.find((item) => normalizarTextoComparacao(item.nome) === normalizarTextoComparacao(empresaDestinoNome))

    if (!empresaDestino) {
      throw new Error(`Empresa de destino nao encontrada: ${empresaDestinoNome}.`)
    }

    const empresaPayload = montarPayloadEmpresa(empresaDestino)
    const usuariosSnapshot = await getDocs(collection(db, 'usuarios'))
    const usuarios = mapDocs(usuariosSnapshot)
    const usuariosAtualizados = []

    for (const usuario of usuarios) {
      if (isRootSuperadminEmail(usuario.email)) {
        continue
      }

      if (!usuarioCorrespondeMigracao(usuario, usuarioOrigemNome, usuarioOrigemEmail)) {
        continue
      }

      if (String(usuario.empresaId || '').trim() === empresaPayload.empresaId && String(usuario.empresaNome || '').trim() === empresaPayload.empresaNome) {
        continue
      }

      await updateDoc(doc(db, 'usuarios', usuario.id), empresaPayload)
      usuariosAtualizados.push(usuario.id)
    }

    const contagemPorColecao = {}

    for (const nomeColecao of COLECOES_COM_EMPRESA) {
      const snapshot = await getDocs(collection(db, nomeColecao))
      const items = mapDocs(snapshot)
      const elegiveis = items.filter((item) => registroPertenceEmpresaOrigemOuSemEmpresa(item, empresasOrigem))

      contagemPorColecao[nomeColecao] = elegiveis.length

      for (const item of elegiveis) {
        await updateDoc(doc(db, nomeColecao, item.id), empresaPayload)
      }
    }

    await registrarLogUso({
      acao: 'mesclagem_empresa_legada',
      detalhes: `Mesclagem de registros sem empresa ou das empresas ${empresasOrigem.map((item) => item.nome).join(', ')} para ${empresaPayload.empresaNome}. Usuario base: ${usuarioOrigemNome}.`,
      user: actorUser,
      empresaId: empresaPayload.empresaId,
      empresaNome: empresaPayload.empresaNome,
    })

    return {
      empresaDestino: empresaPayload,
      usuariosAtualizados: usuariosAtualizados.length,
      contagemPorColecao,
    }
  }

  const store = readStore()
  const empresasOrigem = empresasOrigemNomes.map((nomeOrigem, index) =>
    (store.empresas || []).find((item) => normalizarTextoComparacao(item.nome) === normalizarTextoComparacao(nomeOrigem))
      || {
        id: index === 0 ? DEFAULT_EMPRESA.id : '',
        nome: nomeOrigem || DEFAULT_EMPRESA.nome,
      },
  )
  const empresaDestino = (store.empresas || []).find((item) => normalizarTextoComparacao(item.nome) === normalizarTextoComparacao(empresaDestinoNome))

  if (!empresaDestino) {
    throw new Error(`Empresa de destino nao encontrada: ${empresaDestinoNome}.`)
  }

  const empresaPayload = montarPayloadEmpresa(empresaDestino)
  let usuariosAtualizados = 0

  store.usuarios = (store.usuarios || []).map((usuario) => {
    if (isRootSuperadminEmail(usuario.email)) {
      return usuario
    }

    if (!usuarioCorrespondeMigracao(usuario, usuarioOrigemNome, usuarioOrigemEmail)) {
      return usuario
    }

    usuariosAtualizados += 1
    return {
      ...usuario,
      ...empresaPayload,
    }
  })

  const contagemPorColecao = {}

  for (const nomeColecao of COLECOES_COM_EMPRESA) {
    let atualizados = 0
    store[nomeColecao] = (store[nomeColecao] || []).map((item) => {
      if (!registroPertenceEmpresaOrigemOuSemEmpresa(item, empresasOrigem)) {
        return item
      }

      atualizados += 1
      return {
        ...item,
        ...empresaPayload,
      }
    })
    contagemPorColecao[nomeColecao] = atualizados
  }

  writeStore(store)
  await registrarLogUso({
    acao: 'mesclagem_empresa_legada',
    detalhes: `Mesclagem de registros sem empresa ou das empresas ${empresasOrigem.map((item) => item.nome).join(', ')} para ${empresaPayload.empresaNome}. Usuario base: ${usuarioOrigemNome}.`,
    user: actorUser,
    empresaId: empresaPayload.empresaId,
    empresaNome: empresaPayload.empresaNome,
  })

  return {
    empresaDestino: empresaPayload,
    usuariosAtualizados,
    contagemPorColecao,
  }
}

export async function migrarDadosLegadosSemEmpresa(options = {}) {
  return mesclarEmpresaOrigemEmDestino(options)
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

async function obterUltimoCodigoPassagemPorPrefixo(prefixo) {
  if (isConfigured && db) {
    const snapshot = await getDocs(
      query(
        collection(db, 'passagens'),
        where('codigoBusca', '>=', prefixo),
        where('codigoBusca', '<', `${prefixo}\uf8ff`),
        orderBy('codigoBusca', 'desc'),
        limit(1),
      ),
    )
    return snapshot.docs[0]?.data()?.codigo || ''
  }

  const store = readStore()
  return [...(store.passagens || [])]
    .map((item) => item.codigo)
    .filter((codigo) => String(codigo || '').startsWith(prefixo))
    .sort()
    .at(-1) || ''
}

function gerarCodigoViagem() {
  return `VIA-${Date.now()}`
}

function montarUrlEmbarquePassagem(codigo) {
  if (typeof window === 'undefined') {
    return `/scanner-embarque?codigo=${encodeURIComponent(codigo)}`
  }

  return `${window.location.origin}/scanner-embarque?codigo=${encodeURIComponent(codigo)}`
}

function calcularChegadaPrevistaViagem(dataViagem, horarioSaida, duracaoMinutos) {
  return calcularHorarioChegada(dataViagem, horarioSaida, duracaoMinutos)
}

function normalizarListaHorarios(horarios) {
  const source = Array.isArray(horarios) ? horarios : String(horarios || '').split(',')

  return [...new Set(
    source
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b))
}

function sanitizeViagemIdPart(value, fallback = 'manual') {
  const normalized = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '')
  return normalized || fallback
}

export function gerarViagemOperacionalId({ programacaoViagemId = '', rotaId = '', embarcacaoId = '', dataViagem = '', horarioSaida = '' } = {}) {
  const baseId = programacaoViagemId || [rotaId, embarcacaoId].filter(Boolean).join('-') || embarcacaoId || rotaId || 'manual'
  return `via-${sanitizeViagemIdPart(baseId)}-${String(dataViagem || '').replace(/[^0-9]/g, '')}-${String(horarioSaida || '').replace(/[^0-9]/g, '')}`
}

function gerarViagemProgramadaId(programacaoViagemId, dataViagem, horarioSaida, rotaId = '', embarcacaoId = '') {
  return gerarViagemOperacionalId({ programacaoViagemId, rotaId, embarcacaoId, dataViagem, horarioSaida })
}

function montarPayloadViagemProgramada(dados) {
  const capacidadeTotal = Number(dados.capacidadeTotal || 0)
  const vagasVendidas = Number(dados.vagasVendidas || 0)
  const horarioSaida = dados.horarioSaida || ''
  const dataViagem = dados.dataViagem || ''

  return prepareCollectionPayload('viagens', {
    codigoViagem: dados.codigoViagem || gerarCodigoViagem(),
    origemOperacao: dados.origemOperacao || 'passagens',
    programacaoViagemId: dados.programacaoViagemId || '',
    empresaId: dados.empresaId || '',
    empresaNome: dados.empresaNome || '',
    rotaId: dados.rotaId || '',
    origem: dados.origem || '',
    destino: dados.destino || '',
    terminalOrigem: dados.terminalOrigem || '',
    terminalDestino: dados.terminalDestino || '',
    embarcacaoId: dados.embarcacaoId || '',
    embarcacaoNome: dados.embarcacaoNome || '',
    dataViagem,
    horarioSaida,
    horarioChegadaPrevisto: dados.horarioChegadaPrevisto || calcularChegadaPrevistaViagem(dataViagem, horarioSaida, dados.duracaoMinutos),
    capacidadeTotal,
    vagasVendidas,
    vagasDisponiveis: Math.max(0, capacidadeTotal - vagasVendidas),
    valorPadrao: Number(dados.valorPadrao || 0),
    status: dados.status || 'Aberta',
    operadorNome: dados.operadorNome || '',
    operadorEmail: dados.operadorEmail || '',
    criadoEm: dados.criadoEm || new Date().toISOString(),
    atualizadoEm: dados.atualizadoEm || new Date().toISOString(),
  })
}

function isRegistroViagemPassagem(item) {
  const origemOperacao = String(item?.origemOperacao || 'passagens').trim().toLowerCase()
  return origemOperacao === 'passagens'
}

function getLocalIsoDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isCaixaPassagemAbertoAtivo(item, referenceDate = new Date()) {
  if (!isRegistroViagemPassagem(item) || !item?.caixaAbertoEm || item?.caixaFechadoEm || !['Aberta', 'Embarcando'].includes(item?.status)) {
    return false
  }

  const hojeIso = getLocalIsoDate(referenceDate)
  const dataViagem = String(item?.dataViagem || '').trim()

  if (dataViagem) {
    return dataViagem >= hojeIso
  }

  const abertura = getDateFromUnknownValue(item?.caixaAbertoEm)

  if (!abertura) {
    return false
  }

  return getLocalIsoDate(abertura) >= hojeIso
}

function isCaixaPassagemAberto(item) {
  return isCaixaPassagemAbertoAtivo(item)
}

function isHistoricoCaixaPassagemFechado(item) {
  return isRegistroViagemPassagem(item) && Boolean(item?.caixaAbertoEm) && Boolean(item?.caixaFechadoEm) && item?.status === 'Fechada'
}

export async function criarViagem(dados) {
  const payload = montarPayloadViagemProgramada(dados)

  if (isConfigured && db) {
    const viagemId = dados.id || ''

    if (viagemId) {
      await setDoc(doc(db, 'viagens', viagemId), {
        ...payload,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })
      return { id: viagemId, ...payload }
    }

    const viagemRef = await addDoc(collection(db, 'viagens'), {
      ...payload,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
    return { id: viagemRef.id, ...payload }
  }

  const store = readStore()
  const viagem = {
    id: dados.id || `viagem-${Date.now()}`,
    ...payload,
  }
  store.viagens = [
    ...(store.viagens || []).filter((item) => item.id !== viagem.id),
    viagem,
  ]
  writeStore(store)
  return viagem
}

export async function listarViagens({ empresaId = '', empresaNome = '', status = '', dataViagem = '' } = {}) {
  const items = await listCollectionOnce('viagens', { empresaId, empresaNome })

  return items
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
    .sort((a, b) => String(b.dataViagem || '').localeCompare(String(a.dataViagem || '')) || String(a.horarioSaida || '').localeCompare(String(b.horarioSaida || '')))
}

export async function criarProgramacaoViagem(dados) {
  const agora = new Date().toISOString()
  const horariosSaida = normalizarListaHorarios(dados.horariosSaida)

  if (!horariosSaida.length) {
    throw new Error('Informe pelo menos um horario de saida.')
  }

  const payload = prepareCollectionPayload('programacoesViagem', {
    empresaId: dados.empresaId || '',
    empresaNome: dados.empresaNome || '',
    rotaId: dados.rotaId || '',
    origem: dados.origem || '',
    destino: dados.destino || '',
    terminalOrigem: dados.terminalOrigem || '',
    terminalDestino: dados.terminalDestino || '',
    embarcacaoId: dados.embarcacaoId || '',
    embarcacaoNome: dados.embarcacaoNome || '',
    horariosSaida,
    capacidadeTotal: Number(dados.capacidadeTotal || 0),
    valorPadrao: Number(dados.valorPadrao || 0),
    duracaoMinutos: Number(dados.duracaoMinutos || 0),
    ativo: dados.ativo !== false,
    operadorNome: dados.operadorNome || '',
    operadorEmail: dados.operadorEmail || '',
    criadoEm: agora,
    atualizadoEm: agora,
  })

  if (isConfigured && db) {
    const programacaoRef = await addDoc(collection(db, 'programacoesViagem'), {
      ...payload,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
    return { id: programacaoRef.id, ...payload }
  }

  const store = readStore()
  const programacao = {
    id: `programacao-${Date.now()}`,
    ...payload,
  }
  store.programacoesViagem = [...(store.programacoesViagem || []), programacao]
  writeStore(store)
  return programacao
}

export async function listarProgramacoesViagemPage({
  empresaId = '',
  empresaNome = '',
  maxResults = 12,
  cursor = null,
} = {}) {
  return listCollectionPage('programacoesViagem', {
    orderField: 'criadoEm',
    orderDirection: 'desc',
    maxResults,
    cursor,
    empresaId,
    empresaNome,
  })
}

export async function listarProgramacoesViagemAtivas({ empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    const constraints = [where('ativo', '==', true)]

    if (empresaId) {
      constraints.push(where('empresaId', '==', empresaId))
    }

    const snapshot = await getDocs(query(collection(db, 'programacoesViagem'), ...constraints, limit(60)))
    return filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome)
      .sort((a, b) => String(a.origem || '').localeCompare(String(b.origem || '')) || String(a.embarcacaoNome || '').localeCompare(String(b.embarcacaoNome || '')))
  }

  return filterItemsByEmpresa(readStore().programacoesViagem || [], empresaId, empresaNome)
    .filter((item) => item.ativo !== false)
    .sort((a, b) => String(a.origem || '').localeCompare(String(b.origem || '')) || String(a.embarcacaoNome || '').localeCompare(String(b.embarcacaoNome || '')))
}

export async function listarOpcoesViagemPassagem({ dataViagem = '', empresaId = '', empresaNome = '' } = {}) {
  if (!dataViagem) {
    return []
  }

  const [programacoes, viagensExistentes] = await Promise.all([
    listarProgramacoesViagemAtivas({ empresaId, empresaNome }),
    listarViagens({ empresaId, empresaNome, dataViagem }),
  ])

  const viagensMap = new Map()
  for (const viagem of viagensExistentes) {
    if (['Cancelada', 'Finalizada'].includes(viagem.status)) {
      continue
    }

    const key = gerarViagemProgramadaId(
      viagem.programacaoViagemId || viagem.rotaId || viagem.embarcacaoId || viagem.id,
      viagem.dataViagem,
      viagem.horarioSaida,
      viagem.rotaId,
      viagem.embarcacaoId,
    )
    viagensMap.set(key, viagem)
  }

  return programacoes
    .flatMap((programacao) =>
      normalizarListaHorarios(programacao.horariosSaida).map((horarioSaida) => {
        const viagemId = gerarViagemProgramadaId(programacao.id, dataViagem, horarioSaida, programacao.rotaId, programacao.embarcacaoId)
        const existente = viagensMap.get(viagemId) || null

        return existente || {
          id: viagemId,
          programacaoViagemId: programacao.id,
          rotaId: programacao.rotaId || '',
          origem: programacao.origem || '',
          destino: programacao.destino || '',
          terminalOrigem: programacao.terminalOrigem || '',
          terminalDestino: programacao.terminalDestino || '',
          embarcacaoId: programacao.embarcacaoId || '',
          embarcacaoNome: programacao.embarcacaoNome || '',
          dataViagem,
          horarioSaida,
          horarioChegadaPrevisto: calcularChegadaPrevistaViagem(dataViagem, horarioSaida, programacao.duracaoMinutos),
          capacidadeTotal: Number(programacao.capacidadeTotal || 0),
          vagasVendidas: 0,
          vagasDisponiveis: Number(programacao.capacidadeTotal || 0),
          valorPadrao: Number(programacao.valorPadrao || 0),
          status: 'Fechada',
          duracaoMinutos: Number(programacao.duracaoMinutos || 0),
          origemProgramacao: true,
        }
      }),
    )
    .sort((a, b) => String(a.horarioSaida || '').localeCompare(String(b.horarioSaida || '')) || String(a.origem || '').localeCompare(String(b.origem || '')))
}

function passagemImpactaCapacidade(dados) {
  if (typeof dados?.impactaCapacidade === 'boolean') {
    return dados.impactaCapacidade
  }

  return !isTarifaAntecipada(dados?.tarifaTipo)
}

export async function buscarViagensAbertas({ empresaId = '', empresaNome = '' } = {}) {
  if (isConfigured && db) {
    const constraints = [where('status', 'in', ['Aberta', 'Embarcando'])]

    if (empresaId) {
      constraints.push(where('empresaId', '==', empresaId))
    }

    const snapshot = await getDocs(query(collection(db, 'viagens'), ...constraints, limit(40)))
    return filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome)
      .sort((a, b) => String(a.dataViagem || '').localeCompare(String(b.dataViagem || '')) || String(a.horarioSaida || '').localeCompare(String(b.horarioSaida || '')))
  }

  const items = await listCollectionOnce('viagens', { empresaId, empresaNome })
  return items
    .filter((item) => ['Aberta', 'Embarcando'].includes(item.status))
    .sort((a, b) => String(a.dataViagem || '').localeCompare(String(b.dataViagem || '')) || String(a.horarioSaida || '').localeCompare(String(b.horarioSaida || '')))
}

export async function listarViagensPage({
  empresaId = '',
  empresaNome = '',
  status = '',
  dataViagem = '',
  searchTerm = '',
  maxResults = 12,
  cursor = null,
} = {}) {
  const term = String(searchTerm || '').trim().toLowerCase()

  if (!term) {
    if (isConfigured && db) {
      const constraints = []

      if (empresaId) {
        constraints.push(where('empresaId', '==', empresaId))
      }

      if (status) {
        constraints.push(where('status', '==', status))
      }

      if (dataViagem) {
        constraints.push(where('dataViagem', '==', dataViagem))
      }

      constraints.push(orderBy('dataViagem', 'desc'))

      if (cursor) {
        constraints.push(startAfter(cursor))
      }

      constraints.push(limit(maxResults))

      const snapshot = await getDocs(query(collection(db, 'viagens'), ...constraints))

      return {
        items: filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome),
        cursor: snapshot.docs.at(-1) || null,
        hasMore: snapshot.docs.length === maxResults,
      }
    }

    return listCollectionPage('viagens', {
      orderField: 'dataViagem',
      orderDirection: 'desc',
      maxResults,
      cursor,
      empresaId,
      empresaNome,
    })
  }

  if (isConfigured && db) {
    const constraints = []

    if (empresaId) {
      constraints.push(where('empresaId', '==', empresaId))
    }

    if (status) {
      constraints.push(where('status', '==', status))
    }

    if (dataViagem) {
      constraints.push(where('dataViagem', '==', dataViagem))
    }

    const snapshot = await getDocs(query(collection(db, 'viagens'), ...constraints))
    const sortedItems = filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome)
      .filter((item) =>
        !term
          ? true
          : String(item.origem || '').toLowerCase().includes(term) ||
            String(item.destino || '').toLowerCase().includes(term) ||
            String(item.embarcacaoNome || '').toLowerCase().includes(term) ||
            String(item.codigoViagem || '').toLowerCase().includes(term),
      )
      .sort((a, b) => String(b.dataViagem || '').localeCompare(String(a.dataViagem || '')) || String(a.horarioSaida || '').localeCompare(String(b.horarioSaida || '')))
    const startIndex = Number.isFinite(Number(cursor)) ? Number(cursor) : 0
    const items = sortedItems.slice(startIndex, startIndex + maxResults)
    const nextCursor = startIndex + items.length

    return {
      items,
      cursor: nextCursor < sortedItems.length ? nextCursor : null,
      hasMore: nextCursor < sortedItems.length,
    }
  }

  const sortedItems = filterItemsByEmpresa(readStore().viagens || [], empresaId, empresaNome)
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
    .filter((item) =>
      !term
        ? true
        : String(item.origem || '').toLowerCase().includes(term) ||
          String(item.destino || '').toLowerCase().includes(term) ||
          String(item.embarcacaoNome || '').toLowerCase().includes(term) ||
          String(item.codigoViagem || '').toLowerCase().includes(term),
    )
    .sort((a, b) => String(b.dataViagem || '').localeCompare(String(a.dataViagem || '')) || String(a.horarioSaida || '').localeCompare(String(b.horarioSaida || '')))
  const startIndex = Number.isFinite(Number(cursor)) ? Number(cursor) : 0
  const items = sortedItems.slice(startIndex, startIndex + maxResults)
  const nextCursor = startIndex + items.length

  return {
    items,
    cursor: nextCursor < sortedItems.length ? nextCursor : null,
    hasMore: nextCursor < sortedItems.length,
  }
}

export async function getPassagensResumo({ empresaId = '', empresaNome = '', dataViagem = '', dataInicial = '', dataFinal = '' } = {}) {
  const [passagens, viagens] = await Promise.all([
    listCollectionOnce('passagens', { empresaId, empresaNome }),
    listCollectionOnce('viagens', { empresaId, empresaNome }),
  ])

  const periodoInicial = String(dataInicial || dataViagem || '').trim()
  const periodoFinal = String(dataFinal || dataViagem || '').trim()
  const hasPeriodFilter = Boolean(periodoInicial || periodoFinal)
  const isDateInPeriod = (value = '') => {
    const normalized = String(value || '').trim()

    if (!normalized) {
      return false
    }

    if (periodoInicial && normalized < periodoInicial) {
      return false
    }

    if (periodoFinal && normalized > periodoFinal) {
      return false
    }

    return true
  }

  const passagensFiltradas = hasPeriodFilter
    ? passagens.filter((item) => isDateInPeriod(item?.dataViagem))
    : passagens
  const viagensFiltradas = hasPeriodFilter
    ? viagens.filter((item) => isDateInPeriod(item?.dataViagem))
    : viagens

  return computePassagensAnalytics(passagensFiltradas, viagensFiltradas)
}

export async function getViagemById(viagemId, { empresaId = '', empresaNome = '' } = {}) {
  if (!viagemId) {
    return null
  }

  if (isConfigured && db) {
    const snapshot = await getDoc(doc(db, 'viagens', viagemId))
    if (!snapshot.exists()) {
      return null
    }

    const item = { id: snapshot.id, ...snapshot.data() }
    return filterItemsByEmpresa([item], empresaId, empresaNome)[0] || null
  }

  const store = readStore()
  return filterItemsByEmpresa((store.viagens || []).filter((item) => item.id === viagemId), empresaId, empresaNome)[0] || null
}

export async function abrirVendaPassagemHorario(dados) {
  const viagemId = dados.viagemId || gerarViagemOperacionalId(dados)
  const agora = new Date().toISOString()
  const caixaAbertoAtual = await obterCaixaPassagemAberto({
    empresaId: dados.empresaId || '',
    empresaNome: dados.empresaNome || '',
  })

  if (caixaAbertoAtual && caixaAbertoAtual.id !== viagemId) {
    throw new Error(`Ja existe um caixa aberto para ${caixaAbertoAtual.embarcacaoNome || 'outra embarcacao'} em ${caixaAbertoAtual.dataViagem || '-'} ${caixaAbertoAtual.horarioSaida || ''}. Feche esse caixa antes de abrir o proximo.`)
  }

  const viagemAtual = await getViagemById(viagemId, { empresaId: dados.empresaId || '', empresaNome: dados.empresaNome || '' })

  const payload = montarPayloadViagemProgramada({
    id: viagemId,
    codigoViagem: viagemAtual?.codigoViagem || dados.codigoViagem || gerarCodigoViagem(),
    origemOperacao: 'passagens',
    programacaoViagemId: dados.programacaoViagemId || viagemAtual?.programacaoViagemId || '',
    empresaId: dados.empresaId || viagemAtual?.empresaId || '',
    empresaNome: dados.empresaNome || viagemAtual?.empresaNome || '',
    rotaId: dados.rotaId || viagemAtual?.rotaId || '',
    origem: dados.origem || viagemAtual?.origem || '',
    destino: dados.destino || viagemAtual?.destino || '',
    terminalOrigem: dados.terminalOrigem || viagemAtual?.terminalOrigem || '',
    terminalDestino: dados.terminalDestino || viagemAtual?.terminalDestino || '',
    embarcacaoId: dados.embarcacaoId || viagemAtual?.embarcacaoId || '',
    embarcacaoNome: dados.embarcacaoNome || viagemAtual?.embarcacaoNome || '',
    dataViagem: dados.dataViagem || viagemAtual?.dataViagem || '',
    horarioSaida: dados.horarioSaida || viagemAtual?.horarioSaida || '',
    capacidadeTotal: Number(dados.capacidadeTotal || viagemAtual?.capacidadeTotal || 0),
    vagasVendidas: Number(viagemAtual?.vagasVendidas || 0),
    valorPadrao: Number(dados.valorPadrao || viagemAtual?.valorPadrao || 0),
    duracaoMinutos: Number(dados.duracaoMinutos || viagemAtual?.duracaoMinutos || 0),
    status: 'Aberta',
    operadorNome: dados.operadorNome || '',
    operadorEmail: dados.operadorEmail || '',
    criadoEm: viagemAtual?.criadoEm || agora,
    atualizadoEm: agora,
  })

  const viagem = {
    ...viagemAtual,
    ...payload,
    caixaAbertoEm: agora,
    caixaAbertoPorNome: dados.operadorNome || '',
    caixaFechadoEm: null,
    caixaFechadoPorNome: '',
  }

  if (isConfigured && db) {
    await setDoc(doc(db, 'viagens', viagemId), {
      ...viagem,
      criadoEm: viagemAtual ? viagemAtual.criadoEm || serverTimestamp() : serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      caixaAbertoEm: serverTimestamp(),
    }, { merge: true })

    if (shouldUseFirestoreQueuedWrites()) {
      enqueueOfflineAction({
        type: 'abertura_caixa_passagem',
        details: `Abertura offline do caixa da viagem ${viagemId}.`,
        payload: {
          viagemId,
          empresaId: dados.empresaId || '',
          empresaNome: dados.empresaNome || '',
        },
      })
    }
  } else {
    const store = readStore()
    store.viagens = [
      ...(store.viagens || []).filter((item) => item.id !== viagemId),
      viagem,
    ]
    writeStore(store)
  }

  return viagem
}

export async function encerrarVendaPassagemHorario(viagemId, actor = {}) {
  if (!viagemId) {
    throw new Error('Selecione um horario para encerrar o caixa.')
  }

  const viagem = await getViagemById(viagemId, { empresaId: actor.empresaId || '', empresaNome: actor.empresaNome || '' })

  if (!viagem) {
    throw new Error('Horario nao encontrado para encerramento.')
  }

  const fechadoEm = new Date().toISOString()
  const passagens = await listarPassagensPorViagem(viagemId, { empresaId: actor.empresaId || '', empresaNome: actor.empresaNome || '' })
  const resumo = {
    fechadoEm,
    totalArrecadado: passagens
      .filter((item) => item.status !== 'Cancelada')
      .reduce((total, item) => total + Number(item.valor || 0), 0),
    passagensDoHorario: passagens.filter((item) => item.status !== 'Cancelada' && passagemImpactaCapacidade(item)).length,
    passagensAntecipadas: passagens.filter((item) => item.status !== 'Cancelada' && !passagemImpactaCapacidade(item)).length,
    passagensCanceladas: passagens.filter((item) => item.status === 'Cancelada').length,
  }

  if (isConfigured && db) {
    await updateDoc(doc(db, 'viagens', viagemId), {
      status: 'Fechada',
      caixaFechadoEm: serverTimestamp(),
      caixaFechadoPorNome: actor.operadorNome || '',
      atualizadoEm: serverTimestamp(),
    })

    if (shouldUseFirestoreQueuedWrites()) {
      enqueueOfflineAction({
        type: 'fechamento_caixa_passagem',
        details: `Fechamento offline do caixa da viagem ${viagemId}.`,
        payload: {
          viagemId,
          empresaId: actor.empresaId || '',
          empresaNome: actor.empresaNome || '',
        },
      })
    }
  } else {
    const store = readStore()
    store.viagens = (store.viagens || []).map((item) =>
      item.id === viagemId
        ? {
            ...item,
            status: 'Fechada',
            caixaFechadoEm: fechadoEm,
            caixaFechadoPorNome: actor.operadorNome || '',
            atualizadoEm: fechadoEm,
          }
        : item,
    )
    writeStore(store)
  }

  return {
    viagem: {
      ...viagem,
      status: 'Fechada',
      caixaFechadoEm: fechadoEm,
      caixaFechadoPorNome: actor.operadorNome || '',
      atualizadoEm: fechadoEm,
    },
    passagens,
    resumo,
  }
}

function compararDataDesc(left, right) {
  const leftDate = getDateFromUnknownValue(left)
  const rightDate = getDateFromUnknownValue(right)

  if (!leftDate && !rightDate) {
    return 0
  }

  if (!leftDate) {
    return 1
  }

  if (!rightDate) {
    return -1
  }

  return rightDate.getTime() - leftDate.getTime()
}

export function montarResumoVendaPassagemHorario(viagem, passagens = []) {
  const fechadoEm = viagem?.caixaFechadoEm || viagem?.atualizadoEm || null

  return {
    viagem,
    passagens,
    resumo: {
      abertoEm: viagem?.caixaAbertoEm || null,
      fechadoEm,
      totalArrecadado: passagens
        .filter((item) => item.status !== 'Cancelada')
        .reduce((total, item) => total + Number(item.valor || 0), 0),
      passagensDoHorario: passagens.filter((item) => item.status !== 'Cancelada' && passagemImpactaCapacidade(item)).length,
      passagensAntecipadas: passagens.filter((item) => item.status !== 'Cancelada' && !passagemImpactaCapacidade(item)).length,
      passagensCanceladas: passagens.filter((item) => item.status === 'Cancelada').length,
    },
  }
}

export async function obterResumoVendaPassagemHorario(viagemId, { empresaId = '', empresaNome = '' } = {}) {
  const viagem = await getViagemById(viagemId, { empresaId, empresaNome })

  if (!viagem) {
    throw new Error('Viagem nao encontrada.')
  }

  const passagens = await listarPassagensPorViagem(viagemId, { empresaId, empresaNome })
  return montarResumoVendaPassagemHorario(viagem, passagens)
}

export async function listarCaixasPassagemAbertos({ empresaId = '', empresaNome = '' } = {}) {
  const viagens = await listCollectionOnce('viagens', { empresaId, empresaNome })

  return viagens
    .filter((item) => isCaixaPassagemAberto(item))
    .sort((a, b) => {
      const comparacaoAbertura = compararDataDesc(a?.caixaAbertoEm, b?.caixaAbertoEm)

      if (comparacaoAbertura !== 0) {
        return comparacaoAbertura
      }

      return String(b?.horarioSaida || '').localeCompare(String(a?.horarioSaida || ''))
    })
}

export async function obterCaixaPassagemAberto({ empresaId = '', empresaNome = '' } = {}) {
  const itens = await listarCaixasPassagemAbertos({ empresaId, empresaNome })
  return itens[0] || null
}

export async function listarHistoricoCaixasPassagem({ empresaId = '', empresaNome = '', dataViagem = '' } = {}) {
  const viagens = await listCollectionOnce('viagens', { empresaId, empresaNome })

  return viagens
    .filter((item) => isHistoricoCaixaPassagemFechado(item))
    .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
    .sort((a, b) => {
      const comparacaoAbertura = compararDataDesc(a?.caixaAbertoEm, b?.caixaAbertoEm)

      if (comparacaoAbertura !== 0) {
        return comparacaoAbertura
      }

      return String(b?.horarioSaida || '').localeCompare(String(a?.horarioSaida || ''))
    })
}

export async function criarPassageiro(dados) {
  const agora = new Date().toISOString()
  const payload = prepareCollectionPayload('passageiros', {
    empresaId: dados.empresaId || '',
    empresaNome: dados.empresaNome || '',
    nome: String(dados.nome || '').trim(),
    telefone: String(dados.telefone || '').trim(),
    documento: normalizarDocumento(dados.documento),
    email: String(dados.email || '').trim(),
    tipo: dados.tipo || 'Adulto',
    criadoEm: agora,
    atualizadoEm: agora,
  })

  if (isConfigured && db) {
    const passageiroRef = await addDoc(collection(db, 'passageiros'), {
      ...payload,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
    return { id: passageiroRef.id, ...payload }
  }

  const store = readStore()
  const passageiro = {
    id: `passageiro-${Date.now()}`,
    ...payload,
  }
  store.passageiros = [...(store.passageiros || []), passageiro]
  writeStore(store)
  return passageiro
}

export async function buscarPassageiros(searchTerm, maxResults = 8, { empresaId = '', empresaNome = '' } = {}) {
  const term = String(searchTerm || '').trim()

  if (!term) {
    return []
  }

  const normalizedDocumento = normalizarDocumento(term)
  const [porNome, porDocumento] = await Promise.all([
    searchCollectionByField('passageiros', 'nome', term, maxResults, { empresaId, empresaNome }),
    normalizedDocumento
      ? searchCollectionByField('passageiros', 'documentoBusca', normalizedDocumento, maxResults, { empresaId, empresaNome })
      : Promise.resolve([]),
  ])

  const results = new Map()
  for (const item of [...porNome, ...porDocumento]) {
    results.set(item.id, item)
  }

  return [...results.values()].slice(0, maxResults)
}

async function encontrarOuCriarPassageiro(dados) {
  const empresaId = dados.empresaId || ''
  const empresaNome = dados.empresaNome || ''
  const documento = normalizarDocumento(dados.documento)

  if (documento) {
    const encontrados = await searchCollectionByField('passageiros', 'documentoBusca', documento, 1, { empresaId, empresaNome })
    if (encontrados[0]) {
      return encontrados[0]
    }
  }

  const nome = String(dados.nome || '').trim()
  if (nome) {
    const encontrados = await searchCollectionByField('passageiros', 'nome', nome, 5, { empresaId, empresaNome })
    const existente = encontrados.find((item) => String(item.nome || '').trim().toLowerCase() === nome.toLowerCase())
    if (existente) {
      return existente
    }
  }

  return criarPassageiro(dados)
}

export async function venderPassagem(dados) {
  const empresaId = dados.empresaId || ''
  const empresaNome = dados.empresaNome || ''
  const viagemId = dados.viagemId || gerarViagemOperacionalId(dados)
  const impactaCapacidade = passagemImpactaCapacidade(dados)
  const passageiro = await encontrarOuCriarPassageiro({
    empresaId,
    empresaNome,
    nome: dados.passageiroNome,
    telefone: dados.passageiroTelefone,
    documento: dados.passageiroDocumento,
    email: dados.passageiroEmail,
    tipo: dados.tipoPassageiro || 'Adulto',
  })
  const codigo = await gerarCodigoPassagem(obterUltimoCodigoPassagemPorPrefixo)
  const qrTargetUrl = montarUrlEmbarquePassagem(codigo)
  const qrCodeDataUrl = dados.qrCodeDataUrl || ''
  const agora = new Date().toISOString()
  const { gerarQRCode } = await import('../utils/gerarQRCode.js')
  const qrGerado = qrCodeDataUrl || await gerarQRCode(qrTargetUrl)

  if (isConfigured && db) {
    if (shouldUseFirestoreQueuedWrites()) {
      const viagemAtual = await getViagemById(viagemId, { empresaId, empresaNome })
      const viagemRef = doc(db, 'viagens', viagemId)
      const passagemRef = doc(db, 'passagens', `passagem-${Date.now()}`)
      const caixaRef = doc(collection(db, 'caixa'))
      const batch = writeBatch(db)

      const viagemBase = viagemAtual || montarPayloadViagemProgramada({
        id: viagemId,
        codigoViagem: dados.codigoViagem || gerarCodigoViagem(),
        origemOperacao: 'passagens',
        programacaoViagemId: dados.programacaoViagemId || '',
        empresaId,
        empresaNome,
        rotaId: dados.rotaId || '',
        origem: dados.origem || '',
        destino: dados.destino || '',
        terminalOrigem: dados.terminalOrigem || '',
        terminalDestino: dados.terminalDestino || '',
        embarcacaoId: dados.embarcacaoId || '',
        embarcacaoNome: dados.embarcacaoNome || '',
        dataViagem: dados.dataViagem || '',
        horarioSaida: dados.horarioSaida || '',
        capacidadeTotal: Number(dados.capacidadeTotal || 0),
        valorPadrao: Number(dados.valor || dados.valorPadrao || 0),
        duracaoMinutos: Number(dados.duracaoMinutos || 0),
        status: 'Aberta',
        operadorNome: dados.operadorNome || '',
        operadorEmail: dados.operadorEmail || '',
      })

      if (!['Aberta', 'Embarcando'].includes(viagemBase.status)) {
        throw new Error('A viagem nao esta disponivel para venda.')
      }

      if (impactaCapacidade && Number(viagemBase.vagasDisponiveis || 0) <= 0) {
        throw new Error('Nao ha vagas disponiveis para esta viagem.')
      }

      const passagemPayload = prepareCollectionPayload('passagens', {
        id: passagemRef.id,
        codigo,
        empresaId,
        empresaNome,
        viagemId,
        rotaId: dados.rotaId || viagemBase.rotaId || '',
        origem: dados.origem || viagemBase.origem || '',
        destino: dados.destino || viagemBase.destino || '',
        terminalOrigem: dados.terminalOrigem || viagemBase.terminalOrigem || '',
        terminalDestino: dados.terminalDestino || viagemBase.terminalDestino || '',
        embarcacaoId: dados.embarcacaoId || viagemBase.embarcacaoId || '',
        embarcacaoNome: dados.embarcacaoNome || viagemBase.embarcacaoNome || '',
        dataViagem: dados.dataViagem || viagemBase.dataViagem || '',
        horarioSaida: dados.horarioSaida || viagemBase.horarioSaida || '',
        passageiroId: passageiro.id,
        passageiroNome: passageiro.nome || dados.passageiroNome || '',
        passageiroDocumento: normalizarDocumento(passageiro.documento || dados.passageiroDocumento),
        passageiroTelefone: passageiro.telefone || dados.passageiroTelefone || '',
        tarifaTipo: dados.tarifaTipo || 'Inteira',
        impactaCapacidade,
        valor: Number(dados.valor || 0),
        formaPagamento: dados.formaPagamento || 'Dinheiro',
        status: 'Vendida',
        qrCodeDataUrl: qrGerado,
        bilheteUrl: qrTargetUrl,
        operadorNome: dados.operadorNome || '',
        operadorEmail: dados.operadorEmail || '',
        criadoEm: agora,
        atualizadoEm: agora,
      })

      batch.set(passagemRef, passagemPayload)
      batch.set(caixaRef, {
        tipo: 'entrada',
        origem: 'Venda de passagem',
        passagemCodigo: codigo,
        viagemId,
        valor: Number(dados.valor || 0),
        formaPagamento: dados.formaPagamento || 'Dinheiro',
        empresaId,
        empresaNome,
        criadoEm: agora,
      })
      batch.set(viagemRef, {
        ...viagemBase,
        atualizadoEm: agora,
        vagasVendidas: impactaCapacidade ? Number(viagemBase.vagasVendidas || 0) + 1 : Number(viagemBase.vagasVendidas || 0),
        vagasDisponiveis: impactaCapacidade ? Math.max(0, Number(viagemBase.vagasDisponiveis || 0) - 1) : Number(viagemBase.vagasDisponiveis || 0),
      }, { merge: true })
      await batch.commit()

      await ajustarResumoCaixa({
        deltaEntrada: Number(dados.valor || 0),
        deltaRegistros: 1,
      })
      await registrarLogUso({
        acao: 'passagem_vendida',
        detalhes: `Passagem ${codigo} vendida para ${passageiro.nome || dados.passageiroNome || 'passageiro'}.`,
        user: {
          nome: dados.operadorNome || '',
          email: dados.operadorEmail || '',
          empresaId,
          empresaNome,
        },
        empresaId,
        empresaNome,
      })

      enqueueOfflineAction({
        type: 'venda_passagem',
        details: `Venda offline da passagem ${codigo}.`,
        payload: {
          passagemCodigo: codigo,
          viagemId,
          impactaCapacidade,
          empresaId,
          empresaNome,
        },
      })

      return passagemPayload
    }

    const viagemRef = doc(db, 'viagens', viagemId)
    const passagemRef = doc(collection(db, 'passagens'))
    const caixaRef = doc(collection(db, 'caixa'))

    await runTransaction(db, async (transaction) => {
      const viagemSnapshot = await transaction.get(viagemRef)
      let viagem = viagemSnapshot.exists() ? viagemSnapshot.data() : null

      if (!viagem) {
        viagem = montarPayloadViagemProgramada({
          id: viagemId,
          codigoViagem: dados.codigoViagem || gerarCodigoViagem(),
          origemOperacao: 'passagens',
          programacaoViagemId: dados.programacaoViagemId || '',
          empresaId,
          empresaNome,
          rotaId: dados.rotaId || '',
          origem: dados.origem || '',
          destino: dados.destino || '',
          terminalOrigem: dados.terminalOrigem || '',
          terminalDestino: dados.terminalDestino || '',
          embarcacaoId: dados.embarcacaoId || '',
          embarcacaoNome: dados.embarcacaoNome || '',
          dataViagem: dados.dataViagem || '',
          horarioSaida: dados.horarioSaida || '',
          capacidadeTotal: Number(dados.capacidadeTotal || 0),
          valorPadrao: Number(dados.valor || dados.valorPadrao || 0),
          duracaoMinutos: Number(dados.duracaoMinutos || 0),
          status: 'Aberta',
          operadorNome: dados.operadorNome || '',
          operadorEmail: dados.operadorEmail || '',
        })

        transaction.set(viagemRef, {
          ...viagem,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        })
      }

      const vagasDisponiveis = Number(viagem.vagasDisponiveis || 0)

      if (!['Aberta', 'Embarcando'].includes(viagem.status)) {
        throw new Error('A viagem nao esta disponivel para venda.')
      }

      if (impactaCapacidade && vagasDisponiveis <= 0) {
        throw new Error('Nao ha vagas disponiveis para esta viagem.')
      }

      transaction.set(passagemRef, {
        codigo,
        codigoBusca: normalizeSearchValue(codigo, { upper: true }),
        empresaId,
        empresaNome,
        viagemId,
        rotaId: dados.rotaId || viagem.rotaId || '',
        origem: dados.origem || viagem.origem || '',
        destino: dados.destino || viagem.destino || '',
        terminalOrigem: dados.terminalOrigem || viagem.terminalOrigem || '',
        terminalDestino: dados.terminalDestino || viagem.terminalDestino || '',
        embarcacaoId: dados.embarcacaoId || viagem.embarcacaoId || '',
        embarcacaoNome: dados.embarcacaoNome || viagem.embarcacaoNome || '',
        dataViagem: dados.dataViagem || viagem.dataViagem || '',
        horarioSaida: dados.horarioSaida || viagem.horarioSaida || '',
        passageiroId: passageiro.id,
        passageiroNome: passageiro.nome || dados.passageiroNome || '',
        passageiroBusca: normalizeSearchValue(passageiro.nome || dados.passageiroNome || ''),
        passageiroDocumento: normalizarDocumento(passageiro.documento || dados.passageiroDocumento),
        documentoBusca: normalizeSearchValue(normalizarDocumento(passageiro.documento || dados.passageiroDocumento)),
        passageiroTelefone: passageiro.telefone || dados.passageiroTelefone || '',
        tarifaTipo: dados.tarifaTipo || 'Inteira',
        impactaCapacidade,
        valor: Number(dados.valor || 0),
        formaPagamento: dados.formaPagamento || 'Dinheiro',
        status: 'Vendida',
        qrCodeDataUrl: qrGerado,
        bilheteUrl: qrTargetUrl,
        operadorNome: dados.operadorNome || '',
        operadorEmail: dados.operadorEmail || '',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })

      transaction.set(caixaRef, {
        tipo: 'entrada',
        origem: 'Venda de passagem',
        passagemCodigo: codigo,
        viagemId,
        valor: Number(dados.valor || 0),
        formaPagamento: dados.formaPagamento || 'Dinheiro',
        empresaId,
        empresaNome,
        criadoEm: serverTimestamp(),
      })

      const payloadAtualizacaoViagem = {
        atualizadoEm: serverTimestamp(),
      }

      if (impactaCapacidade) {
        payloadAtualizacaoViagem.vagasVendidas = increment(1)
        payloadAtualizacaoViagem.vagasDisponiveis = increment(-1)
      }

      transaction.update(viagemRef, payloadAtualizacaoViagem)
    })

    await ajustarResumoCaixa({
      deltaEntrada: Number(dados.valor || 0),
      deltaRegistros: 1,
    })
    await registrarLogUso({
      acao: 'passagem_vendida',
      detalhes: `Passagem ${codigo} vendida para ${passageiro.nome || dados.passageiroNome || 'passageiro'}.`,
      user: {
        nome: dados.operadorNome || '',
        email: dados.operadorEmail || '',
        empresaId,
        empresaNome,
      },
      empresaId,
      empresaNome,
    })

    return {
      id: passagemRef.id,
      codigo,
      empresaId,
      empresaNome,
      viagemId,
      rotaId: dados.rotaId || '',
      origem: dados.origem || '',
      destino: dados.destino || '',
      terminalOrigem: dados.terminalOrigem || '',
      terminalDestino: dados.terminalDestino || '',
      embarcacaoId: dados.embarcacaoId || '',
      embarcacaoNome: dados.embarcacaoNome || '',
      dataViagem: dados.dataViagem || '',
      horarioSaida: dados.horarioSaida || '',
      passageiroId: passageiro.id,
      passageiroNome: passageiro.nome || dados.passageiroNome || '',
      passageiroDocumento: normalizarDocumento(passageiro.documento || dados.passageiroDocumento),
      passageiroTelefone: passageiro.telefone || dados.passageiroTelefone || '',
      tarifaTipo: dados.tarifaTipo || 'Inteira',
      impactaCapacidade,
      valor: Number(dados.valor || 0),
      formaPagamento: dados.formaPagamento || 'Dinheiro',
      status: 'Vendida',
      qrCodeDataUrl: qrGerado,
      bilheteUrl: qrTargetUrl,
      operadorNome: dados.operadorNome || '',
      operadorEmail: dados.operadorEmail || '',
      criadoEm: agora,
      atualizadoEm: agora,
    }
  }

  const store = readStore()
  let viagemIndex = (store.viagens || []).findIndex((item) => item.id === viagemId)

  if (viagemIndex < 0) {
    const viagemCriada = {
      id: viagemId,
      ...montarPayloadViagemProgramada({
        id: viagemId,
        codigoViagem: dados.codigoViagem || gerarCodigoViagem(),
        origemOperacao: 'passagens',
        programacaoViagemId: dados.programacaoViagemId || '',
        empresaId,
        empresaNome,
        rotaId: dados.rotaId || '',
        origem: dados.origem || '',
        destino: dados.destino || '',
        terminalOrigem: dados.terminalOrigem || '',
        terminalDestino: dados.terminalDestino || '',
        embarcacaoId: dados.embarcacaoId || '',
        embarcacaoNome: dados.embarcacaoNome || '',
        dataViagem: dados.dataViagem || '',
        horarioSaida: dados.horarioSaida || '',
        capacidadeTotal: Number(dados.capacidadeTotal || 0),
        valorPadrao: Number(dados.valor || dados.valorPadrao || 0),
        duracaoMinutos: Number(dados.duracaoMinutos || 0),
        status: 'Aberta',
        operadorNome: dados.operadorNome || '',
        operadorEmail: dados.operadorEmail || '',
      }),
    }

    store.viagens = [...(store.viagens || []), viagemCriada]
    viagemIndex = store.viagens.length - 1
  }

  const viagemAtual = store.viagens[viagemIndex]
  if (!['Aberta', 'Embarcando'].includes(viagemAtual.status)) {
    throw new Error('A viagem nao esta disponivel para venda.')
  }

  if (impactaCapacidade && Number(viagemAtual.vagasDisponiveis || 0) <= 0) {
    throw new Error('Nao ha vagas disponiveis para esta viagem.')
  }

  const passagem = prepareCollectionPayload('passagens', {
    id: `passagem-${Date.now()}`,
    codigo,
    empresaId,
    empresaNome,
    viagemId,
    rotaId: dados.rotaId || viagemAtual.rotaId || '',
    origem: dados.origem || viagemAtual.origem || '',
    destino: dados.destino || viagemAtual.destino || '',
    terminalOrigem: dados.terminalOrigem || viagemAtual.terminalOrigem || '',
    terminalDestino: dados.terminalDestino || viagemAtual.terminalDestino || '',
    embarcacaoId: dados.embarcacaoId || viagemAtual.embarcacaoId || '',
    embarcacaoNome: dados.embarcacaoNome || viagemAtual.embarcacaoNome || '',
    dataViagem: dados.dataViagem || viagemAtual.dataViagem || '',
    horarioSaida: dados.horarioSaida || viagemAtual.horarioSaida || '',
    passageiroId: passageiro.id,
    passageiroNome: passageiro.nome || dados.passageiroNome || '',
    passageiroDocumento: normalizarDocumento(passageiro.documento || dados.passageiroDocumento),
    passageiroTelefone: passageiro.telefone || dados.passageiroTelefone || '',
    tarifaTipo: dados.tarifaTipo || 'Inteira',
    impactaCapacidade,
    valor: Number(dados.valor || 0),
    formaPagamento: dados.formaPagamento || 'Dinheiro',
    status: 'Vendida',
    qrCodeDataUrl: qrGerado,
    bilheteUrl: qrTargetUrl,
    operadorNome: dados.operadorNome || '',
    operadorEmail: dados.operadorEmail || '',
    criadoEm: agora,
    atualizadoEm: agora,
  })

  store.passagens = [...(store.passagens || []), passagem]
  store.caixa = [
    ...(store.caixa || []),
    {
      id: `caixa-${Date.now()}`,
      tipo: 'entrada',
      origem: 'Venda de passagem',
      passagemCodigo: codigo,
      viagemId,
      valor: Number(dados.valor || 0),
      formaPagamento: dados.formaPagamento || 'Dinheiro',
      empresaId,
      empresaNome,
      criadoEm: agora,
    },
  ]
  store.viagens[viagemIndex] = {
    ...viagemAtual,
    vagasVendidas: impactaCapacidade ? Number(viagemAtual.vagasVendidas || 0) + 1 : Number(viagemAtual.vagasVendidas || 0),
    vagasDisponiveis: impactaCapacidade ? Math.max(0, Number(viagemAtual.vagasDisponiveis || 0) - 1) : Number(viagemAtual.vagasDisponiveis || 0),
    atualizadoEm: agora,
  }

  const resumoAtual = garantirResumoCaixaLocal(store)
  resumoAtual.totalEntrada = Number(resumoAtual.totalEntrada || 0) + Number(dados.valor || 0)
  resumoAtual.totalRegistros = Number(resumoAtual.totalRegistros || 0) + 1
  writeStore(store)

  return passagem
}

export async function listarPassagens({ empresaId = '', empresaNome = '', searchTerm = '', viagemId = '', dataViagem = '', status = '' } = {}) {
  const items = await listCollectionOnce('passagens', { empresaId, empresaNome })
  const term = String(searchTerm || '').trim().toLowerCase()
  const termDocumento = normalizarDocumento(searchTerm)

  return items
    .filter((item) => (viagemId ? item.viagemId === viagemId : true))
    .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
    .filter((item) => (status ? item.status === status : true))
    .filter((item) =>
      !term
        ? true
        : String(item.codigo || '').toLowerCase().includes(term) ||
          String(item.passageiroNome || '').toLowerCase().includes(term) ||
          String(item.passageiroDocumento || '').includes(termDocumento) ||
          String(item.origem || '').toLowerCase().includes(term) ||
          String(item.destino || '').toLowerCase().includes(term),
    )
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
}

export async function listarPassagensPage({
  empresaId = '',
  empresaNome = '',
  viagemId = '',
  dataViagem = '',
  status = '',
  maxResults = 12,
  cursor = null,
} = {}) {
  const filtrosAtivos = Boolean(viagemId || dataViagem || status)

  if (!filtrosAtivos) {
    return listCollectionPage('passagens', {
      orderField: 'criadoEm',
      orderDirection: 'desc',
      maxResults,
      cursor,
      empresaId,
      empresaNome,
    })
  }

  if (isConfigured && db) {
    const constraints = []

    if (empresaId) {
      constraints.push(where('empresaId', '==', empresaId))
    }

    if (viagemId) {
      constraints.push(where('viagemId', '==', viagemId))
    }

    if (dataViagem) {
      constraints.push(where('dataViagem', '==', dataViagem))
    }

    if (status) {
      constraints.push(where('status', '==', status))
    }

    constraints.push(orderBy('criadoEm', 'desc'))

    if (cursor) {
      constraints.push(startAfter(cursor))
    }

    constraints.push(limit(maxResults))

    const snapshot = await getDocs(query(collection(db, 'passagens'), ...constraints))

    return {
      items: filterItemsByEmpresa(mapDocs(snapshot), empresaId, empresaNome),
      cursor: snapshot.docs.at(-1) || null,
      hasMore: snapshot.docs.length === maxResults,
    }
  }

  const sortedItems = filterItemsByEmpresa(readStore().passagens || [], empresaId, empresaNome)
    .filter((item) => (viagemId ? item.viagemId === viagemId : true))
    .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
    .filter((item) => (status ? item.status === status : true))
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
  const startIndex = Number.isFinite(Number(cursor)) ? Number(cursor) : 0
  const items = sortedItems.slice(startIndex, startIndex + maxResults)
  const nextCursor = startIndex + items.length

  return {
    items,
    cursor: nextCursor < sortedItems.length ? nextCursor : null,
    hasMore: nextCursor < sortedItems.length,
  }
}

export async function buscarPassagens(searchTerm, {
  empresaId = '',
  empresaNome = '',
  viagemId = '',
  dataViagem = '',
  status = '',
  maxResults = 24,
} = {}) {
  const term = String(searchTerm || '').trim()

  if (!term) {
    const page = await listarPassagensPage({ empresaId, empresaNome, viagemId, dataViagem, status, maxResults })
    return page.items
  }

  const normalizedDocumento = normalizarDocumento(term)

  if (isConfigured && db) {
    const results = new Map()
    const codigoConstraints = []

    if (empresaId) {
      codigoConstraints.push(where('empresaId', '==', empresaId))
    }

    codigoConstraints.push(where('codigoBusca', '==', normalizeSearchValue(term, { upper: true })))
    codigoConstraints.push(limit(1))
    const codigoSnapshot = await getDocs(
      query(collection(db, 'passagens'), ...codigoConstraints),
    )

    for (const item of mapDocs(codigoSnapshot)) {
      results.set(item.id, item)
    }

    const passageiroConstraints = []

    if (empresaId) {
      passageiroConstraints.push(where('empresaId', '==', empresaId))
    }

    passageiroConstraints.push(orderBy('passageiroBusca'))
    passageiroConstraints.push(startAt(normalizeSearchValue(term)))
    passageiroConstraints.push(endAt(`${normalizeSearchValue(term)}\uf8ff`))
    passageiroConstraints.push(limit(maxResults))

    const passageiroSnapshot = await getDocs(
      query(collection(db, 'passagens'), ...passageiroConstraints),
    )

    for (const item of mapDocs(passageiroSnapshot)) {
      results.set(item.id, item)
    }

    if (normalizedDocumento) {
      const documentoConstraints = []

      if (empresaId) {
        documentoConstraints.push(where('empresaId', '==', empresaId))
      }

      documentoConstraints.push(orderBy('documentoBusca'))
      documentoConstraints.push(startAt(normalizeSearchValue(normalizedDocumento)))
      documentoConstraints.push(endAt(`${normalizeSearchValue(normalizedDocumento)}\uf8ff`))
      documentoConstraints.push(limit(maxResults))

      const documentoSnapshot = await getDocs(
        query(collection(db, 'passagens'), ...documentoConstraints),
      )

      for (const item of mapDocs(documentoSnapshot)) {
        results.set(item.id, item)
      }
    }

    return filterItemsByEmpresa([...results.values()], empresaId, empresaNome)
      .filter((item) => (viagemId ? item.viagemId === viagemId : true))
      .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
      .filter((item) => (status ? item.status === status : true))
      .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
      .slice(0, maxResults)
  }

  return filterItemsByEmpresa(readStore().passagens || [], empresaId, empresaNome)
    .filter((item) =>
      String(item.codigo || '').toLowerCase().includes(term.toLowerCase()) ||
      String(item.passageiroNome || '').toLowerCase().includes(term.toLowerCase()) ||
      String(item.passageiroDocumento || '').includes(normalizedDocumento),
    )
    .filter((item) => (viagemId ? item.viagemId === viagemId : true))
    .filter((item) => (dataViagem ? item.dataViagem === dataViagem : true))
    .filter((item) => (status ? item.status === status : true))
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
    .slice(0, maxResults)
}

export async function buscarPassagemPorCodigo(codigo, { empresaId = '', empresaNome = '' } = {}) {
  if (!codigo) {
    return null
  }

  if (isConfigured && db) {
    const snapshot = await getDocs(
      query(
        collection(db, 'passagens'),
        where('codigoBusca', '==', normalizeSearchValue(codigo, { upper: true })),
        limit(1),
      ),
    )
    const found = mapDocs(snapshot)[0] || null
    return filterItemsByEmpresa(found ? [found] : [], empresaId, empresaNome)[0] || null
  }

  const store = readStore()
  return filterItemsByEmpresa((store.passagens || []).filter((item) => item.codigo === codigo), empresaId, empresaNome)[0] || null
}

export async function cancelarPassagem(passagem, actorUser = null) {
  if (!passagem?.id) {
    throw new Error('Passagem nao encontrada.')
  }

  if (passagem.status === 'Cancelada') {
    return passagem
  }

  if (passagem.status === 'Embarcado') {
    throw new Error('Nao e possivel cancelar uma passagem ja embarcada.')
  }

  const timestamp = new Date().toISOString()
  const impactaCapacidade = passagemImpactaCapacidade(passagem)

  if (isConfigured && db) {
    if (shouldUseFirestoreQueuedWrites()) {
      const batch = writeBatch(db)
      const passagemRef = doc(db, 'passagens', passagem.id)
      const caixaRef = doc(collection(db, 'caixa'))
      const viagem = passagem.viagemId
        ? await getViagemById(passagem.viagemId, {
            empresaId: passagem.empresaId || '',
            empresaNome: passagem.empresaNome || '',
          })
        : null

      batch.update(passagemRef, {
        status: 'Cancelada',
        canceladoEm: timestamp,
        atualizadoEm: timestamp,
      })

      if (impactaCapacidade && viagem) {
        batch.set(doc(db, 'viagens', passagem.viagemId), {
          vagasVendidas: Math.max(0, Number(viagem.vagasVendidas || 0) - 1),
          vagasDisponiveis: Number(viagem.vagasDisponiveis || 0) + 1,
          atualizadoEm: timestamp,
        }, { merge: true })
      }

      batch.set(caixaRef, {
        tipo: 'entrada',
        origem: 'Estorno de passagem',
        passagemCodigo: passagem.codigo,
        viagemId: passagem.viagemId,
        valor: -Math.abs(Number(passagem.valor || 0)),
        formaPagamento: passagem.formaPagamento || 'Nao informado',
        empresaId: passagem.empresaId || '',
        empresaNome: passagem.empresaNome || '',
        criadoEm: timestamp,
      })
      await batch.commit()

      await ajustarResumoCaixa({
        deltaEntrada: -Math.abs(Number(passagem.valor || 0)),
        deltaRegistros: 1,
      })
      await registrarLogUso({
        acao: 'passagem_cancelada',
        detalhes: `Passagem ${passagem.codigo} cancelada.`,
        user: actorUser,
        empresaId: passagem.empresaId,
        empresaNome: passagem.empresaNome,
      })
      enqueueOfflineAction({
        type: 'cancelamento_passagem',
        details: `Cancelamento offline da passagem ${passagem.codigo}.`,
        payload: {
          passagemCodigo: passagem.codigo,
          viagemId: passagem.viagemId,
          empresaId: passagem.empresaId || '',
          empresaNome: passagem.empresaNome || '',
        },
      })
      return { ...passagem, status: 'Cancelada', canceladoEm: timestamp, atualizadoEm: timestamp }
    }

    await runTransaction(db, async (transaction) => {
      const passagemRef = doc(db, 'passagens', passagem.id)
      const viagemRef = doc(db, 'viagens', passagem.viagemId)
      const passagemSnapshot = await transaction.get(passagemRef)
      const viagemSnapshot = await transaction.get(viagemRef)

      if (!passagemSnapshot.exists()) {
        throw new Error('Passagem nao encontrada.')
      }

      const atual = passagemSnapshot.data()
      if (atual.status === 'Cancelada') {
        return
      }

      transaction.update(passagemRef, {
        status: 'Cancelada',
        canceladoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      })

      if (impactaCapacidade && viagemSnapshot.exists()) {
        transaction.update(viagemRef, {
          vagasVendidas: increment(-1),
          vagasDisponiveis: increment(1),
          atualizadoEm: serverTimestamp(),
        })
      }
    })

    await addDoc(collection(db, 'caixa'), {
      tipo: 'entrada',
      origem: 'Estorno de passagem',
      passagemCodigo: passagem.codigo,
      viagemId: passagem.viagemId,
      valor: -Math.abs(Number(passagem.valor || 0)),
      formaPagamento: passagem.formaPagamento || 'Nao informado',
      empresaId: passagem.empresaId || '',
      empresaNome: passagem.empresaNome || '',
      criadoEm: serverTimestamp(),
    })
    await ajustarResumoCaixa({
      deltaEntrada: -Math.abs(Number(passagem.valor || 0)),
      deltaRegistros: 1,
    })

    await registrarLogUso({
      acao: 'passagem_cancelada',
      detalhes: `Passagem ${passagem.codigo} cancelada.`,
      user: actorUser,
      empresaId: passagem.empresaId,
      empresaNome: passagem.empresaNome,
    })
    return { ...passagem, status: 'Cancelada', canceladoEm: timestamp, atualizadoEm: timestamp }
  }

  const store = readStore()
  store.passagens = (store.passagens || []).map((item) =>
    item.id === passagem.id
      ? {
          ...item,
          status: 'Cancelada',
          canceladoEm: timestamp,
          atualizadoEm: timestamp,
        }
      : item,
  )
  store.viagens = (store.viagens || []).map((item) =>
    item.id === passagem.viagemId
      ? {
          ...item,
          vagasVendidas: impactaCapacidade ? Math.max(0, Number(item.vagasVendidas || 0) - 1) : Number(item.vagasVendidas || 0),
          vagasDisponiveis: impactaCapacidade ? Number(item.vagasDisponiveis || 0) + 1 : Number(item.vagasDisponiveis || 0),
          atualizadoEm: timestamp,
        }
      : item,
  )
  store.caixa = [
    ...(store.caixa || []),
    {
      id: `caixa-${Date.now()}`,
      tipo: 'entrada',
      origem: 'Estorno de passagem',
      passagemCodigo: passagem.codigo,
      viagemId: passagem.viagemId,
      valor: -Math.abs(Number(passagem.valor || 0)),
      formaPagamento: passagem.formaPagamento || 'Nao informado',
      empresaId: passagem.empresaId || '',
      empresaNome: passagem.empresaNome || '',
      criadoEm: timestamp,
    },
  ]
  const resumoCaixa = garantirResumoCaixaLocal(store)
  resumoCaixa.totalEntrada = Number(resumoCaixa.totalEntrada || 0) - Math.abs(Number(passagem.valor || 0))
  resumoCaixa.totalRegistros = Number(resumoCaixa.totalRegistros || 0) + 1
  writeStore(store)
  await registrarLogUso({
    acao: 'passagem_cancelada',
    detalhes: `Passagem ${passagem.codigo} cancelada.`,
    user: actorUser,
    empresaId: passagem.empresaId,
    empresaNome: passagem.empresaNome,
  })
  return { ...passagem, status: 'Cancelada', canceladoEm: timestamp, atualizadoEm: timestamp }
}

export async function confirmarEmbarque(codigo, actorUser = null) {
  const passagem = await buscarPassagemPorCodigo(codigo, {
    empresaId: actorUser?.rootSuperadmin ? '' : actorUser?.empresaId || '',
    empresaNome: actorUser?.empresaNome || '',
  })

  if (!passagem) {
    throw new Error('Passagem nao encontrada.')
  }

  if (passagem.status === 'Cancelada') {
    throw new Error('Passagem cancelada nao pode ser embarcada.')
  }

  if (passagem.status === 'Embarcado') {
    throw new Error('Esta passagem ja foi embarcada.')
  }

  const timestamp = new Date().toISOString()
  const operadorNome = actorUser?.nome || actorUser?.displayName || actorUser?.email || 'Operador'
  const operadorEmail = actorUser?.email || ''

  if (isConfigured && db) {
    const passagemRef = doc(db, 'passagens', passagem.id)
    await updateDoc(passagemRef, {
      status: 'Embarcado',
      embarcadoEm: serverTimestamp(),
      embarcadoPorNome: operadorNome,
      atualizadoEm: serverTimestamp(),
    })

    await addDoc(collection(db, 'checkins'), {
      empresaId: passagem.empresaId || '',
      empresaNome: passagem.empresaNome || '',
      passagemCodigo: passagem.codigo,
      passagemId: passagem.id,
      viagemId: passagem.viagemId,
      passageiroNome: passagem.passageiroNome || '',
      passageiroDocumento: passagem.passageiroDocumento || '',
      status: 'Embarcado',
      operadorNome,
      operadorEmail,
      criadoEm: serverTimestamp(),
    })

    await registrarLogUso({
      acao: 'embarque_confirmado',
      detalhes: `Passagem ${passagem.codigo} embarcada por ${operadorNome}.`,
      user: actorUser,
      empresaId: passagem.empresaId,
      empresaNome: passagem.empresaNome,
    })

    if (shouldUseFirestoreQueuedWrites()) {
      enqueueOfflineAction({
        type: 'embarque_passagem',
        details: `Embarque offline da passagem ${passagem.codigo}.`,
        payload: {
          passagemCodigo: passagem.codigo,
          viagemId: passagem.viagemId,
          empresaId: passagem.empresaId || '',
          empresaNome: passagem.empresaNome || '',
        },
      })
    }

    return {
      ...passagem,
      status: 'Embarcado',
      embarcadoEm: timestamp,
      embarcadoPorNome: operadorNome,
      atualizadoEm: timestamp,
    }
  }

  const store = readStore()
  const checkin = {
    id: `checkin-${Date.now()}`,
    empresaId: passagem.empresaId || '',
    empresaNome: passagem.empresaNome || '',
    passagemCodigo: passagem.codigo,
    passagemId: passagem.id,
    viagemId: passagem.viagemId,
    passageiroNome: passagem.passageiroNome || '',
    passageiroDocumento: passagem.passageiroDocumento || '',
    status: 'Embarcado',
    operadorNome,
    operadorEmail,
    criadoEm: timestamp,
  }

  store.passagens = (store.passagens || []).map((item) =>
    item.id === passagem.id
      ? {
          ...item,
          status: 'Embarcado',
          embarcadoEm: timestamp,
          embarcadoPorNome: operadorNome,
          atualizadoEm: timestamp,
        }
      : item,
  )
  store.checkins = [...(store.checkins || []), checkin]
  writeStore(store)

  await registrarLogUso({
    acao: 'embarque_confirmado',
    detalhes: `Passagem ${passagem.codigo} embarcada por ${operadorNome}.`,
    user: actorUser,
    empresaId: passagem.empresaId,
    empresaNome: passagem.empresaNome,
  })

  return {
    ...passagem,
    status: 'Embarcado',
    embarcadoEm: timestamp,
    embarcadoPorNome: operadorNome,
    atualizadoEm: timestamp,
  }
}

export async function listarPassagensPorViagem(viagemId, { empresaId = '', empresaNome = '' } = {}) {
  if (!viagemId) {
    return []
  }

  const items = await listCollectionOnce('passagens', { empresaId, empresaNome })
  return items
    .filter((item) => item.viagemId === viagemId)
    .sort((a, b) => String(a.passageiroNome || '').localeCompare(String(b.passageiroNome || '')))
}
