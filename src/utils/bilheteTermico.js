import { Capacitor, registerPlugin } from '@capacitor/core'
import { formatDateBR, formatDateAndTimeBR } from './date.js'
import { formatarBilheteTextoTermico } from './passagemUtils.js'
import { isTarifaAntecipada } from './tarifaUtils.js'

const NaviaPrinter = registerPlugin('NaviaPrinter')

const THERMAL_PRINT_MESSAGE_TYPE = 'navia-thermal-print'
const THERMAL_PRINT_AGENT_URL_STORAGE_KEY = 'navia-thermal-print-agent-url'
const THERMAL_PRINT_MODE_STORAGE_KEY = 'navia-thermal-print-mode'
const RAWBT_ANDROID_PACKAGE = 'ru.a402d.rawbtprinter'
const DEFAULT_THERMAL_PRINT_AGENT_URL = String(import.meta.env.VITE_THERMAL_PRINT_AGENT_URL || 'http://127.0.0.1:18181').trim()
const DEFAULT_THERMAL_PRINT_MODE = String(import.meta.env.VITE_THERMAL_PRINT_MODE || 'agent-first').trim().toLowerCase()
const THERMAL_PRINT_AGENT_FAILURE_TTL_MS = 30 * 1000
const THERMAL_RECEIPT_WIDTH_MM = 58

let thermalPrintJobSequence = 0
let thermalPrintAgentAvailability = {
  available: null,
  checkedAt: 0,
}

function readThermalPrintMode() {
  if (typeof window === 'undefined') {
    return DEFAULT_THERMAL_PRINT_MODE
  }

  const storedMode = String(window.localStorage.getItem(THERMAL_PRINT_MODE_STORAGE_KEY) || '').trim().toLowerCase()
  return storedMode || DEFAULT_THERMAL_PRINT_MODE
}

function readThermalPrintAgentUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_THERMAL_PRINT_AGENT_URL
  }

  const storedUrl = String(window.localStorage.getItem(THERMAL_PRINT_AGENT_URL_STORAGE_KEY) || '').trim()
  return storedUrl || DEFAULT_THERMAL_PRINT_AGENT_URL
}

function shouldTryThermalPrintAgent() {
  const mode = readThermalPrintMode()

  if (mode === 'browser-only') {
    return false
  }

  return Boolean(readThermalPrintAgentUrl())
}

function isAndroidDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /android/i.test(navigator.userAgent || '')
}

function shouldTryRawBt() {
  const mode = readThermalPrintMode()
  return mode === 'rawbt' && isAndroidDevice()
}

function appendBytes(target, ...values) {
  values.flat().forEach((value) => target.push(value & 0xff))
}

function encodeAscii(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e\n]/g, '?')

  return Array.from(normalized, (character) => character.charCodeAt(0))
}

function appendQrCode(target, value) {
  const qrValue = String(value || '').trim()

  if (!qrValue) {
    return
  }

  const data = encodeAscii(qrValue)
  const storeLength = data.length + 3

  appendBytes(target, [0x1b, 0x61, 0x01])
  appendBytes(target, [0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])
  appendBytes(target, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05])
  appendBytes(target, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31])
  appendBytes(target, [0x1d, 0x28, 0x6b, storeLength & 0xff, (storeLength >> 8) & 0xff, 0x31, 0x50, 0x30], data)
  appendBytes(target, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30, 0x0a])
  appendBytes(target, [0x1b, 0x61, 0x00])
}

function buildRawBtBytes(passagens) {
  const bytes = []

  passagens.forEach((passagem, index) => {
    appendBytes(bytes, [0x1b, 0x40])
    appendBytes(bytes, [0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01])
    appendBytes(bytes, encodeAscii('NAVIA\nBILHETE DE PASSAGEM\n'))
    appendBytes(bytes, [0x1b, 0x45, 0x00, 0x1b, 0x61, 0x00])
    appendBytes(bytes, encodeAscii(`--------------------------------\n${formatarBilheteTextoTermico(passagem).split('\n').slice(3).join('\n')}\n`))
    appendQrCode(bytes, passagem?.bilheteUrl)
    appendBytes(bytes, encodeAscii('\nGuarde este comprovante.\n\n\n\n'))

    if (index < passagens.length - 1) {
      appendBytes(bytes, encodeAscii('--------------------------------\n\n'))
    }
  })

  return Uint8Array.from(bytes)
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return window.btoa(binary)
}

