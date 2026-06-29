import { SYSTEM_ICON_SRC, SYSTEM_NAME } from './systemConfig.js'

let iconDataUrlPromise

async function loadSystemIconDataUrl() {
  if (!iconDataUrlPromise) {
    iconDataUrlPromise = fetch(SYSTEM_ICON_SRC)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Falha ao carregar icone do sistema: ${response.status}`)
        }

        return response.blob()
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error || new Error('Falha ao ler icone do sistema'))
        reader.readAsDataURL(blob)
      }))
      .catch(() => null)
  }

  return iconDataUrlPromise
}

export async function drawSystemPdfHeader(
  pdf,
  {
    title,
    headerHeight = 24,
    titleFontSize = 18,
    titleX = 30,
    titleY = 15,
    iconX = 14,
    iconY = 6,
    iconSize = 11,
    backgroundColor = [15, 76, 129],
  },
) {
  pdf.setFillColor(...backgroundColor)
  pdf.rect(0, 0, 210, headerHeight, 'F')

  const iconDataUrl = await loadSystemIconDataUrl()

  if (iconDataUrl) {
    try {
      pdf.addImage(iconDataUrl, 'PNG', iconX, iconY, iconSize, iconSize)
    } catch {
      // Mantem a geracao do PDF mesmo se a imagem falhar.
    }
  }

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(titleFontSize)
  pdf.text(title || SYSTEM_NAME, titleX, titleY)
}

export { SYSTEM_NAME }
