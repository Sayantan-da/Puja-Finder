import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import CrowdBadge from '../components/CrowdBadge'
import CrowdReportModal from '../components/CrowdReportModal'
import DirectionsCard from '../components/DirectionsCard'
import PandalTransitCard from '../components/transit/PandalTransitCard'
import ExactAge from '../components/ExactAge'
import HourlyCrowdChart from '../components/HourlyCrowdChart'
import LiveBadge from '../components/LiveBadge'
import RatingStars from '../components/RatingStars'
import { OpenBadge } from '../components/PandalCard'
import { useLiveCrowd } from '../hooks/useLiveCrowd'
import type {
  ApproachTraffic,
  BarricadeDistance,
  CrowdLevel,
  CrowdReport,
  CrowdTrend,
  EventItem,
  ImageItem,
  Pandal,
  Review,
} from '../types'

const REPORT_REASONS = ['Inappropriate content', 'Spam or advertising', 'False information', 'Wrong pandal info', 'Other']

const TAG_CONFIG: Record<string, { label: string; icon: string; style: string }> = {
  SENIOR_FRIENDLY: { label: 'Senior Priority Queue Open', icon: '🧓', style: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  SENIOR_QUEUE: { label: 'Dedicated Senior Queue', icon: '🧓', style: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  WHEELCHAIR_OK: { label: 'Wheelchair / Stroller Accessible', icon: '♿', style: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  STROLLER_OK: { label: 'Stroller Friendly Pathways', icon: '👶', style: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  VIP_PASS: { label: 'VIP / Society Passes Honored', icon: '🎟️', style: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  CROWDED: { label: 'Intense Push & Shove', icon: '⚠️', style: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
  WATERLOGGED: { label: 'Waterlogged / Muddy Ground', icon: '🌧️', style: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' },
  HERITAGE: { label: 'Heritage Courtyard Protocol', icon: '🏛️', style: 'border-stone-600 bg-stone-800 text-stone-300' },
}

export default function PandalDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [pandal, setPandal] = useState<Pandal | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [reports, setReports] = useState<CrowdReport[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [fav, setFav] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // Pandal Inaccuracy Flagging State
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false)
  const [flagReason, setFlagReason] = useState('WRONG_HOURS')
  const [flagDesc, setFlagDesc] = useState('')
  const [flagCorrection, setFlagCorrection] = useState('')
  const [isSubmittingFlag, setIsSubmittingFlag] = useState(false)

  // Photo gallery state
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const captionInput = useRef<HTMLInputElement>(null)

  // Review report state
  const [reportingId, setReportingId] = useState<number | null>(null)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [reportDesc, setReportDesc] = useState('')

  // Real-time crowd feed (WebSocket with polling fallback)
  const { lastUpdate: crowdUpdate, snapshot, connected: liveConnected } = useLiveCrowd(id ?? 'all')
  const [live, setLive] = useState<{
    level: CrowdLevel | null
    wait: number | null
    fresh: number
    ts: string
    trend?: CrowdTrend | null
    approach?: ApproachTraffic | null
    barricade?: BarricadeDistance | null
    tags?: string[]
  } | null>(null)

  useEffect(() => {
    if (!crowdUpdate) return
    setLive({
      level: crowdUpdate.crowd_level,
      wait: crowdUpdate.waiting_time_minutes,
      fresh: crowdUpdate.fresh_count,
      ts: crowdUpdate.crowd_updated_at ?? crowdUpdate.ts,
      trend: crowdUpdate.crowd_trend,
      approach: crowdUpdate.approach_traffic,
      barricade: crowdUpdate.barricade_distance,
      tags: crowdUpdate.comfort_tags,
    })
    load() // refresh the recent reports list too
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowdUpdate])

  // Snapshot on connect → the badge is fresh the instant the page opens
  useEffect(() => {
    if (!snapshot) return
    const est = snapshot.estimates.find((e) => String(e.pandal_id) === id)
    if (!est || !est.crowd_level) return
    setLive((prev) => {
      const ts = est.crowd_updated_at ?? new Date().toISOString()
      if (prev && prev.ts >= ts) return prev
      return {
        level: est.crowd_level,
        wait: est.waiting_time_minutes,
        fresh: prev?.fresh ?? 0,
        ts,
        trend: prev?.trend,
        approach: prev?.approach,
        barricade: prev?.barricade,
        tags: prev?.tags,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])

  const load = () => {
    api.get<Pandal>(`/pandals/${id}`).then((r) => setPandal(r.data)).catch(() => setError('Pandal not found or API offline.'))
    api.get<Review[]>(`/pandals/${id}/reviews`).then((r) => setReviews(r.data)).catch(() => { })
    api.get<EventItem[]>(`/pandals/${id}/events`).then((r) => setEvents(r.data)).catch(() => { })
    api.get<CrowdReport[]>(`/pandals/${id}/crowd-reports`).then((r) => setReports(r.data)).catch(() => { })
    api.get<ImageItem[]>(`/pandals/${id}/images`).then((r) => {
      setImages(r.data)
      if (r.data.length > 0 && selectedImage === null) setSelectedImage(r.data[0].id)
    }).catch(() => { })
  }

  useEffect(() => {
    if (user) {
      api.get('/favorites').then((r) => {
        setFav((r.data as Pandal[]).some((p) => String(p.id) === id))
      }).catch(() => { })
    } else {
      setFav(false)
    }
  }, [user, id])

  useEffect(load, [id])

  if (error) return <main className="max-w-3xl mx-auto px-4 py-10 text-red-400">{error}</main>
  if (!pandal) return <main className="max-w-3xl mx-auto px-4 py-10 text-stone-500">Loading…</main>

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    setNotice('')
    try {
      await api.post(`/pandals/${id}/reviews`, { rating, comment })
      setComment('')
      setNotice('✅ Review saved!')
      load()
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Could not save review')
    }
  }

  async function handleReportCrowd(reportData: {
    crowd_level: CrowdLevel
    waiting_time_minutes?: number | null
    approach_traffic?: ApproachTraffic | null
    barricade_distance?: BarricadeDistance | null
    comfort_tags?: string[]
    comment?: string | null
  }) {
    setNotice('')
    // Optimistic update
    setLive((prev) => ({
      level: reportData.crowd_level,
      wait: reportData.waiting_time_minutes ?? prev?.wait ?? null,
      fresh: (prev?.fresh ?? 0) + 1,
      ts: new Date().toISOString(),
      trend: prev?.trend,
      approach: reportData.approach_traffic ?? prev?.approach,
      barricade: reportData.barricade_distance ?? prev?.barricade,
      tags: reportData.comfort_tags && reportData.comfort_tags.length > 0 ? reportData.comfort_tags : prev?.tags,
    }))
    try {
      await api.post(`/pandals/${id}/crowd-reports`, reportData)
      setNotice(`✅ Thanks! Live crowd intel reported successfully.`)
      load()
    } catch (err: any) {
      setNotice(err?.response?.data?.detail === 'Not authenticated' ? 'Please login to report crowd.' : 'Could not report')
    }
  }

  async function toggleFav() {
    if (!user) return
    const { data } = await api.post<{ favorited: boolean }>(`/favorites/${id}`)
    setFav(data.favorited)
  }

  async function uploadImage(e: FormEvent) {
    e.preventDefault()
    setNotice('')
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setNotice('Choose an image first')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    if (captionInput.current?.value) fd.append('caption', captionInput.current.value)
    try {
      await api.post(`/pandals/${id}/images`, fd)
      if (fileInput.current) fileInput.current.value = ''
      if (captionInput.current) captionInput.current.value = ''
      setNotice('✅ Photo added!')
      load()
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Upload failed')
    }
  }

  async function deleteImage(img: ImageItem) {
    if (!confirm('Delete this photo?')) return
    try {
      await api.delete(`/images/${img.id}`)
      setSelectedImage(null)
      load()
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Could not delete photo')
    }
  }

  async function submitReport(reviewId: number) {
    try {
      await api.post(`/reviews/${reviewId}/report`, {
        reason: reportReason,
        description: reportDesc || null,
      })
      setReportingId(null)
      setReportDesc('')
      setNotice('⚑ Report submitted — our moderators will review it.')
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Could not submit report')
    }
  }

  async function submitPandalFlag(e: FormEvent) {
    e.preventDefault()
    setIsSubmittingFlag(true)
    try {
      await api.post(`/pandals/${id}/flag`, {
        reason: flagReason,
        description: flagDesc,
        suggested_correction: flagCorrection || null,
      })
      setIsFlagModalOpen(false)
      setFlagDesc('')
      setFlagCorrection('')
      setNotice('✅ Thank you! Your report about inaccurate pandal details has been submitted for admin review.')
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Could not submit flag report')
    } finally {
      setIsSubmittingFlag(false)
    }
  }

  const current = images.find((i) => i.id === selectedImage) ?? images[0]
  const canModerate = user?.role === 'ADMIN'

  // Multi-factor computed fields
  const currentLevel = live?.level ?? pandal.crowd_level
  const currentWait = live?.wait ?? pandal.waiting_time_minutes
  const currentTrend = live?.trend ?? pandal.crowd_trend ?? 'STEADY'
  const currentApproach = live?.approach ?? pandal.approach_traffic ?? 'CLEAR'
  const currentBarricade = live?.barricade ?? pandal.barricade_distance ?? 'DIRECT'
  const activeTags = live?.tags ?? pandal.comfort_tags ?? []

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {pandal.is_verified_by_admin ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-bold flex items-center gap-1.5 shadow-xs">
                <span>✓</span> Verified by PujaFinder Admin
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1.5 shadow-xs">
                <span>ℹ️</span> Community Contributed Listing
              </span>
            )}
            {pandal.updated_at && (
              <span className="text-xs text-stone-500 font-medium">
                🕒 Last updated: <ExactAge date={pandal.updated_at} />
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight font-cinzel leading-tight">
            {pandal.name}
          </h1>
          <p className="text-stone-600 mt-1 font-medium flex items-center gap-1">
            <span>📍</span> {pandal.address}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsFlagModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-700 hover:text-red-700 hover:border-red-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Flag incorrect timings, location, or details"
          >
            <span>🚩</span> Flag Inaccurate Info
          </button>
          {user && (
            <button
              onClick={toggleFav}
              className={`px-4 py-2 rounded-xl border text-sm transition font-bold cursor-pointer shadow-xs ${
                fav
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              {fav ? '★ Saved' : '☆ Save'}
            </button>
          )}
        </div>
      </div>

      {/* Meta Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <RatingStars value={pandal.avg_rating} count={pandal.review_count} />
        <OpenBadge open={pandal.open_now} />
        <CrowdBadge
          level={currentLevel}
          wait={currentWait}
          asOf={pandal.crowd_updated_at}
          confidence={pandal.confidence}
          freshCount={pandal.fresh_count}
          isStale={pandal.is_stale}
          trend={currentTrend}
          approach={currentApproach}
          barricade={currentBarricade}
          showMultiPills={true}
        />
        <LiveBadge connected={liveConnected} />
        {pandal.opening_time && (
          <span className="text-xs text-stone-600 font-semibold bg-stone-100 px-2.5 py-1 rounded-lg">
            🕓 {pandal.opening_time} – {pandal.closing_time}
          </span>
        )}
      </div>

      {/* Extended Information: Dates, Accessibility, Official Links */}
      {(pandal.dates || pandal.accessibility_tags || pandal.official_links) && (
        <div className="mt-4 p-4 rounded-2xl border border-red-100 bg-white flex flex-col gap-2 text-xs text-stone-700 shadow-xs">
          {pandal.dates && (
            <p className="flex items-center gap-2">
              <span>📅</span> <strong className="text-stone-900 font-bold">Puja Dates:</strong> {pandal.dates}
            </p>
          )}
          {pandal.accessibility_tags && (
            <p className="flex items-center gap-2">
              <span>♿</span> <strong className="text-stone-900 font-bold">Accessibility:</strong>{' '}
              {pandal.accessibility_tags.split(',').map((t) => t.trim()).join(', ')}
            </p>
          )}
          {pandal.official_links && (
            <p className="flex items-center gap-2 flex-wrap">
              <span>🔗</span> <strong className="text-stone-900 font-bold">Official Links:</strong>{' '}
              {pandal.official_links.split(',').map((link, idx) => (
                <a
                  key={idx}
                  href={link.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="text-red-700 hover:text-red-800 hover:underline bg-red-50 font-semibold px-2.5 py-1 rounded-lg border border-red-200"
                >
                  {link.trim().replace(/^https?:\/\//, '')}
                </a>
              ))}
            </p>
          )}
        </div>
      )}

      {notice && (
        <div className="mt-4 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold">
          {notice}
        </div>
      )}

      {/* Actions: share & planner */}
      {pandal.latitude != null && pandal.longitude != null && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            to={`/planner?ids=${pandal.id}`}
            className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-4 py-2.5 text-sm transition flex items-center gap-1.5 shadow-md shadow-red-500/20"
          >
            <span>🧭 Plan Hop Route from Here</span>
          </Link>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `🪔 ${pandal.name}\n📍 ${pandal.address}\n🗺️ https://www.google.com/maps/search/?api=1&query=${pandal.latitude},${pandal.longitude}\nvia PujaFinder`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-stone-300 bg-white hover:bg-stone-50 px-4 py-2.5 text-sm text-stone-800 font-semibold transition shadow-xs flex items-center gap-1.5"
          >
            <span>💬 Share on WhatsApp</span>
          </a>
        </div>
      )}

      {/* Transparent directions: FROM your location → TO the pandal */}
      <DirectionsCard pandal={pandal} />

      {/* Festival Metro & Quick Transit Guide Card */}
      <PandalTransitCard pandalId={pandal.id} pandalName={pandal.name} />

      {/* =========================================================================
          🌟 LIVE CROWD & DARSHAN COMMAND CENTER (LIGHT FESTIVE THEME)
         ========================================================================= */}
      <section className="mt-6 rounded-3xl border border-red-200/90 bg-white p-6 shadow-lg shadow-red-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <h2 className="text-xl font-black text-stone-900 font-cinzel">Live Crowd &amp; Darshan Command Center</h2>
            </div>
            <p className="text-xs text-stone-500 mt-1 font-medium">
              Multi-dimensional crowd intelligence: sanctum queue, road gridlock, barricade walk &amp; comfort
            </p>
          </div>

          <button
            onClick={() => (user ? setIsReportModalOpen(true) : alert('Please log in to submit live crowd intel!'))}
            className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-4 py-2.5 text-sm transition shadow-md shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>📢 Report Live Intel</span>
          </button>
        </div>

        {/* 4-Stat Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {/* Metric 1: Sanctum Darshan Queue */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-red-900 font-bold">
              1. Darshan Queue
            </span>
            <div className="my-2">
              <div className="text-2xl font-black flex items-center gap-2 text-stone-900">
                <span>{currentLevel === 'LOW' ? '🟢' : currentLevel === 'MODERATE' ? '🟡' : '🔴'}</span>
                <span>{currentLevel ?? 'MODERATE'}</span>
              </div>
              <div className="text-red-700 font-bold text-sm mt-0.5">
                {currentWait != null ? `~${currentWait} min wait` : 'Fast movement'}
              </div>
            </div>
            <span className="text-[11px] text-stone-500 font-medium">
              {pandal.is_stale ? '⚠️ Awaiting fresh report' : '✨ Fresh estimate'}
            </span>
          </div>

          {/* Metric 2: Live Velocity & Trend */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-red-900 font-bold">
              2. Crowd Velocity
            </span>
            <div className="my-2">
              <div className="text-lg font-extrabold flex items-center gap-1.5 text-stone-900">
                {currentTrend === 'SURGING' && <span className="text-rose-700">🔺 Surging Fast</span>}
                {currentTrend === 'COOLING' && <span className="text-emerald-700">🟢 Cooling Down</span>}
                {currentTrend === 'STEADY' && <span className="text-stone-700">⏸️ Steady Flow</span>}
              </div>
              <div className="text-xs text-stone-600 mt-1 font-medium">
                Confidence: <strong className="text-stone-900 font-bold">{pandal.confidence ?? 75}%</strong>
              </div>
            </div>
            <span className="text-[11px] text-stone-500 font-medium">
              {pandal.fresh_count} report{pandal.fresh_count !== 1 ? 's' : ''} in last 30m
            </span>
          </div>

          {/* Metric 3: Approach Road Traffic */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-red-900 font-bold">
              3. Approach Traffic
            </span>
            <div className="my-2">
              <div className="text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                {currentApproach === 'CLEAR' && <span className="text-emerald-700">🚗 Clear &amp; Moving</span>}
                {currentApproach === 'CONGESTED' && <span className="text-amber-800">🛑 Severe Jam</span>}
                {currentApproach === 'PEDESTRIAN_ONLY' && <span className="text-rose-700">🚶 Barricaded</span>}
              </div>
              <div className="text-xs text-stone-600 mt-1 font-medium">
                {currentApproach === 'CLEAR'
                  ? 'Easy cab/car drop-off'
                  : currentApproach === 'CONGESTED'
                  ? 'Expect 20+ min crawling road delay'
                  : 'Vehicular access stopped by police'}
              </div>
            </div>
            <span className="text-[11px] text-stone-500 font-medium">Vehicle Accessibility</span>
          </div>

          {/* Metric 4: Police Barricade Walk Detour */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-red-900 font-bold">
              4. Barricade Detour
            </span>
            <div className="my-2">
              <div className="text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                {currentBarricade === 'DIRECT' && <span className="text-emerald-700">⚡ Direct (&lt;200m)</span>}
                {currentBarricade === 'MODERATE' && <span className="text-amber-800">🚶 ~500m Walk</span>}
                {currentBarricade === 'LONG_CIRCUIT' && <span className="text-rose-700">🔁 1km+ Maze</span>}
              </div>
              <div className="text-xs text-stone-600 mt-1 font-medium">
                {currentBarricade === 'DIRECT'
                  ? 'Straight into pandal gate'
                  : currentBarricade === 'MODERATE'
                  ? 'Short winding pedestrian route'
                  : 'Long police barricade maze before entry'}
              </div>
            </div>
            <span className="text-[11px] text-stone-500 font-medium">Pedestrian Effort</span>
          </div>
        </div>

        {/* Active Ground Comfort & Accessibility Badges */}
        {activeTags.length > 0 && (
          <div className="mt-5 pt-4 border-t border-red-100">
            <h4 className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-2">
              Verified Ground Conditions &amp; Accessibility
            </h4>
            <div className="flex flex-wrap gap-2">
              {activeTags.map((tag) => {
                const conf = TAG_CONFIG[tag] || {
                  label: tag.replace('_', ' '),
                  icon: '📌',
                  style: 'border-stone-200 bg-stone-50 text-stone-800',
                }
                return (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 font-bold text-stone-800 flex items-center gap-1.5 shadow-xs"
                  >
                    <span>{conf.icon}</span>
                    <span>{conf.label}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* 24-Hour Forecast Heatmap */}
        <div className="mt-5">
          <HourlyCrowdChart
            hourlyPattern={pandal.hourly_pattern}
            openingTime={pandal.opening_time}
            closingTime={pandal.closing_time}
          />
        </div>

        {/* Community Field Reports Timeline */}
        {reports.length > 0 && (
          <div className="mt-5 pt-4 border-t border-red-100">
            <h4 className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-3">
              Recent Field Reports From Hoppers ({reports.length})
            </h4>
            <ul className="space-y-2 text-xs">
              {reports.slice(0, 4).map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-stone-900">
                      {r.crowd_level === 'LOW' ? '🟢 Low' : r.crowd_level === 'MODERATE' ? '🟡 Moderate' : '🔴 High'}
                    </span>
                    {r.waiting_time_minutes != null && (
                      <span className="text-red-700 font-bold">· ~{r.waiting_time_minutes}m wait</span>
                    )}
                    {r.approach_traffic && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-medium">
                        🚗 {r.approach_traffic}
                      </span>
                    )}
                    {r.barricade_distance && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-medium">
                        🚶 {r.barricade_distance}
                      </span>
                    )}
                    {r.comment && <span className="text-stone-700 italic">“{r.comment}”</span>}
                  </div>
                  <span className="text-stone-500 font-medium shrink-0">
                    {r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Photo gallery */}
      <div className="mt-6 rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-md shadow-red-500/5">
        <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
          <span>📷</span> Photos &amp; Idols ({images.length})
        </h2>
        {current && (
          <div className="relative">
            <img
              src={current.image_url}
              alt={current.caption ?? pandal.name}
              className="w-full max-h-96 object-cover rounded-xl shadow-xs"
            />
            {current.caption && (
              <p className="text-xs text-stone-600 mt-2 text-center font-medium italic">“{current.caption}”</p>
            )}
            {(canModerate || (user && current.user_id === user.id)) && (
              <button
                onClick={() => deleteImage(current)}
                className="absolute top-2 right-2 text-xs bg-white/90 hover:bg-red-600 hover:text-white border border-stone-200 text-red-600 font-bold rounded-lg px-2.5 py-1.5 transition shadow-sm cursor-pointer"
              >
                🗑 Delete
              </button>
            )}
          </div>
        )}
        {images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img) => (
              <button key={img.id} onClick={() => setSelectedImage(img.id)} className="cursor-pointer">
                <img
                  src={img.image_url}
                  alt={img.caption ?? 'photo'}
                  className={`h-16 w-24 object-cover rounded-lg border-2 transition ${
                    img.id === current?.id ? 'border-red-600 scale-102' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {user && (
          <form onSubmit={uploadImage} className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-xs text-stone-600 file:mr-3 file:rounded-xl file:border-0 file:bg-red-50 file:text-red-700 file:font-bold file:px-3 file:py-1.5 file:text-xs cursor-pointer"
            />
            <input
              ref={captionInput}
              placeholder="Caption (optional)"
              className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 outline-none focus:border-red-500 flex-1 min-w-[150px]"
            />
            <button className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-4 py-1.5 text-xs transition shadow-xs cursor-pointer">
              ⬆ Upload photo
            </button>
          </form>
        )}
      </div>

      {pandal.theme && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-md shadow-red-500/5">
          <h2 className="text-lg font-bold text-stone-900 mb-1 flex items-center gap-2">
            <span>🎨</span> Pandal Theme &amp; Concept
          </h2>
          <p className="text-red-700 font-bold text-base">{pandal.theme}</p>
          {pandal.description && <p className="text-stone-600 text-sm mt-2 leading-relaxed font-medium">{pandal.description}</p>}
        </div>
      )}

      {/* Events */}
      {events.length > 0 && (
        <div className="mt-6 rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-md shadow-red-500/5">
          <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
            <span>🎪</span> Puja Rituals &amp; Cultural Events
          </h2>
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="border-l-3 border-red-500 pl-3.5 py-0.5">
                <p className="font-bold text-stone-900 text-sm">{ev.title} <span className="text-xs text-red-600 font-semibold">({ev.event_type})</span></p>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  {new Date(ev.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {' – '}
                  {new Date(ev.end_time).toLocaleTimeString([], { timeStyle: 'short' })}
                </p>
                {ev.description && <p className="text-xs text-stone-600 mt-1">{ev.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reviews */}
      <div className="mt-6 rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-md shadow-red-500/5">
        <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
          <span>⭐</span> Devotee Reviews ({reviews.length})
        </h2>
        {user && (
          <form onSubmit={submitReview} className="mb-6 p-4 rounded-xl bg-red-50/40 border border-red-100 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-700">Your Rating:</label>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setRating(n)}
                  className={`text-xl cursor-pointer ${n <= rating ? 'text-amber-500' : 'text-stone-300'}`}
                  aria-label={`${n} star`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience, idol beauty, queue condition…"
              rows={2}
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-stone-900 outline-none focus:border-red-500 placeholder:text-stone-400"
            />
            <button className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-5 py-2 text-xs transition shadow-xs cursor-pointer">
              Submit Review
            </button>
          </form>
        )}
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-stone-100 last:border-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-stone-900">{r.user.name}</span>
                <span className="text-amber-500 text-sm font-bold">{'★'.repeat(r.rating)}</span>
              </div>
              {r.comment && <p className="text-stone-700 text-sm mt-1 font-medium">{r.comment}</p>}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-stone-400">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                </span>
                {user && r.user.id !== user.id && (
                  reportingId === r.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 outline-none focus:border-red-500"
                      >
                        {REPORT_REASONS.map((reason) => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => submitReport(r.id)}
                        className="text-xs rounded-lg bg-red-600 text-white font-bold px-2.5 py-1 transition cursor-pointer"
                      >
                        Send Report
                      </button>
                      <button
                        onClick={() => setReportingId(null)}
                        className="text-xs text-stone-500 hover:text-stone-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReportingId(r.id)}
                      className="text-xs text-stone-400 hover:text-red-600 transition cursor-pointer"
                      title="Report this review"
                    >
                      ⚑ Report
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
          {reviews.length === 0 && <li className="text-sm text-stone-500">No reviews yet — be the first to share your experience!</li>}
        </ul>
      </div>

      {/* Modal for reporting multi-factor crowd conditions */}
      <CrowdReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        pandalName={pandal.name}
        onSubmit={handleReportCrowd}
      />

      {/* Modal for flagging inaccurate pandal info */}
      {isFlagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-red-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-stone-900">
            <button
              onClick={() => setIsFlagModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 text-xl font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-2xl">🚩</span>
              <h3 className="text-xl font-black font-cinzel text-stone-900">Flag Inaccurate Information</h3>
            </div>
            <p className="text-xs text-stone-600 mb-4 font-medium">
              Help us keep Kolkata's pandal directory authentic and accurate for millions of devotees.
            </p>

            <form onSubmit={submitPandalFlag} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">What is incorrect?</label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none focus:border-red-500 font-medium"
                >
                  <option value="WRONG_HOURS">Wrong Opening / Closing Timings</option>
                  <option value="WRONG_LOCATION">Incorrect Location or GPS Pin</option>
                  <option value="INCORRECT_THEME">Wrong Theme / Idol Information</option>
                  <option value="PANDAL_CLOSED">Pandal is Closed or Gates Blocked</option>
                  <option value="OTHER">Other Information / Duplicate Entry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Description / What did you observe?</label>
                <textarea
                  value={flagDesc}
                  onChange={(e) => setFlagDesc(e.target.value)}
                  placeholder="e.g. Gates open only from 4 PM, or the entry is via South lane instead of main road..."
                  rows={3}
                  required
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Suggested Correction (Optional)</label>
                <input
                  type="text"
                  value={flagCorrection}
                  onChange={(e) => setFlagCorrection(e.target.value)}
                  placeholder="e.g. Correct opening time: 16:00 to 02:00"
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFlagModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-sm hover:bg-stone-50 transition cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFlag || !flagDesc.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-sm transition flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
                >
                  {isSubmittingFlag ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
