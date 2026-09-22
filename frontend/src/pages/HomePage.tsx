import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import ExactAge from '../components/ExactAge'
import LiveBadge from '../components/LiveBadge'
import PandalCard from '../components/PandalCard'
import AgomoniHero from '../components/home/AgomoniHero'
import PandalCardSkeleton from '../components/skeletons/PandalCardSkeleton'
import { useLiveCrowd } from '../hooks/useLiveCrowd'
import type { Pandal } from '../types'
import { goNearMe } from '../utils/geo'

type SortKey = 'distance' | 'crowd' | 'rating' | 'name'
type ZoneKey = 'ALL' | 'NORTH' | 'SOUTH' | 'EAST' | 'CENTRAL' | 'HOWRAH'

const ZONE_CONFIG: { id: ZoneKey; label: string; icon: string }[] = [
  { id: 'ALL', label: 'All Zones', icon: '🌟' },
  { id: 'NORTH', label: 'North Heritage', icon: '🏛️' },
  { id: 'SOUTH', label: 'South Kolkata', icon: '🎨' },
  { id: 'EAST', label: 'Salt Lake & East', icon: '🌆' },
  { id: 'CENTRAL', label: 'Central Kolkata', icon: '🏮' },
  { id: 'HOWRAH', label: 'Howrah', icon: '🌉' },
]

const ZONE_KEYWORDS: Record<ZoneKey, string[]> = {
  ALL: [],
  NORTH: ['north', 'bagbazar', 'sovabazar', 'kumartuli', 'hatibagan', 'ahiritola', 'tala', 'shyambazar', 'kashi bose', 'simla', 'girish'],
  SOUTH: ['south', 'ballygunge', 'gariahath', 'gariahat', 'ekdalia', 'deshapriya', 'jodhpur', 'behala', 'mudiali', 'shiv mandir', 'suruchi', 'chetla', 'maddox', 'alipore', 'naktala', 'hazra'],
  EAST: ['salt lake', 'newtown', 'new town', 'lake town', 'sreebhumi', 'ultadanga', 'kankurgachi', 'dum dum', 'rajarhat', 'bidhannagar', 'fd block'],
  CENTRAL: ['central', 'college square', 'md ali', 'bowbazar', 'santosh mitra', 'sealdah', 'esplanade', 'chandni', 'chittaranjan', 'burrabazar'],
  HOWRAH: ['howrah', 'shibpur', 'salkia', 'bally', 'belur'],
}

