import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = process.env.NAVIA_THERMAL_AGENT_HOST || '127.0.0.1'
const PORT = Number.parseInt(process.env.NAVIA_THERMAL_AGENT_PORT || '18181', 10)
const PRINTER_NAME = String(process.env.NAVIA_THERMAL_PRINTER_NAME || '').trim()
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PRINT_SCRIPT_PATH = path.join(SCRIPT_DIR, 'thermal-print-agent', 'print-thermal-ticket.ps1')

let queue = Promise.resolve()
let activeJobs = 0

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function normalizeDocument(document, index) {
  const text = String(document?.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()

  if (!text) {
    throw new Error(`Documento ${index + 1} sem conteudo de texto para impressao.`)
  }

  return {
    jobId: String(document?.jobId || randomUUID()),
    title: String(document?.title || `Documento ${index + 1}`),
    widthMm: Math.max(58, Number(document?.widthMm || 80)),
    copies: Math.max(1, Number(document?.copies || 1)),
    cut: document?.cut !== false,
    text,
    payload: document?.payload && typeof document.payload === 'object'
      ? document.payload
      : {},
  }
}

function normalizePrintPayload(payload) {
  const documents = Array.isArray(payload?.documents)
    ? payload.documents.map(normalizeDocument)
    : []

  if (documents.length === 0) {
    throw new Error('Nenhum documento foi enviado para impressao termica.')
  }

  return {
    source: String(payload?.source || 'navia-pwa'),
    requestedAt: String(payload?.requestedAt || new Date().toISOString()),
    documents,
  }
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message))
        return
      }

      resolve({ stdout, stderr })
    })
  })
}

async function runPrintScript(payload) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navia-thermal-'))
  const payloadPath = path.join(tempDir, 'payload.json')

  try {
    await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8')

    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      PRINT_SCRIPT_PATH,
      '-PayloadPath',
      payloadPath,
    ]

    if (PRINTER_NAME) {
      args.push('-PrinterName', PRINTER_NAME)
    }

    await execFileAsync('powershell.exe', args, {
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    })
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

function enqueuePrint(payload) {
  activeJobs += 1

  const current = queue.then(() => runPrintScript(payload))
  queue = current.catch(() => {})

  return current.finally(() => {
    activeJobs = Math.max(0, activeJobs - 1)
  })
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length

      if (size > 1024 * 1024) {
        reject(new Error('Payload excedeu 1 MB.'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'navia-thermal-agent',
      host: HOST,
      port: PORT,
      pendingJobs: activeJobs,
      printerName: PRINTER_NAME || null,
      usingDefaultPrinter: !PRINTER_NAME,
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/print/thermal') {
    try {
      const rawBody = await readRequestBody(request)
      const parsedBody = rawBody ? JSON.parse(rawBody) : {}
      const payload = normalizePrintPayload(parsedBody)

      await enqueuePrint(payload)

      sendJson(response, 200, {
        ok: true,
        printed: payload.documents.length,
        printerName: PRINTER_NAME || null,
        usingDefaultPrinter: !PRINTER_NAME,
      })
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao processar impressao termica.',
      })
    }
    return
  }

  sendJson(response, 404, {
    ok: false,
    error: 'Rota nao encontrada.',
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[NAVIA thermal-agent] ouvindo em http://${HOST}:${PORT}`)
  if (PRINTER_NAME) {
    console.log(`[NAVIA thermal-agent] impressora configurada: ${PRINTER_NAME}`)
  } else {
    console.log('[NAVIA thermal-agent] usando a impressora padrao do Windows')
  }
})
