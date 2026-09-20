import React, { useEffect, useMemo, useState } from 'react'
import { getTransitSchedules } from '../../services/transitService'
import type {
  BusRoute,
  MetroLineColor,
  MetroTimetable,
  PujaDay,
  TransitTimeSlot,
} from '../../types/transit'

const PUJA_DAYS: PujaDay[] = ['Saptami', 'Ashtami', 'Nabami', 'Dashami']
const TIME_SLOTS: TransitTimeSlot[] = ['All', 'Day', 'Midnight', 'Night Special (1 AM - 4 AM)']

const LINE_COLOR_STYLES: Record<MetroLineColor, { border: string; bg: string; text: string; badge: string }> = {
  Blue: {
    border: 'border-blue-500/40',
    bg: 'bg-blue-950/20',
    text: 'text-blue-400',
    badge: 'bg-blue-600 text-white',
  },
  Green: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/20',
    text: 'text-emerald-400',
    badge: 'bg-emerald-600 text-white',
  },
  Purple: {
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/20',
    text: 'text-purple-400',
    badge: 'bg-purple-600 text-white',
  },
  Orange: {
    border: 'border-orange-500/40',
    bg: 'bg-orange-950/20',
    text: 'text-orange-400',
    badge: 'bg-orange-600 text-white',
  },
}