const CROWD_ORDER: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2 }

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const lat = params.get('lat')
  const lng = params.get('lng')
  const nearMode = lat != null && lng != null
  const nearError = params.get('near') === 'error'

  const [pandals, setPandals] = useState<Pandal[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [selectedZone, setSelectedZone] = useState<ZoneKey>('ALL')
  const [openOnly, setOpenOnly] = useState(false)
  const [coolingOnly, setCoolingOnly] = useState(false)
  const [seniorOnly, setSeniorOnly] = useState(false)
  const [directOnly, setDirectOnly] = useState(false)

  // Dhak Audio Synthesizer State
  const [isDhakPlaying, setIsDhakPlaying] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const dhakTimerRef = useRef<number | null>(null)

  // Global live crowd feed
  const { lastUpdate, snapshot, connected } = useLiveCrowd('all')
  const [lastLiveLabel, setLastLiveLabel] = useState('')

  // Synthesize authentic Bengali Dhak beat ("ধাং কুড় কুড় ধাং কুড় কুড়") using Web Audio API
  const toggleDhakSound = () => {
    if (isDhakPlaying) {
      if (dhakTimerRef.current) clearInterval(dhakTimerRef.current)
      setIsDhakPlaying(false)
      return
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      setIsDhakPlaying(true)

      const playDhakStroke = (isBass: boolean, timeOffset = 0) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const now = ctx.currentTime + timeOffset

        osc.type = isBass ? 'triangle' : 'sine'
        const freq = isBass ? 110 : 280
        osc.frequency.setValueAtTime(freq, now)
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.18)

        gain.gain.setValueAtTime(isBass ? 0.7 : 0.4, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isBass ? 0.22 : 0.12))

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.25)
      }

      // Traditional Dhak Bol: Dhang ... kur kur Dhang ... kur kur
      const playPattern = () => {
        playDhakStroke(true, 0)       // Dhang
        playDhakStroke(false, 0.2)    // Kur
        playDhakStroke(false, 0.35)   // Kur
        playDhakStroke(true, 0.55)    // Dhang
        playDhakStroke(false, 0.75)   // Kur
        playDhakStroke(false, 0.9)    // Kur
      }

      playPattern()
      const timer = window.setInterval(playPattern, 1200)
      dhakTimerRef.current = timer
    } catch {
      setIsDhakPlaying(false)
    }
  }

  useEffect(() => {
    return () => {
      if (dhakTimerRef.current) clearInterval(dhakTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!lastUpdate) return
    setPandals((prev) =>
      prev.map((p) =>
        p.id === lastUpdate.pandal_id
          ? {
              ...p,
              crowd_level: lastUpdate.crowd_level,
              waiting_time_minutes: lastUpdate.waiting_time_minutes,
              crowd_updated_at: lastUpdate.crowd_updated_at ?? lastUpdate.ts,
              crowd_trend: lastUpdate.crowd_trend ?? p.crowd_trend,
              approach_traffic: lastUpdate.approach_traffic ?? p.approach_traffic,
              barricade_distance: lastUpdate.barricade_distance ?? p.barricade_distance,
              comfort_tags: lastUpdate.comfort_tags && lastUpdate.comfort_tags.length > 0 ? lastUpdate.comfort_tags : p.comfort_tags,
            }
          : p,
      ),
    )
    const name = lastUpdate.pandal_name ?? `Pandal #${lastUpdate.pandal_id}`
    setLastLiveLabel(`${name} → ${lastUpdate.reported}${lastUpdate.comment ? ` — “${lastUpdate.comment}”` : ''}`)
  }, [lastUpdate])

  useEffect(() => {
    if (!snapshot) return
    const byId = new Map(snapshot.estimates.map((e) => [e.pandal_id, e]))
    setPandals((prev) =>
      prev.map((p) => {
        const est = byId.get(p.id)
        if (!est || !est.crowd_level) return p
        return {
          ...p,
          crowd_level: est.crowd_level,
          waiting_time_minutes: est.waiting_time_minutes,
          crowd_updated_at: est.crowd_updated_at,
        }
      }),
    )
  }, [snapshot])

  useEffect(() => {
    if (nearMode) setSort('distance')
    else setSort('name')
  }, [nearMode])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      const req = nearMode
        ? api.get<Pandal[]>('/pandals/nearby', { params: { lat, lng, radius_km: 5 } })
        : api.get<Pandal[]>('/pandals', { params: search ? { search } : {} })
      req
        .then((res) => {
          setPandals(res.data)
          setError('')
        })
        .catch(() => setError('Could not reach the API. Is the backend running on port 8000?'))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search, lat, lng, nearMode])

  const localities = useMemo(
    () => [...new Set(pandals.map((p) => p.locality).filter(Boolean))] as string[],
    [pandals],
  )

  const visible = useMemo(() => {
    let list = openOnly ? pandals.filter((p) => p.open_now !== false) : [...pandals]
    if (coolingOnly) {
      list = list.filter((p) => p.crowd_trend === 'COOLING' || p.crowd_level === 'LOW')
    }
    if (seniorOnly) {
      list = list.filter((p) =>
        (p.comfort_tags || []).some((t) =>
          ['SENIOR_FRIENDLY', 'SENIOR_QUEUE', 'WHEELCHAIR_OK', 'STROLLER_OK'].includes(t),
        ),
      )
    }
    if (directOnly) {
      list = list.filter((p) => p.barricade_distance === 'DIRECT')
    }

    if (selectedZone !== 'ALL') {
      const kws = ZONE_KEYWORDS[selectedZone]
      list = list.filter((p) => {
        const text = `${p.locality || ''} ${p.address || ''} ${p.name || ''}`.toLowerCase()
        return kws.some((kw) => text.includes(kw))
      })
    }

    switch (sort) {
      case 'distance':
        return list.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
      case 'crowd':
        return list.sort((a, b) => {
          const ca = a.crowd_level ? CROWD_ORDER[a.crowd_level] ?? 1 : 1
          const cb = b.crowd_level ? CROWD_ORDER[b.crowd_level] ?? 1 : 1
          return ca - cb
        })
      case 'rating':
        return list.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
      case 'name':
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [pandals, sort, selectedZone, openOnly, coolingOnly, seniorOnly, directOnly])

  const chip = (activeState: boolean) =>
    `text-xs px-3.5 py-1.5 rounded-full border transition-all duration-200 cursor-pointer font-semibold ${
      activeState
        ? 'border-red-600 bg-red-600 text-white shadow-sm'
        : 'border-red-200 bg-white text-stone-700 hover:border-red-400 hover:text-red-700 hover:bg-red-50/50'
    }`

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {/* ── Top Traditional Marigold Garland Decoration ── */}
      <div className="flex justify-between items-center px-4 -mb-2 pointer-events-none select-none overflow-hidden opacity-90">
        <div className="flex gap-4 text-amber-500 text-lg animate-marigold-sway">
          <span>🌼</span><span>🏵️</span><span>🌼</span><span>🏵️</span><span>🌼</span>
        </div>
        <div className="hidden sm:flex gap-4 text-amber-500 text-lg animate-marigold-sway">
          <span>🏵️</span><span>🌼</span><span>🏵️</span><span>🌼</span><span>🏵️</span>
        </div>
        <div className="flex gap-4 text-amber-500 text-lg animate-marigold-sway">
          <span>🌼</span><span>🏵️</span><span>🌼</span><span>🏵️</span><span>🌼</span>
        </div>
      </div>

      {/* ── HERO SECTION: MAA DURGA AGOMONI (CELESTIAL DESCENT & LIGHTNING) ── */}
      <AgomoniHero
        search={search}
        setSearch={setSearch}
        pandals={pandals}
        openOnly={openOnly}
        setOpenOnly={setOpenOnly}
        isDhakPlaying={isDhakPlaying}
        toggleDhakSound={toggleDhakSound}
      />

      {/* ── Featured Curated Trails Promo (Bright White & Red with Archway Art) ── */}
      <section
        className="mb-8 rounded-2xl p-6 shadow-md bg-white border border-red-100 relative overflow-hidden"
        style={{
          boxShadow: '0 4px 20px rgba(211, 16, 39, 0.05)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-red-200 shrink-0 shadow-sm hidden sm:block">
              <img
                src="/assets/archway-dhunuchi-kash.jpg"
                alt="Thakurdalan Archway"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-200 inline-block mb-1"
              >
                ✨ Smart Pandal Hopping 2026
              </span>
              <h2
                className="text-lg sm:text-xl font-bold text-stone-900"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Explore Curated Themed Trails &amp; Optimize Your Circuit
              </h2>
              <p className="text-xs sm:text-sm mt-0.5 text-stone-600 font-medium">
                🏛️ <em>North Kolkata Heritage</em> · 🎨 <em>South Kolkata Mega Art</em> · 🌟{' '}
                <em>Newtown &amp; Salt Lake Modern</em>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/planner"
              className="rounded-xl font-bold text-xs sm:text-sm px-5 py-3 text-white transition-all shrink-0 shadow-md hover:shadow-lg hover:brightness-105"
              style={{
                background: 'linear-gradient(135deg, #D31027 0%, #EA580C 100%)',
              }}
            >
              Open Route Planner →
            </a>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 px-4 py-3 mb-6 shadow-sm">
          {error}
        </div>
      )}

      {nearError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 mb-6 shadow-sm">
          📡 Couldn't get your location. Allow location access in your browser and try “Near me” again.
        </div>
      )}

      {/* Live feed status */}
      <div className="flex items-center gap-3 mb-5 text-sm bg-white p-3 rounded-xl border border-red-100 shadow-xs">
        <LiveBadge connected={connected} />
        <span className="text-stone-600 font-medium">
          {lastLiveLabel ? (
            <>⚡ {lastLiveLabel} · <ExactAge ts={lastUpdate!.ts} prefix="" className="text-stone-500 font-normal" /></>
          ) : (
            'Watching for live crowd reports from Kolkata pandal hoppers…'
          )}
        </span>
      </div>

      {/* Near-me banner */}
      {nearMode && (
        <div className="flex items-center justify-between flex-wrap gap-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 mb-5 text-sm">
          <span className="text-red-900 font-semibold">
            📍 Showing pandals within 5 km of your location
          </span>
          <button
            onClick={() => setParams({})}
            className="text-xs font-semibold rounded-lg border border-red-300 bg-white px-3 py-1 text-red-700 hover:bg-red-50 transition shadow-xs"
          >
            ✕ Show all
          </button>
        </div>
      )}

      {/* ── Locality / Zone Filter Chips (UX Roadmap Feature) ── */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
          <span className="text-xs font-bold text-stone-500 shrink-0 mr-1">Kolkata Zones:</span>
          {ZONE_CONFIG.map((z) => {
            const isActive = selectedZone === z.id
            return (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-200 shrink-0 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isActive
                    ? 'border-amber-500 bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-bold shadow-amber-200'
                    : 'border-red-200 bg-white text-stone-700 hover:border-red-400 hover:bg-red-50/50'
                }`}
              >
                <span>{z.icon}</span>
                <span>{z.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort & filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="text-xs font-bold text-stone-500 mr-1">Sort & Filter:</span>
        {nearMode && (
          <button className={chip(sort === 'distance')} onClick={() => setSort('distance')}>
            📍 Nearest
          </button>
        )}
        <button className={chip(sort === 'crowd')} onClick={() => setSort('crowd')}>
          🚦 Least crowded
        </button>
        <button className={chip(sort === 'rating')} onClick={() => setSort('rating')}>
          ⭐ Top rated
        </button>
        <button className={chip(sort === 'name')} onClick={() => setSort('name')}>
          🔤 A–Z
        </button>
        <span className="w-px h-5 bg-red-200 mx-1" />
        <button className={chip(openOnly)} onClick={() => setOpenOnly((v) => !v)}>
          🟢 Open now
        </button>
        <button className={chip(coolingOnly)} onClick={() => setCoolingOnly((v) => !v)}>
          🟢 Low Rush
        </button>
        <button className={chip(seniorOnly)} onClick={() => setSeniorOnly((v) => !v)}>
          🧓 Senior &amp; Family
        </button>
        <button className={chip(directOnly)} onClick={() => setDirectOnly((v) => !v)}>
          ⚡ Direct Entry (&lt;200m)
        </button>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PandalCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: "'Cinzel', serif" }}>
              {visible.length} pandal{visible.length !== 1 && 's'}
              {search && <> matching “{search}”</>}
              {openOnly && <> open right now</>}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {localities.slice(0, 6).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setSearch(loc)}
                  className="text-xs px-3 py-1 rounded-full border border-red-200 bg-white text-stone-700 hover:border-red-500 hover:text-red-700 hover:bg-red-50 transition font-medium"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <PandalCard key={p.id} pandal={p} />
            ))}
          </div>

          {visible.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-red-100 p-8 mt-4">
              <span className="text-3xl mb-2 block">🔍</span>
              <p className="text-stone-700 font-semibold">
                No pandals match your filters.
              </p>
              <p className="text-stone-500 text-sm mt-1">
                {openOnly && 'Try turning off the “Open now” filter or '}
                try searching another locality.
              </p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
