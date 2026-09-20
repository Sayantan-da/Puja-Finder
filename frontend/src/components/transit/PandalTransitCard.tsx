import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPandalTransitInfo } from '../../services/transitService'
import type { MetroLineColor, PandalTransitInfo, StationCrowdStatus } from '../../types/transit'

interface PandalTransitCardProps {
  pandalId: string | number
  pandalName?: string
}

const LINE_THEMES: Record<
  MetroLineColor,
  {
    bg: string
    border: string
    text: string
    badgeBg: string
    dot: string
    glow: string
    gradient: string
  }
> = {
  Blue: {
    bg: 'bg-blue-50/70',
    border: 'border-blue-200',
    text: 'text-blue-900',
    badgeBg: 'bg-blue-600 text-white',
    dot: 'bg-blue-500 shadow-[0_0_8px_#3b82f6]',
    glow: 'group-hover:border-blue-400',
    gradient: 'from-blue-600 to-indigo-600',
  },
  Green: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    badgeBg: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
    glow: 'group-hover:border-emerald-400',
    gradient: 'from-emerald-600 to-teal-600',
  },
  Purple: {
    bg: 'bg-purple-50/70',
    border: 'border-purple-200',
    text: 'text-purple-900',
    badgeBg: 'bg-purple-600 text-white',
    dot: 'bg-purple-500 shadow-[0_0_8px_#a855f7]',
    glow: 'group-hover:border-purple-400',
    gradient: 'from-purple-600 to-violet-600',
  },
  Orange: {
    bg: 'bg-orange-50/70',
    border: 'border-orange-200',
    text: 'text-orange-900',
    badgeBg: 'bg-orange-600 text-white',
    dot: 'bg-orange-500 shadow-[0_0_8px_#f97316]',
    glow: 'group-hover:border-orange-400',
    gradient: 'from-orange-600 to-amber-600',
  },
}

const CROWD_BADGES: Record<
  StationCrowdStatus,
  { label: string; icon: string; className: string }
> = {
  Normal: {
    label: 'Platform Normal',
    icon: '🟢',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
  },
  Busy: {
    label: 'Platform Busy',
    icon: '🟡',
    className: 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse font-bold',
  },
  Overcrowded: {
    label: 'Overcrowded (Queue at Gates)',
    icon: '🔴',
    className: 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse font-bold',
  },
}

export const PandalTransitCard: React.FC<PandalTransitCardProps> = ({ pandalId, pandalName }) => {
  const [transit, setTransit] = useState<PandalTransitInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getPandalTransitInfo(pandalId, pandalName)
      .then((data) => {
        if (mounted) {
          setTransit(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError('Could not load metro transit data.')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [pandalId, pandalName])

  // Skeleton loader for high-speed low-bandwidth resilience
  if (loading) {
    return (
      <div
        className="mt-6 rounded-2xl border border-stone-800 bg-stone-900/60 p-5 animate-pulse"
        role="status"
        aria-label="Loading transit details"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="h-6 w-44 bg-stone-800 rounded-lg" />
          <div className="h-6 w-24 bg-stone-800 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-20 bg-stone-800/60 rounded-xl" />
          <div className="h-20 bg-stone-800/60 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !transit) {
    return null
  }

  const theme = LINE_THEMES[transit.lineColor] || LINE_THEMES.Blue
  const crowd = CROWD_BADGES[transit.stationCrowdStatus] || CROWD_BADGES.Normal

  return (
    <section
      aria-label="Festival Metro and Transit Quick Guide"
      className={`mt-6 rounded-2xl border ${theme.border} bg-white p-5 sm:p-6 shadow-md transition-all relative overflow-hidden`}
    >
      {/* Decorative top ambient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.gradient}`} />

      {/* Header with Title and Live Crowd Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-lg shadow-xs">
            🚇
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-stone-500">
                Puja Metro Quick Card
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.badgeBg}`}
                aria-label={`Metro line: ${transit.lineColor}`}
              >
                {transit.lineColor} Line
              </span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-1.5">
              {transit.metroStationName}
            </h2>
          </div>
        </div>

        {/* Live Station Crowd Status */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-xs ${crowd.className}`}
          role="status"
          aria-live="polite"
          title="Crowd density reported at platforms and ticket gates"
        >
          <span>{crowd.icon}</span>
          <span>{crowd.label}</span>
        </div>
      </div>

      {/* Primary Highlights: Exit Gate & Walking Distance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Recommended Exit Gate */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xl font-bold">
            🚪
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
              Recommended Exit Gate
            </span>
            <p className="text-base font-extrabold text-amber-950 truncate">
              {transit.gateNumber}
            </p>
            <p className="text-xs text-stone-700 line-clamp-2 mt-0.5 font-medium">
              {transit.gateDescription}
            </p>
          </div>
        </div>

        {/* Walking Estimate */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-xl font-bold">
            🚶‍♂️
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
              Walking to Pandal
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-extrabold text-stone-900">
                ~{transit.estimatedWalkTimeMinutes} mins
              </span>
              <span className="text-xs text-stone-500 font-mono font-medium">
                ({transit.walkingDistanceMeters}m away)
              </span>
            </div>
            <p className="text-xs text-stone-700 mt-0.5 font-medium">
              Direct illuminated festival barricade corridor
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info: Night Metro Timings & Nearby Parking */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-stone-700 font-medium">
        <div className="flex items-center gap-2">
          <span className="text-red-700 font-bold">🌙 Night Service:</span>
          <span className="text-stone-900">{transit.lastNightTrainTime || 'Trains run till 04:00 AM on Puja nights'}</span>
        </div>

        {transit.nearestParking && (
          <div className="flex items-center gap-1.5 text-stone-600">
            <span>🅿️ Nearest Parking:</span>
            <span className="text-stone-900 font-bold">
              {transit.nearestParking.locationName}
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-md font-bold ${
                transit.nearestParking.status === 'Available'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : transit.nearestParking.status === 'Filling Fast'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {transit.nearestParking.status}
            </span>
          </div>
        )}
      </div>

      {/* Quick Jump to Schedules and Traffic Hub */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-stone-200">
        <span className="text-[11px] text-stone-500">
          Kolkata Metro Rail Corporation (KMRC) &amp; Kolkata Police Advisory
        </span>
        <Link
          to="/transit"
          className="text-xs font-bold text-red-700 hover:text-red-800 flex items-center gap-1 transition"
          aria-label="View all Puja night metro timetables and special buses"
        >
          <span>All Night Timetables &amp; Parking</span>
          <span>→</span>
        </Link>
      </div>
    </section>
  )
}

export default PandalTransitCard
