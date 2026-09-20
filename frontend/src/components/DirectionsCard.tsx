import { useState } from 'react'
import type { Pandal } from '../types'
import { formatDistance } from '../utils/format'
import { getPosition, haversineKm } from '../utils/geo'

type Mode = 'walking' | 'driving' | 'transit'

const MODES: { id: Mode; label: string; speedKmh: number | null }[] = [
  { id: 'walking', label: '🚶 Walk', speedKmh: 4.8 },
  { id: 'driving', label: '🚗 Drive', speedKmh: 18 },
  { id: 'transit', label: '🚌 Transit', speedKmh: null },
]

/**
 * Transparent directions card: shows exactly FROM where → TO where,
 * straight-line distance, estimated travel time, and Google Maps links
 * with BOTH origin and destination pre-filled (walking/driving/transit).
 */
export default function DirectionsCard({ pandal }: { pandal: Pandal }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [resolvedAt, setResolvedAt] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<Mode>('walking')

  if (pandal.latitude == null || pandal.longitude == null) return null

  async function useMyLocation() {
    setLocating(true)
    setLocError('')
    try {
      const pos = await getPosition()
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setResolvedAt(new Date().toISOString())
    } catch {
      setLocError('Location unavailable — allow location access, or use the maps link below and pick your start point there.')
    } finally {
      setLocating(false)
    }
  }

  async function copyCoords() {
    await navigator.clipboard.writeText(`${pandal.latitude}, ${pandal.longitude}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const destination = `${pandal.latitude},${pandal.longitude}`
  const distKm = coords ? haversineKm(coords.lat, coords.lng, pandal.latitude, pandal.longitude) : null
  const modeInfo = MODES.find((m) => m.id === mode)!
  const etaMin =
    distKm != null && modeInfo.speedKmh
      ? Math.max(1, Math.round((distKm / modeInfo.speedKmh) * 60))
      : null

  const mapsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&origin=${coords.lat},${coords.lng}&destination=${destination}&travelmode=${mode}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${mode}`

  const box = 'rounded-xl border border-stone-200 bg-stone-50/90 px-3.5 py-3 text-stone-800 shadow-xs'

  return (
    <div className="mt-6 rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-md shadow-red-500/5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
          <span>🧭</span> Directions &amp; Navigation
        </h2>
        {!coords && (
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-stone-950 font-bold px-3.5 py-1.5 text-xs sm:text-sm transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            {locating ? '📡 Locating…' : '📍 Use my location'}
          </button>
        )}
      </div>

      {/* FROM */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
          FROM {coords ? `(detected ${new Date(resolvedAt!).toLocaleTimeString([], { timeStyle: 'short' })})` : '(not set yet)'}
        </p>
        {coords ? (
          <p className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
            <span>📍 Your Current Location</span>
            <span className="text-stone-500 font-mono text-xs">({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})</span>
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            Tap <strong className="text-stone-800">“Use my location”</strong> to calculate distance, walk time, and route
          </p>
        )}
      </div>

      <div className="text-center text-red-400 text-lg leading-none py-1.5 font-bold">↓</div>

      {/* TO */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-1">TO (DESTINATION)</p>
        <p className="text-sm font-bold text-stone-900">
          🛕 {pandal.name} <span className="text-stone-500 font-normal">· {pandal.locality ?? pandal.address}</span>
        </p>
        <p className="text-xs text-stone-500 font-mono mt-1 flex items-center gap-2">
          <span>({pandal.latitude!.toFixed(5)}, {pandal.longitude!.toFixed(5)})</span>
          <button
            onClick={copyCoords}
            className="text-red-600 hover:text-red-700 font-sans font-semibold underline underline-offset-2 cursor-pointer"
          >
            {copied ? '✓ Copied' : 'Copy GPS'}
          </button>
        </p>
      </div>

      {locError && (
        <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-medium">
          {locError}
        </p>
      )}

      {/* Result summary + modes */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition cursor-pointer font-semibold ${
              mode === m.id
                ? 'border-red-500 bg-red-50 text-red-700 shadow-xs'
                : 'border-stone-200 bg-white text-stone-600 hover:border-red-200 hover:text-stone-900'
            }`}
          >
            {m.label}
          </button>
        ))}
        {distKm != null && (
          <span className="text-xs sm:text-sm font-bold text-stone-800 ml-auto bg-stone-100 px-3 py-1 rounded-lg">
            📏 {formatDistance(distKm)}
            {etaMin != null && <> · ≈{etaMin} min {mode === 'walking' ? 'walk' : 'drive'}</>}
          </span>
        )}
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-5 py-2.5 text-sm transition shadow-md shadow-red-500/20"
      >
        <span>Open exact route in Google Maps</span>
        <span>→</span>
      </a>
      <p className="text-[11px] text-stone-500 mt-2">
        Distances are straight-line; Google Maps shows the real walking/driving route and live traffic.
      </p>
    </div>
  )
}
