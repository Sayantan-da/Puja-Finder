import { useState } from 'react'
import type { HourlyPatternPoint } from '../types'

interface Props {
  hourlyPattern?: HourlyPatternPoint[]
  openingTime?: string | null
  closingTime?: string | null
}

export default function HourlyCrowdChart({ hourlyPattern = [] }: Props) {
  const currentHour = new Date().getHours()
  const [selectedHour, setSelectedHour] = useState<number>(currentHour)

  if (!hourlyPattern || hourlyPattern.length === 0) {
    return null
  }

  const selectedPoint = hourlyPattern.find((p) => p.hour === selectedHour) || hourlyPattern[currentHour] || hourlyPattern[0]

  const getBarColor = (level: string, isCurrent: boolean) => {
    if (level === 'LOW') return isCurrent ? 'bg-emerald-500 shadow-sm' : 'bg-emerald-400 hover:bg-emerald-500'
    if (level === 'MODERATE') return isCurrent ? 'bg-amber-500 shadow-sm' : 'bg-amber-400 hover:bg-amber-500'
    if (level === 'HIGH') return isCurrent ? 'bg-orange-500 shadow-sm' : 'bg-orange-400 hover:bg-orange-500'
    return isCurrent ? 'bg-rose-600 shadow-sm' : 'bg-rose-500 hover:bg-rose-600'
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'LOW':
        return <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">🟢 Low Rush</span>
      case 'MODERATE':
        return <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">🟡 Moderate</span>
      case 'HIGH':
        return <span className="text-orange-800 font-bold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">🟠 High Rush</span>
      default:
        return <span className="text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">🔴 Extreme Rush</span>
    }
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-stone-900 text-base">📊 24-Hour Crowd &amp; Rush Forecast</h3>
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
              Kolkata Pujo Pattern
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5 font-medium">
            Hourly rush projection based on historical footfall &amp; live reports
          </p>
        </div>

        {/* Quiet window banner */}
        <div className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl shrink-0 font-medium">
          <span>✨</span>
          <span><strong>Quiet Window:</strong> 02:00 AM – 05:30 AM &amp; 12:00 PM – 03:30 PM</span>
        </div>
      </div>

      {/* Selected Hour Insight Card */}
      <div className="mb-4 rounded-xl bg-stone-50 border border-stone-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-stone-900">
            ⏰ {selectedPoint.label} {selectedPoint.hour === currentHour && <span className="text-red-600 font-bold">(Now)</span>}
          </div>
          <div>{getLevelBadge(selectedPoint.rush_level)}</div>
          <div className="text-stone-600">
            Est. Darshan Queue: <strong className="text-stone-900 font-bold">~{selectedPoint.wait_minutes} min</strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedPoint.is_quiet_window ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
              ⭐ Ideal Time to Visit
            </span>
          ) : selectedPoint.rush_level === 'EXTREME' ? (
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
              ⚠️ Peak Queue Expected
            </span>
          ) : (
            <span className="text-stone-500">Tap any bar to inspect hour</span>
          )}
        </div>
      </div>

      {/* Visual Bar Graph */}
      <div className="relative pt-6 pb-2">
        <div className="flex items-end gap-1 sm:gap-1.5 h-32 px-1">
          {hourlyPattern.map((p) => {
            const isCurrent = p.hour === currentHour
            const isSelected = p.hour === selectedHour
            const heightPercent = Math.max(12, p.rush_percent)

            return (
              <button
                key={p.hour}
                type="button"
                onClick={() => setSelectedHour(p.hour)}
                title={`${p.label}: ${p.rush_level} (~${p.wait_minutes} min)`}
                className="flex-1 flex flex-col items-center h-full justify-end group relative focus:outline-none cursor-pointer"
              >
                {/* Current indicator marker */}
                {isCurrent && (
                  <div className="absolute -top-6 text-[9px] font-bold text-white bg-red-600 border border-red-700 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-pulse">
                    NOW
                  </div>
                )}

                {/* The Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-sm transition-all duration-200 ${getBarColor(
                    p.rush_level,
                    isCurrent,
                  )} ${isSelected ? 'ring-2 ring-red-600 ring-offset-1 ring-offset-white scale-105' : 'opacity-85 hover:opacity-100'}`}
                />

                {/* Hour ticks */}
                {p.hour % 3 === 0 && (
                  <span
                    className={`mt-1.5 text-[9px] font-medium ${
                      isCurrent ? 'text-red-700 font-bold' : 'text-stone-500'
                    }`}
                  >
                    {p.hour === 0 ? '12a' : p.hour < 12 ? `${p.hour}a` : p.hour === 12 ? '12p' : `${p.hour - 12}p`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend & Tips */}
      <div className="mt-2 pt-3 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-stone-600 font-medium">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Low (&lt;20m)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Moderate (20-40m)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-orange-500" /> High (40-60m)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" /> Extreme (60m+)
          </span>
        </div>
        <div className="text-stone-500 italic">
          💡 Pro-tip: Night-owl hopping between 2 AM – 5 AM skips 80% of lines
        </div>
      </div>
    </div>
  )
}
