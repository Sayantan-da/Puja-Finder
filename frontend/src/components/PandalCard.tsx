import { Link } from 'react-router-dom'
import CrowdBadge from './CrowdBadge'
import RatingStars from './RatingStars'
import type { Pandal } from '../types'
import { formatDistance } from '../utils/format'

export function OpenBadge({ open }: { open: boolean | null }) {
  if (open === null) return null
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
        open
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-stone-100 text-stone-500 border-stone-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${open ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
      {open ? 'Open now' : 'Closed'}
    </span>
  )
}

export function VerificationBadge({ verified }: { verified?: boolean }) {
  if (verified) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold flex items-center gap-1 shadow-sm">
        <span>✓</span> Admin Verified
      </span>
    )
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium flex items-center gap-1">
      <span>ℹ️</span> Community Info
    </span>
  )
}

const TAG_LABELS: Record<string, { label: string; icon: string }> = {
  SENIOR_FRIENDLY: { label: 'Senior Priority', icon: '🧓' },
  SENIOR_QUEUE:    { label: 'Senior Queue',    icon: '🧓' },
  WHEELCHAIR_OK:   { label: 'Wheelchair',      icon: '♿' },
  VIP_PASS:        { label: 'VIP Passes',      icon: '🎟️' },
  CROWDED:         { label: 'Heavy Rush',      icon: '⚠️' },
  WATERLOGGED:     { label: 'Muddy Queue',     icon: '🌧️' },
  STROLLER_OK:     { label: 'Stroller OK',     icon: '👶' },
}

export default function PandalCard({ pandal }: { pandal: Pandal }) {
  return (
    <Link
      to={`/pandals/${pandal.id}`}
      className="puja-card group block rounded-2xl bg-white border border-red-100 overflow-hidden flex flex-col"
      style={{ boxShadow: '0 4px 18px rgba(211, 16, 39, 0.07)' }}
    >
      {/* Animated top stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 transition-all duration-500 group-hover:h-1.5" />

      {/* Cover image with overlay */}
      {pandal.cover_image ? (
        <div className="relative overflow-hidden bg-stone-100" style={{ height: '168px' }}>
          <img
            src={pandal.cover_image}
            alt={pandal.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            style={{ transformOrigin: 'center center' }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

          {/* Trend badges */}
          {pandal.crowd_trend === 'SURGING' && (
            <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg bg-red-600 text-white animate-pulse flex items-center gap-1">
              🔺 Surging
            </span>
          )}
          {pandal.crowd_trend === 'COOLING' && (
            <span className="absolute top-2.5 right-2.5 text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
              🟢 Cooling
            </span>
          )}

          {/* Distance badge */}
          {pandal.distance_km != null && (
            <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/90 text-red-700 shadow-sm border border-red-100">
              📍 {formatDistance(pandal.distance_km)}
            </span>
          )}
        </div>
      ) : (
        /* Placeholder gradient when no image */
        <div
          className="h-20 w-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #FFF1EF 0%, #FEF3C7 100%)' }}
        >
          <span className="text-3xl animate-diya-flicker">🏛️</span>
        </div>
      )}

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          {/* Top badges (Verified + Rating) */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <VerificationBadge verified={pandal.is_verified_by_admin} />
            {pandal.avg_rating != null && (
              <span className="shrink-0 rounded-lg text-[11px] font-bold px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 shadow-sm">
                {pandal.avg_rating.toFixed(1)} ★
              </span>
            )}
          </div>

          {/* Name */}
          <h3
            className="font-bold text-[15px] leading-snug text-stone-900 group-hover:text-red-700 transition-colors duration-200 line-clamp-2 mb-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {pandal.name}
          </h3>

          {/* Locality */}
          <p className="text-[12px] text-stone-500 font-medium mb-1 flex items-center gap-1">
            <span className="text-red-400">📍</span>
            {pandal.locality ?? pandal.address}
          </p>

          {/* Theme */}
          {pandal.theme && (
            <p className="mt-1 text-[12px] line-clamp-2 text-stone-500 italic leading-relaxed">
              🎨 {pandal.theme}
            </p>
          )}

          {/* Comfort tag pills */}
          {pandal.comfort_tags && pandal.comfort_tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {pandal.comfort_tags.slice(0, 3).map((tag) => {
                const t = TAG_LABELS[tag]
                return (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-red-50 border border-red-200/60 text-red-700 font-semibold flex items-center gap-0.5"
                  >
                    {t?.icon ?? '•'} {t?.label ?? tag.replace('_', ' ')}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer row */}
        <div className="mt-3.5 pt-3 flex items-center justify-between flex-wrap gap-2 border-t border-red-50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <OpenBadge open={pandal.open_now} />
            <CrowdBadge
              level={pandal.crowd_level}
              wait={pandal.waiting_time_minutes}
              asOf={pandal.crowd_updated_at}
              confidence={pandal.confidence}
              freshCount={pandal.fresh_count}
              isStale={pandal.is_stale}
              trend={pandal.crowd_trend}
              approach={pandal.approach_traffic}
              showMultiPills={false}
            />
          </div>
          <RatingStars value={pandal.avg_rating} count={pandal.review_count} />
        </div>
      </div>

      {/* Bottom accent — expands on hover */}
      <div className="h-0.5 w-0 group-hover:w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 transition-all duration-500 ease-out" />
    </Link>
  )
}
