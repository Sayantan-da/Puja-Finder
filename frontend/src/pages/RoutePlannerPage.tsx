import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import CrowdBadge from '../components/CrowdBadge'
import LiveBadge from '../components/LiveBadge'
import { useLiveCrowd } from '../hooks/useLiveCrowd'
import type {
  CuratedTrail,
  OptimizedRouteResponse,
  Pandal,
} from '../types'
import { formatDuration } from '../utils/format'
import { getPosition } from '../utils/geo'

interface StartPreset {
  label: string
  lat: number
  lng: number
  icon: string
}

const START_PRESETS: StartPreset[] = [
  { label: 'Sealdah Metro / Station', lat: 22.5675, lng: 88.3712, icon: '🚇' },
  { label: 'Sovabazar Sutanuti Metro', lat: 22.5992, lng: 88.3688, icon: '🚇' },
  { label: 'Kalighat Metro', lat: 22.5186, lng: 88.3444, icon: '🚇' },
  { label: 'Central Metro (College St)', lat: 22.5726, lng: 88.3639, icon: '🚇' },
  { label: 'Salt Lake Central Park Metro', lat: 22.5878, lng: 88.4172, icon: '🚇' },
]

export default function RoutePlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Data state
  const [pandals, setPandals] = useState<Pandal[]>([])
  const [trails, setTrails] = useState<CuratedTrail[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Selection & Config state
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [mode, setMode] = useState<'walking' | 'driving'>('walking')
  const [optimizeTSP, setOptimizeTSP] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')
  const [activeLocality, setActiveLocality] = useState<string>('All')

  // Start Location state
  const [startType, setStartType] = useState<'pandal' | 'gps' | 'preset'>('pandal')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<StartPreset | null>(null)
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState('')

  // Route result state
  const [routeResult, setRouteResult] = useState<OptimizedRouteResponse | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [copiedSummary, setCopiedSummary] = useState(false)

  // Live crowd WebSocket
  const { lastUpdate, connected } = useLiveCrowd('all')

  // Initial load: fetch pandals and curated trails
  useEffect(() => {
    async function loadData() {
      setLoadingInitial(true)
      try {
        const [pandalsRes, trailsRes] = await Promise.all([
          api.get<Pandal[]>('/pandals'),
          api.get<CuratedTrail[]>('/routes/trails'),
        ])
        setPandals(pandalsRes.data)
        setTrails(trailsRes.data)

        // Check if pandal_ids or trail is in URL params
        const urlPandalIds = searchParams.get('ids')
        const urlTrailId = searchParams.get('trail')

        if (urlTrailId && trailsRes.data.length > 0) {
          const matchedTrail = trailsRes.data.find((t) => t.id === urlTrailId)
          if (matchedTrail && matchedTrail.pandal_ids.length > 0) {
            setSelectedIds(matchedTrail.pandal_ids)
            setMode(matchedTrail.default_mode)
          }
        } else if (urlPandalIds) {
          const parsedIds = urlPandalIds
            .split(',')
            .map(Number)
            .filter((id) => !isNaN(id))
          if (parsedIds.length > 0) {
            setSelectedIds(parsedIds)
          }
        }
      } catch {
        setCalcError('Could not load pandals and trails from the server.')
      } finally {
        setLoadingInitial(false)
      }
    }
    loadData()
  }, [])

  // Update routeResult with real-time crowd reports
  useEffect(() => {
    if (!lastUpdate || !routeResult) return

    setRouteResult((prev) => {
      if (!prev) return null
      let updatedStops = prev.stops.map((stop) => {
        if (stop.pandal.id === lastUpdate.pandal_id) {
          const newWait =
            lastUpdate.waiting_time_minutes ??
            (lastUpdate.crowd_level === 'HIGH' ? 45 : lastUpdate.crowd_level === 'MODERATE' ? 20 : 10)
          return {
            ...stop,
            queue_wait_minutes: newWait,
            pandal: {
              ...stop.pandal,
              crowd_level: lastUpdate.crowd_level,
              waiting_time_minutes: lastUpdate.waiting_time_minutes,
              crowd_updated_at: lastUpdate.crowd_updated_at ?? lastUpdate.ts,
            },
          }
        }
        return stop
      })

      // Recalculate totals
      let totalQueue = updatedStops.reduce((sum, s) => sum + s.queue_wait_minutes, 0)
      let warnings: string[] = []
      updatedStops.forEach((s) => {
        if (s.queue_wait_minutes >= 40) {
          warnings.push(`🔥 High queue at ${s.pandal.name} (~${s.queue_wait_minutes}m wait at entry gate).`)
        }
      })

      return {
        ...prev,
        stops: updatedStops,
        total_queue_minutes: totalQueue,
        total_circuit_minutes: prev.total_travel_minutes + totalQueue + prev.total_dwell_minutes,
        bottleneck_warnings: warnings,
      }
    })
  }, [lastUpdate])

  // GPS location handler
  async function handleGetGps() {
    setLocating(true)
    setGpsError('')
    try {
      const pos = await getPosition()
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setGpsCoords(coords)
      setStartType('gps')
    } catch {
      setGpsError('Could not detect location. Please allow GPS access in your browser.')
    } finally {
      setLocating(false)
    }
  }

  // Toggle pandal selection
  function togglePandal(id: number) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pId) => pId !== id)
      }
      if (prev.length >= 15) {
        alert('You can select up to 15 pandals per circuit.')
        return prev
      }
      return [...prev, id]
    })
  }

  // Load a curated trail into generator
  function loadTrail(trail: CuratedTrail) {
    if (trail.pandal_ids.length === 0) {
      // Fallback match by name
      const nameMap = new Map(pandals.map((p) => [p.name.trim().toLowerCase(), p.id]))
      const ids = trail.pandal_names
        .map((name) => nameMap.get(name.trim().toLowerCase()))
        .filter((id): id is number => id !== undefined)
      setSelectedIds(ids)
    } else {
      setSelectedIds(trail.pandal_ids)
    }
    setMode(trail.default_mode)
    setSearchParams({ trail: trail.id })
    // Smooth scroll to builder
    const builderEl = document.getElementById('route-generator')
    if (builderEl) {
      builderEl.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Calculate Optimal Route
  async function handleCalculateRoute() {
    if (selectedIds.length < 2) {
      setCalcError('Please select at least 2 pandals to generate an optimal circuit.')
      return
    }

    setCalculating(true)
    setCalcError('')

    let startLat: number | null = null
    let startLng: number | null = null
    let startLabel: string | null = null

    if (startType === 'gps' && gpsCoords) {
      startLat = gpsCoords.lat
      startLng = gpsCoords.lng
      startLabel = 'My Current Location'
    } else if (startType === 'preset' && selectedPreset) {
      startLat = selectedPreset.lat
      startLng = selectedPreset.lng
      startLabel = selectedPreset.label
    }

    try {
      const res = await api.post<OptimizedRouteResponse>('/routes/optimize', {
        pandal_ids: selectedIds,
        start_lat: startLat,
        start_lng: startLng,
        start_label: startLabel,
        mode,
        optimize: optimizeTSP,
      })
      setRouteResult(res.data)

      // Scroll to results
      setTimeout(() => {
        const resultEl = document.getElementById('route-results')
        if (resultEl) {
          resultEl.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    } catch (err: any) {
      setCalcError(err?.response?.data?.detail || 'Failed to calculate optimal route. Please try again.')
    } finally {
      setCalculating(false)
    }
  }

  // Move stop up or down in manual order
  function moveStop(index: number, direction: 'up' | 'down') {
    if (!routeResult) return
    const newStops = [...routeResult.stops]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= newStops.length) return

    const temp = newStops[index]
    newStops[index] = newStops[targetIdx]
    newStops[targetIdx] = temp

    const newIds = newStops.map((s) => s.pandal.id)
    setSelectedIds(newIds)
    setOptimizeTSP(false)

    // Recalculate with new order
    api
      .post<OptimizedRouteResponse>('/routes/optimize', {
        pandal_ids: newIds,
        mode,
        optimize: false,
      })
      .then((res) => setRouteResult(res.data))
      .catch(() => {})
  }

  // Copy route summary to clipboard for WhatsApp sharing
  function copySummary() {
    if (!routeResult) return
    const textLines = [
      `🪔 *Durga Puja Pandal Hopping Route* (${routeResult.mode.toUpperCase()})`,
      `⏱️ Total Circuit Time: ~${formatDuration(routeResult.total_circuit_minutes)}`,
      `📏 Total Distance: ${routeResult.total_distance_km} km · ${routeResult.total_stops} Stops`,
      `⏳ Estimated Queue Wait: ~${formatDuration(routeResult.total_queue_minutes)}`,
      '',
      '*Visiting Sequence:*',
      ...routeResult.stops.map(
        (s, idx) =>
          `${idx + 1}. *${s.pandal.name}* (${s.pandal.locality ?? ''}) — ⏳ Queue ~${s.queue_wait_minutes}m ${
            s.leg_from_previous ? `(🚶 ${s.leg_from_previous.distance_km}km / ${s.leg_from_previous.travel_minutes}m)` : ''
          }`,
      ),
      '',
      `🗺️ Full Google Maps Circuit: ${routeResult.google_maps_multi_stop_url}`,
      'Shared via PujaFinder Kolkata',
    ]
    navigator.clipboard.writeText(textLines.join('\n'))
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  // Distinct localities for filtering
  const localities = useMemo(() => {
    const list = ['All', ...new Set(pandals.map((p) => p.locality).filter(Boolean))] as string[]
    return list
  }, [pandals])

  // Filtered pandals
  const filteredPandals = useMemo(() => {
    return pandals.filter((p) => {
      const matchSearch =
        searchFilter === '' ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.theme && p.theme.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (p.locality && p.locality.toLowerCase().includes(searchFilter.toLowerCase()))
      const matchLocality = activeLocality === 'All' || p.locality === activeLocality
      return matchSearch && matchLocality
    })
  }, [pandals, searchFilter, activeLocality])

  const selectedPandalObjects = useMemo(() => {
    const map = new Map(pandals.map((p) => [p.id, p]))
    return selectedIds.map((id) => map.get(id)).filter((p): p is Pandal => p !== undefined)
  }, [pandals, selectedIds])

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section with Reference Photo (Thakurdalan Archway & Kash Phool) */}
      <section className="relative overflow-hidden rounded-3xl border border-red-200 bg-white p-6 sm:p-10 mb-10 shadow-lg">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 absolute top-0 left-0 right-0" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 mb-4">
              <span>🌾</span> শারদীয়া পরিক্রমা ২০২৬ ✦ TSP Route Optimization &amp; Live Queue AI
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Smart <span className="sindoor-text">Pandal Hopping</span> &amp; Route Planner
            </h1>
            <p className="mt-3 text-stone-600 max-w-3xl text-sm sm:text-base leading-relaxed font-medium">
              Select your favorite pandals or pick a curated Kolkata festival trail. Our Traveling Salesperson Algorithm
              calculates the optimal walking or driving sequence to minimize travel time, avoid bottlenecks, and beat long queues.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-stone-600 font-medium">
              <span className="flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                <span className="text-red-600">🤖</span> Shortest TSP Path
              </span>
              <span className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 text-emerald-800">
                <span>🟢</span> Live Queue Times
              </span>
              <span className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 text-amber-900">
                <span>🗺️</span> Google Maps Multi-Stop Export
              </span>
              <div className="ml-auto flex items-center gap-2">
                <LiveBadge connected={connected} />
                <span className="text-xs text-stone-500 font-normal">Live Crowd Sync</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center">
            <div className="w-52 h-44 rounded-2xl overflow-hidden border-2 border-red-200 shadow-md">
              <img
                src="/assets/archway-dhunuchi-kash.jpg"
                alt="Pandal Hopping Trail Archway"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: Curated Themed Trails */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-stone-900" style={{ fontFamily: "'Cinzel', serif" }}>
              <span>🏛️</span> Curated Themed Trails
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-0.5 font-medium">
              Hand-crafted Kolkata itineraries ready to explore in one click
            </p>
          </div>
          <span className="text-xs text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full border border-red-200">
            {trails.length} Pre-made Itineraries
          </span>
        </div>

        {loadingInitial ? (
          <div className="p-8 text-center text-stone-500 rounded-2xl border border-red-100 bg-white shadow-xs">
            Loading curated trails…
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trails.map((trail) => (
              <div
                key={trail.id}
                className="flex flex-col justify-between rounded-2xl border border-red-100 bg-white p-5 hover:border-red-300 transition shadow-md hover:shadow-xl group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-2xl p-2 rounded-xl bg-red-50 border border-red-200">
                      {trail.icon}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-red-800">
                      {trail.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-red-700 transition" style={{ fontFamily: "'Cinzel', serif" }}>
                    {trail.title}
                  </h3>
                  <p className="text-xs text-amber-700 font-semibold mt-0.5 mb-2.5">
                    {trail.subtitle}
                  </p>
                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mb-4">
                    {trail.description}
                  </p>

                  {/* Highlights pill */}
                  <div className="space-y-1.5 mb-4 text-[11px] text-stone-700 bg-red-50/50 rounded-xl p-3 border border-red-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500 font-medium">🎨 Focus:</span>
                      <span className="truncate font-semibold text-stone-800">{trail.theme_focus}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500 font-medium">🌙 Best Time:</span>
                      <span className="font-semibold text-stone-800">{trail.best_time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500 font-medium">🚶 Mode:</span>
                      <span className="capitalize font-bold text-red-700">{trail.default_mode}</span>
                    </div>
                  </div>

                  {/* Pandals list */}
                  <div className="mb-5">
                    <p className="text-[11px] uppercase tracking-wider text-stone-500 font-bold mb-2">
                      Stops ({trail.pandal_names.length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {trail.pandal_names.map((name, i) => (
                        <span
                          key={name}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-stone-700 font-medium"
                        >
                          {i + 1}. {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => loadTrail(trail)}
                  className="w-full rounded-xl text-white font-bold py-2.5 px-4 text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md hover:brightness-105"
                  style={{
                    background: 'linear-gradient(135deg, #D31027 0%, #EF4444 100%)',
                  }}
                >
                  <span>⚡ Load Trail into Generator</span>
                  <span className="text-base leading-none">→</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2: Interactive "Pandal Hop" Route Generator */}
      <section
        id="route-generator"
        className="rounded-3xl border border-red-100 bg-white p-6 sm:p-8 mb-10 shadow-lg"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 pb-6 border-b border-red-100">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-stone-900" style={{ fontFamily: "'Cinzel', serif" }}>
              <span>⚡</span> "Pandal Hop" Route Generator
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium">
              Select 2 to 15 pandals to calculate the fastest traveling salesperson circuit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold border ${
                selectedIds.length >= 2
                  ? 'bg-red-50 text-red-700 border-red-200 shadow-xs'
                  : 'bg-stone-50 text-stone-600 border-stone-200'
              }`}
            >
              {selectedIds.length} / 15 Selected
            </span>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs font-semibold text-stone-600 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition shadow-xs"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Configuration Toolbar */}
        {/* Configuration Toolbar */}
        <div className="grid gap-6 md:grid-cols-3 my-6">
          {/* 1. Start Location */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 shadow-xs">
            <label className="text-xs uppercase tracking-wider font-bold text-red-900 block mb-2">
              📍 1. Starting Location
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setStartType('pandal')}
                className={`w-full text-left text-xs p-2.5 rounded-xl border transition ${
                  startType === 'pandal'
                    ? 'border-red-500 bg-white text-red-700 font-bold shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-red-300'
                }`}
              >
                🛕 First Selected Pandal as Start
              </button>

              <button
                onClick={handleGetGps}
                disabled={locating}
                className={`w-full text-left text-xs p-2.5 rounded-xl border transition flex items-center justify-between ${
                  startType === 'gps' && gpsCoords
                    ? 'border-red-500 bg-white text-red-700 font-bold shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-red-300'
                }`}
              >
                <span>📍 My Current Location (GPS)</span>
                {locating && <span className="animate-spin">⌛</span>}
              </button>

              {/* Transit Presets */}
              <div className="relative">
                <select
                  value={selectedPreset?.label ?? ''}
                  onChange={(e) => {
                    const found = START_PRESETS.find((p) => p.label === e.target.value)
                    if (found) {
                      setSelectedPreset(found)
                      setStartType('preset')
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 outline-none focus:border-red-500 font-medium"
                >
                  <option value="">🚇 Or Select Metro / Transit Hub…</option>
                  {START_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.icon} {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {gpsError && <p className="text-[11px] text-red-600 font-semibold">{gpsError}</p>}
            </div>
          </div>

          {/* 2. Transit Mode */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 shadow-xs">
            <label className="text-xs uppercase tracking-wider font-bold text-red-900 block mb-2">
              🚶 2. Transit Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('walking')}
                className={`p-3 rounded-xl border text-xs font-semibold text-center transition ${
                  mode === 'walking'
                    ? 'border-red-500 bg-white text-red-700 font-bold shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-red-300'
                }`}
              >
                <div className="text-lg mb-1">🚶</div>
                Walking
                <div className="text-[10px] text-stone-500 font-normal mt-0.5">~4.2 km/h (Crowd adj.)</div>
              </button>

              <button
                onClick={() => setMode('driving')}
                className={`p-3 rounded-xl border text-xs font-semibold text-center transition ${
                  mode === 'driving'
                    ? 'border-red-500 bg-white text-red-700 font-bold shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-red-300'
                }`}
              >
                <div className="text-lg mb-1">🚗</div>
                Driving / Cab
                <div className="text-[10px] text-stone-500 font-normal mt-0.5">~18 km/h (Traffic adj.)</div>
              </button>
            </div>
          </div>

          {/* 3. TSP Optimizer Toggle & Action */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col justify-between shadow-xs">
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-red-900 block mb-2">
                🤖 3. Route Optimization
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-white border border-stone-200 text-xs">
                <input
                  type="checkbox"
                  checked={optimizeTSP}
                  onChange={(e) => setOptimizeTSP(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4 bg-white"
                />
                <div>
                  <span className="font-bold text-stone-800">Traveling Salesperson (TSP)</span>
                  <p className="text-[10px] text-stone-500 font-medium">Reorders stops to minimize total travel time</p>
                </div>
              </label>
            </div>

            <button
              onClick={handleCalculateRoute}
              disabled={calculating || selectedIds.length < 2}
              className="mt-3 w-full rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 text-sm transition flex items-center justify-center gap-2 shadow-md hover:brightness-105"
              style={{
                background: 'linear-gradient(135deg, #D31027 0%, #EF4444 100%)',
              }}
            >
              {calculating ? (
                <>
                  <span className="animate-spin">⌛</span>
                  <span>Optimizing Circuit…</span>
                </>
              ) : (
                <>
                  <span>🚀 Calculate Fastest Circuit</span>
                  <span className="text-base leading-none">→</span>
                </>
              )}
            </button>
          </div>
        </div>

        {calcError && (
          <div className="rounded-xl border border-red-800/80 bg-red-950/50 text-red-300 px-4 py-3 mb-6 text-xs sm:text-sm">
            {calcError}
          </div>
        )}

        {/* Selected Pandals Strip */}
        {selectedPandalObjects.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-900">
                Selected Stops Queue ({selectedPandalObjects.length})
              </span>
              <span className="text-[11px] text-stone-500 font-medium">Click ✕ to remove</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedPandalObjects.map((p, idx) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-2 text-xs py-1 px-3 rounded-xl border border-red-200 bg-white text-stone-800 shadow-xs font-semibold"
                >
                  <span className="text-red-600 font-bold">#{idx + 1}</span>
                  <span className="font-bold text-stone-900">{p.name}</span>
                  <span className="text-stone-500 text-[11px] font-normal">({p.locality ?? ''})</span>
                  <button
                    onClick={() => togglePandal(p.id)}
                    className="text-stone-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pandals Selection Catalog */}
        <div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
            <h3 className="text-lg font-black text-stone-900 font-cinzel">
              Browse &amp; Pick Pandals ({filteredPandals.length})
            </h3>
            <div className="flex-1 max-w-sm">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search pandal name, locality, theme…"
                className="w-full text-xs rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-stone-900 placeholder:text-stone-400 outline-none focus:border-red-500 shadow-xs font-medium"
              />
            </div>
          </div>

          {/* Locality Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {localities.slice(0, 10).map((loc) => (
              <button
                key={loc}
                onClick={() => setActiveLocality(loc)}
                className={`text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap border transition cursor-pointer font-semibold ${
                  activeLocality === loc
                    ? 'border-red-600 bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-red-200 hover:text-red-700'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* Grid of pandals */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto pr-1">
            {filteredPandals.map((p) => {
              const isSelected = selectedIds.includes(p.id)
              const selectedIdx = selectedIds.indexOf(p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => togglePandal(p.id)}
                  className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-red-500 bg-red-50/70 text-stone-900 shadow-md ring-2 ring-red-400/30'
                      : 'border-red-100 bg-white hover:border-red-300 text-stone-800 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-stone-900 truncate">{p.name}</span>
                    </div>
                    <p className="text-xs text-stone-500 truncate mb-1 font-medium">
                      📍 {p.locality ?? p.address}
                    </p>
                    {p.theme && (
                      <p className="text-[11px] text-red-700 font-semibold truncate mb-2">
                        🎨 {p.theme}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <CrowdBadge
                        level={p.crowd_level}
                        wait={p.waiting_time_minutes}
                        asOf={p.crowd_updated_at}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isSelected ? (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs shadow-xs">
                        {selectedIdx + 1}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full border border-stone-300 text-stone-500 text-xs hover:border-red-500 hover:text-red-600 font-bold">
                        +
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: Calculated Optimal Itinerary Results */}
      {routeResult && (
        <section
          id="route-results"
          className="rounded-3xl border border-red-200 bg-white p-6 sm:p-8 mb-12 shadow-xl"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider mb-1">
                <span>⚡ Traveling Salesperson Route Generated</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 font-cinzel">
                Your Optimized Pandal Hop Itinerary
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5 font-medium">
                Stops ordered to minimize walking distance and peak crowd congestion.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copySummary}
                className="rounded-xl border border-stone-300 hover:border-red-300 bg-stone-50 text-stone-800 text-xs font-bold px-4 py-2.5 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>{copiedSummary ? '✓ Copied!' : '📋 Share Route (WhatsApp)'}</span>
              </button>

              <a
                href={routeResult.google_maps_multi_stop_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 transition flex items-center gap-2 shadow-md shadow-red-500/20"
              >
                <span>🗺️ Open Full Multi-Stop Google Maps</span>
                <span className="text-base leading-none">↗</span>
              </a>
            </div>
          </div>

          {/* Metric Overview Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-6">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
              <span className="text-stone-500 text-xs font-medium block mb-1">Total Distance</span>
              <span className="text-xl sm:text-2xl font-black text-red-600">
                {routeResult.total_distance_km} <span className="text-sm font-normal text-stone-600">km</span>
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
              <span className="text-stone-500 text-xs font-medium block mb-1">Transit Time</span>
              <span className="text-xl sm:text-2xl font-black text-stone-900">
                {formatDuration(routeResult.total_travel_minutes)}
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
              <span className="text-stone-500 text-xs font-medium block mb-1">Queue Waiting</span>
              <span className="text-xl sm:text-2xl font-black text-amber-600">
                {formatDuration(routeResult.total_queue_minutes)}
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
              <span className="text-stone-500 text-xs font-medium block mb-1">Pandal Viewing</span>
              <span className="text-xl sm:text-2xl font-black text-stone-800">
                {formatDuration(routeResult.total_dwell_minutes)}
              </span>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center col-span-2 sm:col-span-1">
              <span className="text-red-800 text-xs font-bold block mb-1">Total Circuit</span>
              <span className="text-xl sm:text-2xl font-black text-red-700">
                {formatDuration(routeResult.total_circuit_minutes)}
              </span>
            </div>
          </div>

          {/* Bottleneck Warnings */}
          {routeResult.bottleneck_warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-6">
              <div className="flex items-center gap-2 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
                <span>⚠️ Peak Bottleneck &amp; Queue Alerts</span>
              </div>
              <ul className="space-y-1.5 text-xs text-stone-700 font-medium">
                {routeResult.bottleneck_warnings.map((warn, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 shrink-0">•</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step-by-Step Circuit Timeline */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-stone-900 mb-4 font-cinzel">
              Step-by-Step Optimized Circuit ({routeResult.stops.length} Stops)
            </h3>

            {routeResult.stops.map((stop, idx) => {
              const isFirst = idx === 0
              const isLast = idx === routeResult.stops.length - 1

              return (
                <div key={stop.pandal.id} className="relative">
                  {/* Leg transit connector */}
                  {stop.leg_from_previous && (
                    <div className="flex items-center gap-3 py-2.5 px-4 ml-6 border-l-2 border-dashed border-red-300 text-xs text-stone-600 font-medium">
                      <span className="text-red-600 font-bold">
                        {routeResult.mode === 'walking' ? '🚶' : '🚗'}
                      </span>
                      <span>
                        {routeResult.mode === 'walking' ? 'Walk' : 'Drive'} {stop.leg_from_previous.distance_km} km (≈{stop.leg_from_previous.travel_minutes} mins)
                      </span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-500">
                        Elapsed: ~{formatDuration(stop.cumulative_travel_minutes + stop.cumulative_queue_minutes)}
                      </span>
                    </div>
                  )}

                  {/* Stop Card */}
                  <div className="rounded-2xl border border-red-100 bg-white p-5 hover:border-red-300 hover:shadow-md transition">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {/* Step Number Badge */}
                        <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white font-black text-sm shrink-0 shadow-md">
                          {stop.step_number}
                        </div>

                        {/* Pandal details */}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/pandals/${stop.pandal.id}`}
                              className="text-base sm:text-lg font-bold text-stone-900 hover:text-red-700 transition"
                            >
                              {stop.pandal.name}
                            </Link>
                            {stop.pandal.locality && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-semibold">
                                {stop.pandal.locality}
                              </span>
                            )}
                          </div>

                          {stop.pandal.theme && (
                            <p className="text-xs text-red-700 font-semibold mt-0.5">
                              🎨 Theme: {stop.pandal.theme}
                            </p>
                          )}

                          <p className="text-xs text-stone-500 mt-1 font-medium">
                            📍 {stop.pandal.address}
                          </p>

                          {/* Queue & Timing Metrics */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-700 font-medium">
                              <span className="text-amber-600 font-bold">⏳ Queue Estimate:</span>
                              <span
                                className={`font-bold ${
                                  stop.queue_wait_minutes >= 35
                                    ? 'text-red-700'
                                    : stop.queue_wait_minutes >= 20
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                ~{stop.queue_wait_minutes} mins wait at gate
                              </span>
                            </div>

                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-600 font-medium">
                              <span>🪔 Viewing:</span>
                              <span className="text-stone-800 font-semibold">~{stop.recommended_dwell_minutes} mins</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stop Actions & Manual Reordering */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <a
                          href={stop.google_maps_nav_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 transition flex items-center gap-1 shadow-xs"
                        >
                          <span>🗺️ Single Leg Nav</span>
                          <span className="text-xs leading-none">↗</span>
                        </a>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveStop(idx, 'up')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg border border-stone-200 hover:border-red-300 hover:text-red-600 disabled:opacity-30 text-stone-500 text-xs transition cursor-pointer"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveStop(idx, 'down')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg border border-stone-200 hover:border-red-300 hover:text-red-600 disabled:opacity-30 text-stone-500 text-xs transition cursor-pointer"
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer Action */}
          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-stone-500 font-medium">
              💡 Tip: Save this circuit or tap "Open Full Multi-Stop Google Maps" before starting your evening parikrama.
            </p>
            <a
              href={routeResult.google_maps_multi_stop_url}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold px-6 py-3 transition text-center shadow-md shadow-red-500/20"
            >
              🚀 Launch Multi-Stop GPS Navigation →
            </a>
          </div>
        </section>
      )}
    </main>
  )
}
