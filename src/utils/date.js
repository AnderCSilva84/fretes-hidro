function asDate(value) {
  if (!value) {
    return null
  }

  if (typeof value?.toDate === 'function') {
    const converted = value.toDate()
    return Number.isNaN(converted?.getTime?.()) ? null : converted
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateBR(value, fallback = '-') {
  if (!value) {
    return fallback
  }

  const raw = String(value).trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    return raw
  }

  const dateValue = asDate(value)
  if (!dateValue) {
    return fallback
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateValue)
}

export function formatDateTimeBR(value, fallback = '-') {
  const dateValue = asDate(value)
  if (!dateValue) {
    return fallback
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(dateValue)
}

export function formatDateAndTimeBR(dateValue, timeValue = '', fallback = '-') {
  const formattedDate = formatDateBR(dateValue, '')
  const formattedTime = String(timeValue || '').trim()

  if (!formattedDate && !formattedTime) {
    return fallback
  }

  return `${formattedDate || fallback} ${formattedTime}`.trim()
}

export function getWeekdayLabelBR(value, fallback = '-') {
  const dateValue = asDate(value)
  if (!dateValue) {
    return fallback
  }

  const label = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
  }).format(dateValue)

  return label.charAt(0).toUpperCase() + label.slice(1)
}
