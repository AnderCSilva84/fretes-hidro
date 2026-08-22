import { useMemo } from 'react'

function toNumber(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTerminalName(value) {
  return String(value || '').trim().toLowerCase()
}

function buildBounds(points = []) {
  const latitudes = points.map((item) => item.latitude)
  const longitudes = points.map((item) => item.longitude)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)
  const latPadding = Math.max(0.12, (maxLat - minLat) * 0.35)
  const lngPadding = Math.max(0.12, (maxLng - minLng) * 0.35)

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  }
}

function buildEmbedUrl(bounds) {
  const bbox = [
    bounds.minLng,
    bounds.minLat,
    bounds.maxLng,
    bounds.maxLat,
  ].join('%2C')

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`
}

export default function NetworkMapCard({ terminais = [], rotas = [] }) {
  const mappedTerminais = useMemo(
    () =>
      terminais
        .map((item) => ({
          ...item,
          latitude: toNumber(item.latitude ?? item.lat),
          longitude: toNumber(item.longitude ?? item.lng),
        }))
        .filter((item) => item.latitude !== null && item.longitude !== null),
    [terminais],
  )

  const routeSummaries = useMemo(() => {
    const terminalMap = new Map(mappedTerminais.map((item) => [normalizeTerminalName(item.nome), item]))
    const lines = []

    for (const rota of rotas) {
      const origin = terminalMap.get(normalizeTerminalName(rota.terminalOrigem))
      const destinationNames = Array.isArray(rota.terminaisDestino) && rota.terminaisDestino.length
        ? rota.terminaisDestino
        : [rota.terminalDestino]

      for (const destinationName of destinationNames) {
        const destination = terminalMap.get(normalizeTerminalName(destinationName))
        if (origin && destination) {
          lines.push({
            id: `${rota.id || rota.terminalOrigem}-${destination.nome}`,
            label: `${origin.nome} -> ${destination.nome}`,
          })
        }
      }
    }

    return lines
  }, [mappedTerminais, rotas])

  if (!mappedTerminais.length) {
    return (
      <div className="rounded-[1.8rem] border border-dashed border-blue-200 bg-white/80 p-5 text-sm text-slate-500">
        Cadastre latitude e longitude nos terminais para exibir o mapa operacional no dashboard.
      </div>
    )
  }

  const bounds = buildBounds(mappedTerminais)
  const embedUrl = buildEmbedUrl(bounds)
  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${mappedTerminais[0].latitude}&mlon=${mappedTerminais[0].longitude}#map=8/${mappedTerminais[0].latitude}/${mappedTerminais[0].longitude}`

  return (
    <div className="rounded-[2rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-primary)]">Rede operacional</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Mapa dos terminais atendidos</h3>
          <p className="mt-1 text-sm text-slate-500">Mapa real via OpenStreetMap com a area onde a empresa opera.</p>
        </div>
        <a
          href={openStreetMapUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary-fade)] px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-[var(--brand-primary-soft)]"
        >
          Abrir mapa completo
        </a>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <div className="overflow-hidden rounded-[1.7rem] border border-blue-100 bg-white">
          <iframe
            title="Mapa dos terminais"
            src={embedUrl}
            className="block h-[24rem] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="space-y-3">
          {mappedTerminais.map((point) => (
            <a
              key={`card-${point.id || point.nome}`}
              href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[1.4rem] border border-blue-100 bg-white px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <p className="font-semibold text-slate-900">{point.nome}</p>
              <p className="mt-1 text-sm text-slate-500">{point.cidade || 'Cidade nao informada'}</p>
              <p className="mt-2 text-xs text-slate-400">{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</p>
            </a>
          ))}

          {routeSummaries.length ? (
            <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50/70 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Linhas atendidas</p>
              <div className="mt-3 space-y-2">
                {routeSummaries.map((line) => (
                  <p key={line.id} className="text-sm text-slate-600">{line.label}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