function tryRawBtPrint(passagens) {
  if (!shouldTryRawBt()) {
    return false
  }

  const base64 = bytesToBase64(buildRawBtBytes(passagens))
  const rawBtIntent = `intent:base64,${base64}#Intent;scheme=rawbt;package=${RAWBT_ANDROID_PACKAGE};end;`
  const link = document.createElement('a')
  link.href = rawBtIntent
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return true
}

async function tryNativeQ2iPrint(passagens) {
  const nativeBridgeAvailable = Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('NaviaPrinter')
  if (!nativeBridgeAvailable) return false

  for (const passagem of passagens) {
    await Promise.race([
      NaviaPrinter.print({
        text: formatarBilheteTextoTermico(passagem),
        qrCode: String(passagem?.bilheteUrl || passagem?.codigo || ''),
        feedLines: 120,
      }),
      new Promise((resolve) => window.setTimeout(() => resolve({ queued: true, timeoutFallback: true }), 12000)),
    ])
  }

  return true
}

async function printNativeQ2iText(text) {
  const nativeBridgeAvailable = Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('NaviaPrinter')
  if (!nativeBridgeAvailable) return false

  await Promise.race([
    NaviaPrinter.print({ text, qrCode: '', feedLines: 120 }),
    new Promise((resolve) => window.setTimeout(() => resolve({ queued: true, timeoutFallback: true }), 12000)),
  ])
  return true
}

function shouldSkipThermalPrintAgentAttempt() {
  if (thermalPrintAgentAvailability.available !== false) {
    return false
  }

  return Date.now() - thermalPrintAgentAvailability.checkedAt < THERMAL_PRINT_AGENT_FAILURE_TTL_MS
}

