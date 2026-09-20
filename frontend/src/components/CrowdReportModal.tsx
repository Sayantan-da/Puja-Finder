import { useState } from 'react'
import type { ApproachTraffic, BarricadeDistance, CrowdLevel } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  pandalName: string
  onSubmit: (report: {
    crowd_level: CrowdLevel
    waiting_time_minutes?: number | null
    approach_traffic?: ApproachTraffic | null
    barricade_distance?: BarricadeDistance | null
    comfort_tags?: string[]
    comment?: string | null
  }) => Promise<void>
}

const AVAILABLE_TAGS = [
  { id: 'SENIOR_FRIENDLY', label: '🧓 Senior Priority Queue Open' },
  { id: 'WHEELCHAIR_OK', label: '♿ Wheelchair / Stroller Accessible' },
  { id: 'VIP_PASS', label: '🎟️ VIP / Passes Being Honored' },
  { id: 'CROWDED', label: '⚠️ Intense Push & Shove' },
  { id: 'WATERLOGGED', label: '🌧️ Waterlogged / Muddy Ground' },
]

export default function CrowdReportModal({ isOpen, onClose, pandalName, onSubmit }: Props) {
  const [level, setLevel] = useState<CrowdLevel>('MODERATE')
  const [waitMinutes, setWaitMinutes] = useState<number>(20)
  const [approach, setApproach] = useState<ApproachTraffic | null>('CLEAR')
  const [barricade, setBarricade] = useState<BarricadeDistance | null>('DIRECT')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const toggleTag = (id: string) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        crowd_level: level,
        waiting_time_minutes: waitMinutes > 0 ? waitMinutes : null,
        approach_traffic: approach,
        barricade_distance: barricade,
        comfort_tags: selectedTags,
        comment: comment.trim() || null,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-stone-800 bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 p-6 shadow-2xl text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-800/80 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              Live Hopper Intel
            </span>
            <h2 className="text-xl font-extrabold mt-1.5 leading-snug">
              Report Crowd for <span className="text-amber-400">{pandalName}</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Help fellow Kolkata pandal hoppers know what to expect right now!
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-full w-8 h-8 flex items-center justify-center border border-stone-700 bg-stone-800 text-stone-400 hover:text-stone-100 hover:bg-stone-700 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* 1. Darshan Queue Level */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-2">
              1. Darshan Queue Rush
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLevel('LOW')
                  setWaitMinutes(10)
                }}
                className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                  level === 'LOW'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/50'
                    : 'border-stone-800 bg-stone-950/60 hover:bg-stone-800 text-stone-400'
                }`}
              >
                <span className="text-lg">🟢</span>
                <span className="text-xs font-bold">Low Rush</span>
                <span className="text-[10px] opacity-75">&lt; 15 min</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLevel('MODERATE')
                  setWaitMinutes(25)
                }}
                className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                  level === 'MODERATE'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/50'
                    : 'border-stone-800 bg-stone-950/60 hover:bg-stone-800 text-stone-400'
                }`}
              >
                <span className="text-lg">🟡</span>
                <span className="text-xs font-bold">Moderate</span>
                <span className="text-[10px] opacity-75">15–40 min</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLevel('HIGH')
                  setWaitMinutes(55)
                }}
                className={`py-3 px-2 rounded-2xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                  level === 'HIGH'
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 ring-2 ring-rose-500/50'
                    : 'border-stone-800 bg-stone-950/60 hover:bg-stone-800 text-stone-400'
                }`}
              >
                <span className="text-lg">🔴</span>
                <span className="text-xs font-bold">Heavy Rush</span>
                <span className="text-[10px] opacity-75">45+ min</span>
              </button>
            </div>
          </div>

          {/* 2. Estimated Wait Minutes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                2. Approx. Sanctum Wait Time
              </label>
              <span className="text-sm font-bold text-amber-400">~{waitMinutes} minutes</span>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={waitMinutes}
              onChange={(e) => setWaitMinutes(Number(e.target.value))}
              className="w-full accent-amber-500 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[5, 15, 30, 45, 60, 90].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWaitMinutes(m)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                    waitMinutes === m
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          {/* 3. Approach Road Traffic */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-2">
              3. Approach Road Traffic
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setApproach('CLEAR')}
                className={`py-2 px-2 rounded-xl border text-center transition text-xs font-medium cursor-pointer ${
                  approach === 'CLEAR'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                }`}
              >
                🚗 Clear / Moving
              </button>
              <button
                type="button"
                onClick={() => setApproach('CONGESTED')}
                className={`py-2 px-2 rounded-xl border text-center transition text-xs font-medium cursor-pointer ${
                  approach === 'CONGESTED'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                }`}
              >
                🛑 Congested
              </button>
              <button
                type="button"
                onClick={() => setApproach('PEDESTRIAN_ONLY')}
                className={`py-2 px-2 rounded-xl border text-center transition text-xs font-medium cursor-pointer ${
                  approach === 'PEDESTRIAN_ONLY'
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                }`}
              >
                🚶 Barricaded / Walking Only
              </button>
            </div>
          </div>

          {/* 4. Barricade Walking Detour */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-2">
              4. Police Barricade Walk Distance
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBarricade('DIRECT')}
                className={`py-2 px-2 rounded-xl border text-center transition text-xs font-medium cursor-pointer ${
                  barricade === 'DIRECT'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                }`}
              >
                ⚡ &lt; 200m Direct
              </button>
              <button
                type="button"
                onClick={() => setBarricade('MODERATE')}
                className={`py-2 px-2 rounded-xl border text-center transition text-xs font-medium cursor-pointer ${
                  barricade === 'MODERATE'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                }`}
              >
                🚶 ~500m Walk
              </button>
              <button
                type="button"
                onClick={() => setBarricade('LONG_CIRCUIT')}
                className={`py-2 px-2 rounded-xl border text-center transition text-xs font-medium cursor-pointer ${
                  barricade === 'LONG_CIRCUIT'
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                }`}
              >
                🔁 1+ km Barricade Maze
              </button>
            </div>
          </div>

          {/* 5. Accessibility & Comfort Badges */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-2">
              5. Ground Conditions & Comfort Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-semibold'
                        : 'border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800'
                    }`}
                  >
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 6. Comment */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
              6. Quick Note / Tip (Optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Gate 2 has a shorter line; parking full at VIP road"
              maxLength={200}
              className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2 text-sm text-stone-200 outline-none focus:border-amber-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-stone-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm transition shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Broadcasting…' : '🚀 Submit Live Intel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
