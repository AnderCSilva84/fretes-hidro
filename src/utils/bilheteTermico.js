import { formatarBilheteTextoTermico } from './passagemUtils.js'

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function gerarHTMLBilheteTermico(passagem) {
  const texto = formatarBilheteTextoTermico(passagem)
  const conteudo = texto
    .split('\n')
    .map((linha) => `<div>${linha ? escapeHtml(linha) : '&nbsp;'}</div>`)
    .join('')

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
        size: 80mm auto;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 80mm;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: monospace;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        padding: 12px;
        box-sizing: border-box;
      }
      .ticket {
        font-size: 12px;
        line-height: 1.45;
        color: #000000 !important;
        background: #ffffff !important;
      }
      .ticket div {
        color: #000000 !important;
      }
      .title {
        font-weight: bold;
        margin-bottom: 8px;
        color: #000000 !important;
      }
      @media print {
        html, body, .ticket, .ticket div, .title {
          background: #ffffff !important;
          color: #000000 !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="title">Bilhete de Passagem</div>
      ${conteudo}
    </div>
    <script>
      window.onload = function () {
        setTimeout(function () {
          window.print();
        }, 150);
      };
    </script>
  </body>
</html>`
}

export function abrirJanelaImpressaoTermica(passagem) {
  const html = gerarHTMLBilheteTermico(passagem)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const htmlUrl = URL.createObjectURL(blob)
  const popup = window.open(htmlUrl, '_blank', 'width=420,height=760')

  if (!popup) {
    URL.revokeObjectURL(htmlUrl)
    throw new Error('Nao foi possivel abrir a janela de impressao.')
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(htmlUrl)
  }, 60000)

  return popup
}
