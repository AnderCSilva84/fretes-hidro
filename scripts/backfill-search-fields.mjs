import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { initializeApp, getApps, getApp } from 'firebase/app'
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore'
import {
  prepareCollectionPayload,
} from '../src/services/searchNormalization.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')
const envPath = resolve(projectRoot, '.env')
const applyChanges = process.argv.includes('--apply')
const targetCollectionArg = process.argv.find((argument) => argument.startsWith('--collection='))
const targetCollection = targetCollectionArg ? targetCollectionArg.split('=')[1] : ''

const collectionsToProcess = [
  'clientes',
  'usuarios',
  'embarcacoes',
  'terminais',
  'rotasValores',
  'encomendas',
]

async function loadEnvFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf('=')

      if (separatorIndex < 0) {
        return accumulator
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      accumulator[key] = value
      return accumulator
    }, {})
}

function buildFirebaseConfig(env) {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
  }
}

function diffPayload(documentData, preparedData) {
  const updates = {}

  for (const [key, value] of Object.entries(preparedData)) {
    if (documentData[key] !== value) {
      updates[key] = value
    }
  }

  return updates
}

async function main() {
  const env = await loadEnvFile(envPath)
  const firebaseConfig = buildFirebaseConfig(env)

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Firebase nao configurado no .env.')
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const collections = targetCollection
    ? collectionsToProcess.filter((name) => name === targetCollection)
    : collectionsToProcess

  if (!collections.length) {
    throw new Error('Colecao informada nao e suportada por este backfill.')
  }

  console.log(applyChanges ? 'Modo APPLY: gravando alteracoes.' : 'Modo DRY-RUN: nenhuma alteracao sera gravada.')

  let totalDocuments = 0
  let totalUpdates = 0

  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName))
    let batch = writeBatch(db)
    let batchSize = 0
    let collectionUpdates = 0

    console.log(`\nColecao: ${collectionName}`)

    for (const documentSnapshot of snapshot.docs) {
      totalDocuments += 1
      const documentData = documentSnapshot.data()
      const preparedData = prepareCollectionPayload(collectionName, documentData)
      const updates = diffPayload(documentData, preparedData)

      if (Object.keys(updates).length === 0) {
        continue
      }

      collectionUpdates += 1
      totalUpdates += 1

      console.log(`- ${documentSnapshot.id}: ${Object.keys(updates).join(', ')}`)

      if (!applyChanges) {
        continue
      }

      batch.update(doc(db, collectionName, documentSnapshot.id), updates)
      batchSize += 1

      if (batchSize >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        batchSize = 0
      }
    }

    if (applyChanges && batchSize > 0) {
      await batch.commit()
    }

    console.log(`Resumo ${collectionName}: ${snapshot.docs.length} documento(s), ${collectionUpdates} atualizacao(oes).`)
  }

  console.log(`\nTotal analisado: ${totalDocuments} documento(s).`)
  console.log(`Total com ajuste: ${totalUpdates} documento(s).`)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nFalha no backfill:', error.message || error)
    process.exit(1)
  })