export const MetroBusScheduleViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metro' | 'bus'>('metro')
  const [selectedDay, setSelectedDay] = useState<PujaDay>('Ashtami')
  const [selectedSlot, setSelectedSlot] = useState<TransitTimeSlot>('All')
  const [pandalSearchQuery, setPandalSearchQuery] = useState('')

  const [metroSchedules, setMetroSchedules] = useState<MetroTimetable[]>([])
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    getTransitSchedules(selectedDay, selectedSlot, pandalSearchQuery)
      .then((res) => {
        if (active) {
          setMetroSchedules(res.metroTimetables)
          setBusRoutes(res.busRoutes)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedDay, selectedSlot, pandalSearchQuery])

  // Count matching buses when searching
  const matchingBusCount = useMemo(() => {
    if (!pandalSearchQuery.trim()) return busRoutes.length
    const q = pandalSearchQuery.toLowerCase()
    return busRoutes.filter(
      (b) =>
        b.keyPassThroughPandals.some((p) => p.toLowerCase().includes(q)) ||
        b.origin.toLowerCase().includes(q) ||
        b.destination.toLowerCase().includes(q)
    ).length
  }, [busRoutes, pandalSearchQuery])

  return (
    <div className="w-full space-y-6">
      {/* View Switcher: Kolkata Metro Timetables vs Night Special Buses */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2 bg-stone-900/90 p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => setActiveTab('metro')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'metro'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Show Kolkata Metro Timetables"
          >
            <span>🚇</span>
            <span>Kolkata Metro Timetable</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-stone-950/20 font-mono">
              {metroSchedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bus')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'bus'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
            aria-label="Show Special Night Buses"
          >
            <span>🚌</span>
            <span>Night Special Buses</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-stone-950/20 font-mono">
              {matchingBusCount}
            </span>
          </button>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-stone-300">Metro Night Operations Active (24/7 RPF Hotline 139)</span>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900/80 backdrop-blur p-4 space-y-4">
        {/* Puja Day Selector */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-2">
            Select Festival Day
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PUJA_DAYS.map((day) => {
              const isSelected = selectedDay === day
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition border text-center ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/15 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'border-stone-800 bg-stone-950/60 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                  }`}
                  aria-pressed={isSelected}
                >
                  {day}
                  {day === 'Ashtami' && (
                    <span className="block text-[10px] font-normal text-amber-500/80">
                      Peak Rush (Sandhi Puja)
                    </span>
                  )}
                  {day === 'Saptami' && (
                    <span className="block text-[10px] font-normal text-stone-400">
                      Night Hopping Begins
                    </span>
                  )}
                  {day === 'Nabami' && (
                    <span className="block text-[10px] font-normal text-stone-400">
                      All-Night Services
                    </span>
                  )}
                  {day === 'Dashami' && (
                    <span className="block text-[10px] font-normal text-stone-400">
                      Immersion Ghat Link
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Slot Filter & Bus Pandal Search */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stone-800/80">
          {/* Time Slot Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-2">
              Time Window / Slot
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedSlot === slot
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      isSelected
                        ? 'border-red-500 bg-red-500/20 text-red-300 font-bold'
                        : 'border-stone-800 bg-stone-950 text-stone-400 hover:text-white'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {slot === 'Night Special (1 AM - 4 AM)' ? '🌙 1 AM - 4 AM Night Special' : slot}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick Search bar for Buses passing near Pandals */}
          <div>
            <label
              htmlFor="pandal-search-input"
              className="block text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-2"
            >
              Search Buses by Pandal Name or Route
            </label>
            <div className="relative">
              <input
                id="pandal-search-input"
                type="text"
                value={pandalSearchQuery}
                onChange={(e) => setPandalSearchQuery(e.target.value)}
                placeholder="e.g. Sree Bhumi, Bagbazar, Chetla, Maddox Square..."
                className="w-full rounded-xl border border-stone-700 bg-stone-950/90 px-4 py-2.5 pl-10 text-sm text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                aria-label="Filter transit buses passing specific pandal"
              />
              <span className="absolute left-3 top-2.5 text-stone-500">🔍</span>
              {pandalSearchQuery && (
                <button
                  onClick={() => setPandalSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-white"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-stone-900/60 border border-stone-800" />
          ))}
        </div>
      )}

      {/* Content Tab 1: METRO TIMETABLES */}
      {!loading && activeTab === 'metro' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>🚇 Kolkata Metro Services for {selectedDay}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                {metroSchedules.length} runs
              </span>
            </h3>
            <span className="text-xs text-stone-400">Tokens, Smart Cards & Metro Ride QR accepted</span>
          </div>

          {metroSchedules.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-stone-800 bg-stone-900/30 text-stone-400">
              <p className="text-lg">No metro services match the selected filter.</p>
              <p className="text-sm mt-1 text-stone-500">
                Try selecting "All" time slots or another festival day.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metroSchedules.map((schedule) => {
                const lineStyle = LINE_COLOR_STYLES[schedule.lineColor] || LINE_COLOR_STYLES.Blue
                return (
                  <div
                    key={schedule.id}
                    className={`rounded-2xl border ${lineStyle.border} ${lineStyle.bg} bg-stone-900/90 p-5 shadow-lg flex flex-col justify-between transition hover:border-amber-500/50`}
                  >
                    <div>
                      {/* Line header & day badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${lineStyle.badge}`}
                            >
                              {schedule.lineColor} Line
                            </span>
                            <span className="text-xs font-semibold text-amber-400">
                              {schedule.pujaDay}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white tracking-tight">
                            {schedule.line}
                          </h4>
                          <p className="text-xs text-stone-400 mt-0.5">
                            ⇄ {schedule.direction}
                          </p>
                        </div>

                        {schedule.isAllNightSpecial && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/60 text-red-300 text-[11px] font-extrabold whitespace-nowrap shadow-sm">
                            <span className="animate-pulse">🌙</span>
                            <span>Night Special</span>
                          </div>
                        )}
                      </div>

                      {/* Timings Grid */}
                      <div className="grid grid-cols-2 gap-3 my-3 p-3 rounded-xl bg-stone-950/90 border border-stone-800">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">
                            First Train
                          </span>
                          <span className="text-sm font-extrabold text-white">
                            {schedule.firstTrainTime}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">
                            Last Train
                          </span>
                          <span className="text-sm font-extrabold text-amber-400">
                            {schedule.lastTrainTime}
                          </span>
                        </div>
                      </div>

                      {/* Headway & Frequency */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">⚡ Rush Frequency:</span>
                          <span className="font-mono font-semibold">
                            Every {schedule.peakFrequencyMinutes} mins
                          </span>
                        </div>
                        {schedule.nightFrequencyMinutes && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-400 font-bold">🌙 Midnight:</span>
                            <span className="font-mono font-semibold">
                              Every {schedule.nightFrequencyMinutes} mins
                            </span>
                          </div>
                        )}
                      </div>

                      {schedule.specialNotes && (
                        <p className="text-xs text-stone-400 mt-2.5 italic border-t border-stone-800/80 pt-2">
                          ℹ️ {schedule.specialNotes}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Content Tab 2: SPECIAL NIGHT BUSES */}
      {!loading && activeTab === 'bus' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>🚌 Kolkata State Transport Corporation (CSTC) Festival Fleet</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                {matchingBusCount} routes
              </span>
            </h3>
            {pandalSearchQuery && (
              <span className="text-xs text-amber-400">
                Filtered by pandal: "{pandalSearchQuery}"
              </span>
            )}
          </div>

          {busRoutes.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-stone-800 bg-stone-900/30 text-stone-400">
              <p className="text-lg">No special bus routes found for "{pandalSearchQuery}".</p>
              <button
                onClick={() => setPandalSearchQuery('')}
                className="mt-3 text-xs font-bold text-amber-400 underline"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {busRoutes.map((bus) => (
                <div
                  key={bus.id}
                  className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 shadow-lg flex flex-col justify-between hover:border-amber-500/40 transition"
                >
                  <div>
                    {/* Bus Route Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                            {bus.acType}
                          </span>
                          {bus.is24HourSpecial && (
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-500/40">
                              24-Hour Special
                            </span>
                          )}
                        </div>
                        <h4 className="text-lg font-extrabold text-white tracking-tight">
                          {bus.routeNumber}
                        </h4>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-stone-400 block">
                          Headway
                        </span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          ~{bus.frequencyMinutes} mins
                        </span>
                      </div>
                    </div>

                    {/* Origin to Destination */}
                    <div className="p-3 my-3 rounded-xl bg-stone-950/90 border border-stone-800/90 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-stone-500 block uppercase font-bold">
                          Origin
                        </span>
                        <span className="font-bold text-stone-200">{bus.origin}</span>
                      </div>
                      <span className="text-stone-500 font-bold text-sm">➔</span>
                      <div className="text-right">
                        <span className="text-[10px] text-stone-500 block uppercase font-bold">
                          Destination
                        </span>
                        <span className="font-bold text-stone-200">{bus.destination}</span>
                      </div>
                    </div>

                    {/* Key Pass-Through Pandals */}
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block mb-1.5">
                        Key Pandals on this Route:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {bus.keyPassThroughPandals.map((pandal, idx) => {
                          const isMatch =
                            pandalSearchQuery &&
                            pandal.toLowerCase().includes(pandalSearchQuery.toLowerCase())
                          return (
                            <span
                              key={idx}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                                isMatch
                                  ? 'bg-amber-500/30 text-amber-200 border-amber-500 font-bold'
                                  : 'bg-stone-800/60 text-stone-300 border-stone-700/60'
                              }`}
                            >
                              📍 {pandal}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
                    <span>🕒 {bus.operatingHours}</span>
                    <span className="text-stone-300 font-medium">Conductor/Ticketing on Board</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MetroBusScheduleViewer
