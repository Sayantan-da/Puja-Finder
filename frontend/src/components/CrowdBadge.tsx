import type { ApproachTraffic, BarricadeDistance, CrowdLevel, CrowdTrend } from '../types'
import { timeAgo } from '../utils/format'

const styles: Record<CrowdLevel, string> = {
  LOW: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
  MODERATE: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold',
  HIGH: 'bg-red-50 text-red-800 border-red-300 font-semibold',
}

const emoji: Record<CrowdLevel, string> = {
  LOW: '🟢',
  MODERATE: '🟡',
  HIGH: '🔴',
}

export default function CrowdBadge({
  level,
  wait,
  asOf,
  confidence,
  freshCount,
  isStale,
  trend,
  approach,
  barricade,
  showMultiPills = false,
}: {
  level: CrowdLevel | null
  wait?: number | null
  asOf?: string | null
  confidence?: number | null
  freshCount?: number
  isStale?: boolean
  trend?: CrowdTrend | null
  approach?: ApproachTraffic | null
  barricade?: BarricadeDistance | null
  showMultiPills?: boolean
}) {
  if (!level) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border border-stone-200 text-stone-600 bg-stone-50">
        No live crowd data
      </span>
    )
  }

  const age = timeAgo(asOf)
  const confidenceText = typeof confidence === 'number' && confidence > 0 ? ` · ${confidence}% conf` : ''
  const freshText = typeof freshCount === 'number' && freshCount > 0 ? ` · ${freshCount} reports` : ''
  const staleText = isStale ? ' · stale' : ''

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {/* Primary crowd badge */}
      <span
        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-1 shadow-xs ${styles[level]}`}
        title={age ? `Based on reports from ${age}` : undefined}
      >
        <span>{emoji[level]}</span>
        <span className="font-bold">{level}</span>
        {typeof wait === 'number' ? <span>· ~{wait}m wait</span> : ''}
        {confidenceText}
        {freshText}
        {staleText}
        {age && age !== 'just now' ? <span className="opacity-80"> · {age}</span> : ''}
      </span>

      {/* Trend pill */}
      {trend && (
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${
            trend === 'SURGING'
              ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
              : trend === 'COOLING'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-stone-100 text-stone-700 border-stone-300'
          }`}
        >
          {trend === 'SURGING' ? '🔺 Surging' : trend === 'COOLING' ? '🟢 Cooling' : '⏸️ Steady'}
        </span>
      )}

      {/* Approach & Barricade pills (optional) */}
      {showMultiPills && approach && (
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-700 font-medium">
          {approach === 'CLEAR' ? '🚗 Road Clear' : approach === 'CONGESTED' ? '🛑 Road Jam' : '🚶 Barricaded'}
        </span>
      )}

      {showMultiPills && barricade && (
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-700 font-medium">
          {barricade === 'DIRECT' ? '⚡ Direct Entry' : barricade === 'MODERATE' ? '🚶 ~500m Walk' : '🔁 1km+ Barricade'}
        </span>
      )}
    </div>
  )
}