function rememberThermalPrintAgentAvailability(available) {
  thermalPrintAgentAvailability = {
    available,
    checkedAt: Date.now(),
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatCurrency(value) {
  return `R$ ${Number(value || 0).toFixed(2)}`
}

function getStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()

  if (normalized === 'embarcado') {
    return 'Embarcado'
  }

  if (normalized === 'cancelada') {
    return 'Cancelada'
  }

  if (normalized === 'check-in') {
    return 'Check-in'
  }

  return status || 'Vendida'
}

function renderField(label, value, extraClassName = '') {
  return `<div class="field ${extraClassName}"><span class="field-label">${escapeHtml(label)}</span><span class="field-value">${escapeHtml(value || '-')}</span></div>`
}

export function gerarHTMLBilheteTermico(passagem, options = {}) {
  const { jobId = '', autoClose = false } = options
  const codigo = passagem?.codigo || '-'
  const passageiroNome = passagem?.passageiroNome || '-'
  const documento = passagem?.passageiroDocumento || '-'
  const origem = passagem?.origem || '-'
  const destino = passagem?.destino || '-'
  const terminalOrigem = passagem?.terminalOrigem || '-'
  const terminalDestino = passagem?.terminalDestino || '-'
  const embarcacao = passagem?.embarcacaoNome || '-'
  const tarifa = passagem?.tarifaTipo || '-'
  const valor = formatCurrency(passagem?.valor)
  const formaPagamento = passagem?.formaPagamento || '-'
  const status = getStatusLabel(passagem?.status)
  const dataViagem = formatDateBR(passagem?.dataViagem)
  const horarioSaida = passagem?.horarioSaida || '-'
  const dataHoraEmissao = formatDateAndTimeBR(passagem?.criadoEm)
  const qrCodeDataUrl = String(passagem?.qrCodeDataUrl || '').trim()
  const bilheteUrl = String(passagem?.bilheteUrl || '').trim()
  const rotaResumo = [origem, destino].filter((item) => item && item !== '-').join(' - ') || '-'
  const saidaResumo = `${dataViagem} ${horarioSaida}`.trim()

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light only" />
    <title>Bilhete ${passagem?.codigo || ''}</title>
    <style>
      :root {
        color-scheme: light only;
      }
      @page {
        size: ${THERMAL_RECEIPT_WIDTH_MM}mm auto;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: monospace;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        padding: 0;
        box-sizing: border-box;
      }
      .ticket {
        width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
        padding: 6px 6px 10px;
        box-sizing: border-box;
        font-size: 9px;
        line-height: 1.3;
        color: #000000 !important;
        background: #ffffff !important;
      }
      .ticket * {
        color: #000000 !important;
        box-sizing: border-box;
      }
      .header {
        text-align: center;
        border: 1px solid #000000;
        padding: 6px 4px;
      }
      .brand {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .subtitle {
        margin-top: 2px;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .route {
        margin-top: 6px;
        text-align: center;
        border: 1px solid #000000;
        padding: 6px 4px;
      }
      .route-cities {
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
        word-break: break-word;
      }
      .route-arrow {
        display: block;
        margin: 2px 0;
        font-size: 9px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .meta-grid {
        display: block;
        margin-top: 6px;
      }
      .field {
        border: 1px solid #000000;
        padding: 4px 5px;
        margin-top: 4px;
      }
      .field-label {
        display: block;
        margin-bottom: 1px;
        font-size: 7px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .field-value {
        display: block;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.2;
        word-break: break-word;
      }
      .divider {
        margin: 6px 0;
        border-top: 1px dashed #000000;
      }
      .section-title {
        margin: 0 0 6px;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
      }
      .status-box,
      .fare-box {
        border: 1px solid #000000;
        padding: 6px 4px;
        text-align: center;
      }
      .status-box {
        margin-top: 6px;
      }
      .status-label,
      .fare-label {
        display: block;
        font-size: 7px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .status-value {
        display: block;
        margin-top: 2px;
        font-size: 13px;
        font-weight: 800;
      }
      .fare-type {
        display: block;
        margin-top: 2px;
        font-size: 10px;
        font-weight: 800;
      }
      .fare-amount {
        display: block;
        margin-top: 2px;
        font-size: 14px;
        font-weight: 900;
      }
      .qr-box {
        margin-top: 6px;
        border: 1px solid #000000;
        padding: 6px 4px;
        text-align: center;
      }
      .qr-box img {
        display: block;
        width: 96px;
        height: 96px;
        margin: 0 auto 4px;
        object-fit: contain;
      }
      .notes {
        margin-top: 4px;
        text-align: center;
        font-size: 8px;
      }
      .footer {
        margin-top: 6px;
        border-top: 1px dashed #000000;
        padding-top: 6px;
        text-align: center;
        font-size: 7px;
        line-height: 1.25;
      }
      @media print {
        html, body, .ticket, .ticket * {
          background: #ffffff !important;
          color: #000000 !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="header">
        <div class="brand">NAVIA</div>
        <div class="subtitle">Bilhete de Passagem</div>
        ${passagem?.segundaVia ? '<div class="subtitle"><strong>*** SEGUNDA VIA ***</strong></div>' : ''}
      </div>

      <div class="route">
        <div class="route-cities">${escapeHtml(rotaResumo)}</div>
        <span class="route-arrow">para</span>
        <div class="route-cities">${escapeHtml(saidaResumo)}</div>
      </div>

      <div class="meta-grid">
        ${renderField('Codigo', codigo)}
        ${renderField('Passageiro', passageiroNome)}
        ${renderField('Documento', documento)}
        ${renderField('Embarcacao', embarcacao)}
        ${renderField('Tarifa', tarifa)}
        ${renderField('Pagamento', formaPagamento)}
        ${terminalOrigem ? renderField('Terminal origem', terminalOrigem) : ''}
        ${terminalDestino ? renderField('Terminal destino', terminalDestino) : ''}
      </div>

      <div class="status-box">
        <span class="status-label">Status do bilhete</span>
        <span class="status-value">${escapeHtml(status)}</span>
      </div>

      <div class="divider"></div>

      <div class="fare-box">
        <span class="fare-label">Tarifa aplicada</span>
        <span class="fare-type">${escapeHtml(tarifa)}</span>
        <span class="fare-amount">${escapeHtml(valor)}</span>
      </div>

      ${qrCodeDataUrl ? `
      <div class="qr-box">
        <div class="section-title">Leitura de embarque</div>
        <img src="${escapeHtml(qrCodeDataUrl)}" alt="QR Code do bilhete ${escapeHtml(codigo)}" />
        <div class="notes">Apresente este QR Code no embarque.</div>
      </div>` : ''}

      <div class="footer">
        <div>Guarde este comprovante ate o fim da viagem.</div>
        <div>Emissao: ${escapeHtml(dataHoraEmissao)}</div>
        ${bilheteUrl ? `<div>Validacao: ${escapeHtml(bilheteUrl)}</div>` : ''}
      </div>
    </div>
    <script>
      function notifyOpener(status) {
        if (!window.opener || !${JSON.stringify(jobId)}) {
          return;
        }

        window.opener.postMessage(
          {
            type: ${JSON.stringify(THERMAL_PRINT_MESSAGE_TYPE)},
            jobId: ${JSON.stringify(jobId)},
            status: status
          },
          '*'
        );
      }

      window.addEventListener('afterprint', function () {
        setTimeout(function () {
          notifyOpener('printed');
          if (${autoClose ? 'true' : 'false'}) {
            window.close();
          }
        }, 80);
      });

      window.onload = function () {
        setTimeout(function () {
          window.print();
        }, 150);
      };
    </script>
  </body>
</html>`
}

function createThermalPrintJobId() {
  thermalPrintJobSequence += 1
  return `thermal-print-${Date.now()}-${thermalPrintJobSequence}`
}

function buildThermalPrintDocuments(passagens) {
  return passagens.map((passagem) => ({
    jobId: createThermalPrintJobId(),
    title: `Bilhete ${passagem?.codigo || ''}`.trim(),
    widthMm: THERMAL_RECEIPT_WIDTH_MM,
    copies: 1,
    cut: true,
    html: gerarHTMLBilheteTermico(passagem),
    text: formatarBilheteTextoTermico(passagem),
    payload: {
      codigo: passagem?.codigo || '',
      viagemId: passagem?.viagemId || '',
      passageiroNome: passagem?.passageiroNome || '',
    },
  }))
}

async function trySilentThermalPrint(passagens) {
  if (!shouldTryThermalPrintAgent()) {
    return false
  }

  if (shouldSkipThermalPrintAgentAttempt()) {
    return Boolean(thermalPrintAgentAvailability.available)
  }

  const endpointBase = readThermalPrintAgentUrl()

  if (!endpointBase) {
    rememberThermalPrintAgentAvailability(false)
    return false
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeoutId = controller
    ? window.setTimeout(() => {
        controller.abort()
      }, 4000)
    : null

  try {
    const response = await fetch(`${endpointBase.replace(/\/+$/, '')}/print/thermal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'navia-pwa',
        requestedAt: new Date().toISOString(),
        documents: buildThermalPrintDocuments(passagens),
      }),
      signal: controller?.signal,
    })

    if (!response.ok) {
      throw new Error(`Thermal agent respondeu com status ${response.status}.`)
    }

    rememberThermalPrintAgentAvailability(true)
    return true
  } catch (error) {
    rememberThermalPrintAgentAvailability(false)
    console.warn('Falha ao enviar impressao termica para o helper local. Usando window.print().', error)
    return false
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
  }
}

function waitForThermalPrintCompletion(jobId, popup) {
  return new Promise((resolve) => {
    let settled = false

    function finish() {
      if (settled) {
        return
      }

      settled = true
      window.removeEventListener('message', handleMessage)
      window.clearInterval(closedCheck)
      window.clearTimeout(timeoutId)
      resolve()
    }

    function handleMessage(event) {
      const data = event.data
      if (!data || data.type !== THERMAL_PRINT_MESSAGE_TYPE || data.jobId !== jobId) {
        return
      }

      finish()
    }

    const closedCheck = window.setInterval(() => {
      if (!popup || popup.closed) {
        finish()
      }
    }, 300)

    const timeoutId = window.setTimeout(() => {
      finish()
    }, 45000)

    window.addEventListener('message', handleMessage)
  })
}

function carregarPopupImpressaoTermica(popup, passagem, options = {}) {
  if (!popup || popup.closed) {
    throw new Error('A janela de impressao termica foi fechada antes da conclusao.')
  }

  const html = gerarHTMLBilheteTermico(passagem, options)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const htmlUrl = URL.createObjectURL(blob)

  window.setTimeout(() => {
    URL.revokeObjectURL(htmlUrl)
  }, 60000)

  popup.location.replace(htmlUrl)
  return popup
}

export async function imprimirPassagensTermicas(passagens) {
  const itens = (Array.isArray(passagens) ? passagens : [passagens]).filter(Boolean)

  if (itens.length === 0) {
    return null
  }

  if (await tryNativeQ2iPrint(itens)) {
    return null
  }

  const printedByAgent = await trySilentThermalPrint(itens)

  if (printedByAgent) {
    return null
  }

  if (tryRawBtPrint(itens)) {
    return null
  }

  if (isAndroidDevice()) {
    throw new Error('A impressora nativa deste terminal ainda nao esta conectada ao NAVIA.')
  }

  const popup = window.open('', '_blank', 'width=420,height=760')

  if (!popup) {
    throw new Error('Nao foi possivel abrir a janela de impressao.')
  }

  popup.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Impressao termica</title></head><body style="font-family: monospace; padding: 16px;">Preparando comprovante...</body></html>')
  popup.document.close()

  for (let index = 0; index < itens.length; index += 1) {
    const jobId = createThermalPrintJobId()
    carregarPopupImpressaoTermica(popup, itens[index], {
      jobId,
      autoClose: index === itens.length - 1,
    })
    await waitForThermalPrintCompletion(jobId, popup)
  }

  return popup
}

function normalizarStatusPassagem(status) {
  return String(status || '').trim().toLowerCase()
}

function agruparContagens(itens, campo, fallback = 'Nao informado') {
  return itens.reduce((totais, item) => {
    const chave = String(item?.[campo] || fallback).trim() || fallback
    totais[chave] = (totais[chave] || 0) + 1
    return totais
  }, {})
}

function formatarLinhasContagem(titulo, contagens) {
  const linhas = Object.entries(contagens).sort(([a], [b]) => a.localeCompare(b))
  return [titulo, ...linhas.map(([nome, quantidade]) => `  ${nome}: ${quantidade}`)]
}

export async function imprimirResumoCaixaTermico({ viagem, passagens = [], resumo = {}, responsavelFechamento = '' }) {
  const validas = passagens.filter((item) => normalizarStatusPassagem(item.status) !== 'cancelada')
  const canceladas = passagens.filter((item) => normalizarStatusPassagem(item.status) === 'cancelada')
  const modalidades = agruparContagens(validas, 'tarifaTipo')
  const pagamentos = agruparContagens(validas, 'formaPagamento')
  const operadorCaixa = viagem?.caixaAbertoPorNome || viagem?.operadorNome || viagem?.operadorEmail || 'Nao informado'
  const total = Number(resumo?.totalArrecadado ?? validas.filter((item) => !isTarifaAntecipada(item.tarifaTipo)).reduce((valor, item) => valor + Number(item?.valor || 0), 0))
  const texto = [
    'NAVIA',
    'RESUMO DE FECHAMENTO DE CAIXA',
    '================================',
    `Embarcacao: ${viagem?.embarcacaoNome || '-'}`,
    `Rota: ${viagem?.origem || '-'} -> ${viagem?.destino || '-'}`,
    `Viagem: ${formatDateBR(viagem?.dataViagem)} ${viagem?.horarioSaida || '-'}`,
    `Abertura: ${formatDateAndTimeBR(viagem?.caixaAbertoEm)}`,
    `Fechamento: ${formatDateAndTimeBR(resumo?.fechadoEm || viagem?.caixaFechadoEm || new Date().toISOString())}`,
    `Operador do caixa: ${operadorCaixa}`,
    `Encerrado por: ${responsavelFechamento || operadorCaixa}`,
    '--------------------------------',
    `Passagens validas: ${validas.length}`,
    `Passagens canceladas: ${canceladas.length}`,
    ...formatarLinhasContagem('POR MODALIDADE', modalidades),
    ...formatarLinhasContagem('POR PAGAMENTO', pagamentos),
    '--------------------------------',
    `TOTAL ARRECADADO: R$ ${total.toFixed(2)}`,
    '================================',
  ].join('\n')

  if (await printNativeQ2iText(texto)) return null
  throw new Error('A impressora nativa deste terminal ainda nao esta conectada ao NAVIA.')
}

export function abrirJanelaImpressaoTermica(passagem) {
  return imprimirPassagensTermicas(passagem)
}
