import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import ExactAge from '../components/ExactAge'
import LiveBadge from '../components/LiveBadge'
import PandalCard from '../components/PandalCard'
import { useLiveCrowd } from '../hooks/useLiveCrowd'
import type { Pandal } from '../types'
import { goNearMe } from '../utils/geo'

type SortKey = 'distance' | 'crowd' | 'rating' | 'name'

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
  }, [pandals, sort, openOnly, coolingOnly, seniorOnly, directOnly])

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

      {/* ── HERO SECTION: MULTI-LAYERED MAA DURGA PRESENTATION ── */}
      <section
        className="relative rounded-3xl overflow-hidden mb-8 border border-red-200 shadow-xl bg-gradient-to-b from-[#FFFFFF] via-[#FFF8F6] to-[#FFF1EF]"
        style={{
          boxShadow: '0 10px 40px rgba(211, 16, 39, 0.08), 0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Layer 0: Traditional Red & Golden Border Frame Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600" />

        {/* Layer 1: Background Atmospheric Mandala & Floating Kash Phool */}
        <div
          className="absolute -right-20 -top-20 w-96 h-96 rounded-full opacity-20 pointer-events-none animate-halo-rotate"
          style={{
            background: 'radial-gradient(circle, #D31027 0%, #F59E0B 40%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />

        <div className="relative p-6 sm:p-10 z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content Area: Bengali greetings, Typography & Actions */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              {/* Bengali Welcome Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-100/80 border border-red-300 text-red-800 text-xs font-bangla font-semibold mb-3">
                <span className="text-sm">🪔</span> আসছে পুজো, বাজছে ঢাক ✦ শুভ শারদীয়া ২০২৬
              </div>

              {/* Layer 3 Overlay: Bengali Calligraphy Sharodiya Durgotsav Artwork */}
              <div className="mb-3 max-w-sm">
                <img
                  src="/assets/sharodiya-durgotsav-logo.png"
                  alt="শারদীয় দুর্গোৎসব - Sharodiya Durgotsav"
                  className="w-56 sm:w-64 h-auto drop-shadow-sm hover:scale-102 transition-transform"
                />
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-stone-900 leading-tight"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Kolkata <span className="sindoor-text">Durga Puja</span> Pandal Finder
              </h1>

              <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed max-w-xl font-medium">
                Live crowd telemetry, wait times, themes, and curated walking circuits for Kolkata's grandest pandals — from North Kolkata heritage to South Kolkata art spectacles.
              </p>

              {/* Search & Quick Actions */}
              <div className="mt-6 flex flex-col sm:flex-row gap-2.5 w-full max-w-xl">
                <div className="relative flex-1">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search pandal, locality or theme…"
                    className="w-full rounded-xl px-4 py-3 bg-white border border-red-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm text-sm"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-3 text-xs text-stone-400 hover:text-stone-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  onClick={() => goNearMe(navigate)}
                  className="rounded-xl font-bold px-5 py-3 text-center transition-all text-white flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg hover:brightness-105 shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #D31027 0%, #B91C1C 100%)',
                  }}
                >
                  📍 Near me
                </button>

                <a
                  href="/planner"
                  className="rounded-xl font-bold px-5 py-3 text-center transition-all flex items-center justify-center gap-1.5 text-stone-900 bg-amber-400 hover:bg-amber-300 shadow-md hover:shadow-lg shrink-0"
                >
                  🧭 Route Planner
                </a>
              </div>

              {/* Bengali Dhak Rhythm Touch */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={toggleDhakSound}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    isDhakPlaying
                      ? 'bg-red-600 text-white border-red-700 animate-bounce shadow-md'
                      : 'bg-white text-red-700 border-red-300 hover:bg-red-50 shadow-xs'
                  }`}
                  title="Click to hear traditional Bengali Dhak beats"
                >
                  <span className="text-sm">🥁</span>
                  {isDhakPlaying ? 'ঢাকের আওয়াজ বাজছে… (থামাতে ক্লিক করুন)' : 'ঢাকের আওয়াজ শুনুন (Play Dhak Beats)'}
                </button>
                <span className="text-xs text-stone-500 italic hidden sm:inline">
                  ধাং কুড় কুড় ধাং কুড় কুড় ✦
                </span>
              </div>
            </div>

            {/* Right Layer: Multi-Layered Maa Durga Composition */}
            <div className="lg:col-span-5 relative flex items-center justify-center min-h-[320px] sm:min-h-[380px]">
              {/* LAYER 1: The Divine Glowing Circular Mandala & Pratima Portal */}
              <div className="relative w-64 h-64 sm:w-76 sm:h-76 rounded-full p-2 bg-gradient-to-tr from-amber-400 via-red-500 to-amber-300 shadow-2xl animate-float-gentle">
                <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-inner relative bg-stone-900">
                  <img
                    src="/assets/maa-durga-mandala-dhak.jpg"
                    alt="Maa Durga Divine Face & Halo Mandala"
                    className="w-full h-full object-cover scale-110"
                  />
                  {/* Glowing divine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-red-900/40 via-transparent to-amber-500/20 mix-blend-overlay pointer-events-none" />
                </div>

                {/* Floating divine aura pulse rings */}
                <div className="absolute -inset-3 rounded-full border border-amber-400/40 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
              </div>

              {/* LAYER 4: Foreground Bengali Dhunuchi Dancer Cutout */}
              <div className="absolute -bottom-6 -right-2 sm:-right-4 w-44 sm:w-56 pointer-events-none z-20">
                <img
                  src="/assets/dhunuchi-dancer-cutout.png"
                  alt="Bengali Dhunuchi Dancer"
                  className="w-full h-auto drop-shadow-2xl dhunuchi-smoke animate-smoke-drift"
                />
              </div>

              {/* LAYER 5: Floating Bengali Celebration Card */}
              <div
                className="absolute -top-3 -left-3 sm:left-2 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-red-200 shadow-lg z-20 flex items-center gap-2.5 max-w-[190px]"
              >
                <span className="text-2xl animate-diya-flicker">🪔</span>
                <div>
                  <p className="text-[11px] font-black text-red-700 font-bangla leading-none">শুভ দুর্গোৎসব</p>
                  <p className="text-[10px] text-stone-600 font-semibold mt-0.5">মায়ের আশীর্বাদে কাটুক পুজো</p>
                </div>
              </div>

              {/* Autumn Kash Phool & Dhak Plumes Touch */}
              <div className="absolute bottom-2 left-4 bg-amber-50/90 border border-amber-200 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 z-20">
                <span>🌾</span> কাশফুল ও ঢাকের কলতান
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Decorative Alpana Line */}
        <div className="alpana-divider mx-8" style={{ marginTop: 0, marginBottom: 0 }} />
      </section>

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
        <div className="text-center py-16">
          <div className="text-4xl animate-bounce mb-2">🪔</div>
          <p className="text-stone-500 font-medium">Loading Kolkata pandals…</p>
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
