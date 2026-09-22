import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Pandal } from '../../types'
import { goNearMe } from '../../utils/geo'

interface AgomoniHeroProps {
  search: string
  setSearch: (val: string) => void
  pandals: Pandal[]
  openOnly: boolean
  setOpenOnly: (val: boolean | ((prev: boolean) => boolean)) => void
  isDhakPlaying: boolean
  toggleDhakSound: () => void
}

export default function AgomoniHero({
  search,
  setSearch,
  pandals,
  openOnly,
  setOpenOnly,
  isDhakPlaying,
  toggleDhakSound,
}: AgomoniHeroProps) {
  const navigate = useNavigate()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [manualLightning, setManualLightning] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Autocomplete filtering based on search query
  const suggestions = search.trim().length > 0
    ? pandals
        .filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.locality && p.locality.toLowerCase().includes(search.toLowerCase())) ||
          (p.theme && p.theme.toLowerCase().includes(search.toLowerCase()))
        )
        .slice(0, 6)
    : []

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Trigger brief lightning burst on user demand
  const triggerLightningPulse = () => {
    setManualLightning(true)
    setTimeout(() => setManualLightning(false), 800)
  }

  const handleSelectPandal = (pandal: Pandal) => {
    setSearch(pandal.name)
    setShowSuggestions(false)
    navigate(`/pandals/${pandal.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        e.preventDefault()
        handleSelectPandal(suggestions[activeSuggestionIndex])
      } else {
        setShowSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <section className="relative rounded-3xl overflow-hidden mb-8 border border-amber-500/30 shadow-2xl bg-stone-950 text-white select-none">
      {/* ── Top Decorative Golden Tracing ── */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-red-600 via-amber-300 to-amber-500 shadow-md relative z-20" />

      {/* ── Celestial Chariot Background Canvas ── */}
      <div className="relative min-h-[500px] sm:min-h-[560px] lg:min-h-[580px] w-full flex items-center justify-center overflow-hidden">
        <img
          src="/assets/maa-durga-agomoni-celestial.jpg"
          alt="Maa Durga Agomoni - Divine Descent to Earth"
          className="absolute inset-0 w-full h-full object-cover object-center scale-102 transition-transform duration-1000 ease-out"
        />

        {/* Dynamic Multi-Stage Lighting & Vignette Overlays */}
        {/* Layer 1: Dark cosmic twilight vignette for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/65 to-stone-900/40 pointer-events-none" />

        {/* Layer 2: Side cinematic vignettes */}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/80 pointer-events-none" />

        {/* Layer 3: Natural Atmospheric Lightning Flash 1 (Thundercloud flash) */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-screen opacity-0 animate-lightning-1"
          style={{
            background:
              'radial-gradient(ellipse at 80% 20%, rgba(192, 132, 252, 0.5) 0%, rgba(147, 197, 253, 0.3) 35%, transparent 70%)',
          }}
        />

        {/* Layer 4: Natural Atmospheric Lightning Flash 2 (Left horizon strike) */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-screen opacity-0 animate-lightning-2"
          style={{
            background:
              'radial-gradient(ellipse at 15% 25%, rgba(165, 180, 252, 0.45) 0%, rgba(216, 180, 254, 0.25) 40%, transparent 65%)',
          }}
        />

        {/* Layer 5: Manual/Interactive Thunder Burst when Dhak/Lightning is triggered */}
        <div
          className={`absolute inset-0 pointer-events-none mix-blend-color-dodge transition-opacity duration-300 ${
            manualLightning || isDhakPlaying
              ? 'opacity-40 animate-pulse'
              : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgba(253, 230, 138, 0.6) 0%, rgba(192, 132, 252, 0.4) 40%, transparent 70%)',
          }}
        />

        {/* Layer 6: Golden Divine Aura around central deity */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none animate-divine-aura"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.1) 50%, transparent 70%)',
            filter: 'blur(35px)',
          }}
        />

        {/* ── Foreground Content Area ── */}
        <div className="relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14 flex flex-col items-center text-center">
          {/* Top Traditional Agomoni Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-celestial-subtle text-amber-300 text-xs sm:text-sm font-bangla font-semibold mb-4 border border-amber-400/40 shadow-lg">
            <span className="text-base animate-diya-flicker">🪔</span>
            <span>মর্ত্যে আগমন ✦ দেবীপক্ষের পুণ্য লগ্নে শুভ শারদীয়া ২০২৬</span>
            <span className="hidden sm:inline text-amber-400/60">|</span>
            <button
              onClick={triggerLightningPulse}
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-sans text-amber-200 hover:text-white underline cursor-pointer"
              title="Click to trigger divine lightning flash"
            >
              ⚡ Spark Lightning
            </button>
          </div>

          {/* Bengali Calligraphy Sharodiya Durgotsav Artwork */}
          <div className="mb-2 max-w-xs sm:max-w-sm">
            <img
              src="/assets/sharodiya-durgotsav-logo.png"
              alt="শারদীয় দুর্গোৎসব - Sharodiya Durgotsav"
              className="w-52 sm:w-64 h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] hover:scale-103 transition-transform"
            />
          </div>

          {/* Main Hero Heading */}
          <h1
            className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Kolkata <span className="sindoor-text">Durga Puja</span> Pandal Finder
          </h1>

          {/* Subtitle */}
          <p className="mt-3 text-stone-200 text-sm sm:text-base max-w-2xl font-medium leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            Live crowd telemetry, wait times, themes, and curated walking circuits as Maa Durga descends from Mount Kailash to the City of Joy.
          </p>

          {/* ── Search & Autocomplete Container ── */}
          <div
            ref={searchContainerRef}
            className="mt-7 w-full max-w-2xl relative z-30"
          >
            <div className="glass-celestial rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-2xl">
              {/* Search input */}
              <div className="relative flex-1 flex items-center">
                <span className="absolute left-3.5 text-amber-400 text-base pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setShowSuggestions(true)
                    setActiveSuggestionIndex(-1)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pandal name, locality (e.g. Bagbazar, Ballygunge), or theme…"
                  className="w-full pl-10 pr-9 py-3 rounded-xl bg-stone-900/80 border border-amber-400/30 text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-medium"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('')
                      setShowSuggestions(false)
                    }}
                    className="absolute right-3 text-stone-400 hover:text-white text-sm"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => goNearMe(navigate)}
                  className="flex-1 sm:flex-initial rounded-xl font-bold px-4 py-3 text-center transition-all text-white flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 text-xs sm:text-sm cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #D31027 0%, #991B1B 100%)',
                    border: '1px solid rgba(254, 202, 202, 0.3)',
                  }}
                >
                  📍 Near me
                </button>

                <a
                  href="/planner"
                  className="flex-1 sm:flex-initial rounded-xl font-bold px-4 py-3 text-center transition-all flex items-center justify-center gap-1.5 text-stone-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:brightness-105 shadow-md active:scale-95 text-xs sm:text-sm cursor-pointer"
                >
                  🧭 Route Planner
                </a>
              </div>
            </div>

            {/* ── Search Autocomplete Dropdown ── */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl glass-celestial shadow-2xl border border-amber-400/40 overflow-hidden text-left z-50 animate-fade-in-up">
                <div className="px-4 py-2 border-b border-amber-500/20 text-[11px] font-bold text-amber-400 uppercase tracking-wider flex justify-between items-center">
                  <span>Pandal Suggestions</span>
                  <span className="text-[10px] text-stone-400 font-normal">Use ↑↓ keys to navigate</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                  {suggestions.map((pandal, idx) => (
                    <div
                      key={pandal.id}
                      onClick={() => handleSelectPandal(pandal)}
                      className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                        idx === activeSuggestionIndex
                          ? 'bg-amber-500/20 text-white'
                          : 'hover:bg-white/10 text-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">🏛️</span>
                        <div className="truncate">
                          <p className="font-bold text-sm text-white truncate font-cinzel">
                            {pandal.name}
                          </p>
                          <p className="text-xs text-stone-400 truncate">
                            📍 {pandal.locality || pandal.address || 'Kolkata'}
                            {pandal.theme && (
                              <span className="text-amber-300/80 ml-2 italic">
                                • {pandal.theme}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-right">
                        {pandal.avg_rating != null && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                            {pandal.avg_rating.toFixed(1)} ★
                          </span>
                        )}
                        <span className="text-stone-400 text-xs">➔</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Quick Controls & Dhak Synthesizer ── */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 z-20">
            {/* Quick Open Now Filter Toggle */}
            <button
              onClick={() => setOpenOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                openOnly
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/50'
                  : 'glass-celestial-subtle text-emerald-300 border-emerald-400/30 hover:bg-emerald-950/50'
              }`}
              title="Show only pandals currently open"
            >
              <span className={`w-2 h-2 rounded-full ${openOnly ? 'bg-white' : 'bg-emerald-400 animate-pulse'}`} />
              {openOnly ? 'Showing Open Now' : '⚡ Open Right Now'}
            </button>

            {/* Dhak & Celestial Rhythm Synthesizer */}
            <button
              onClick={toggleDhakSound}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                isDhakPlaying
                  ? 'bg-red-600 text-white border-red-400 animate-bounce shadow-xl shadow-red-950/60'
                  : 'glass-celestial-subtle text-amber-200 border-amber-400/30 hover:bg-amber-950/50 shadow-md'
              }`}
              title="Listen to synthesized authentic Bengali Dhak beats"
            >
              <span className="text-sm">🥁</span>
              {isDhakPlaying
                ? 'ঢাকের আওয়াজ বাজছে… (থামাতে ক্লিক করুন)'
                : 'ঢাকের আওয়াজ শুনুন (Play Dhak Beats)'}
            </button>

            <span className="text-xs text-amber-200/80 font-bangla hidden md:inline-block">
              ধাং কুড় কুড় ধাং কুড় কুড় ✦
            </span>
          </div>
        </div>

        {/* ── Bottom Transition: Ganga Mist to Pandal Earth ── */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-stone-950 via-stone-950/70 to-transparent pointer-events-none z-10" />
      </div>

      {/* Traditional Alpana Accent at the Base */}
      <div className="alpana-divider mx-8" style={{ marginTop: 0, marginBottom: '0.5rem' }} />
    </section>
  )
}
