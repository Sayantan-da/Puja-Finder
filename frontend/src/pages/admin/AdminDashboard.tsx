import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from 'react'
import { api } from '../../api/client'
import type {
  AdminAnalytics,
  AdminStats,
  AuditLogEntry,
  MomentModerationItem,
  PandalAdminOut,
  ReportItem,
  ReviewModerationItem,
  User,
} from '../../types'

// ─── helpers ──────────────────────────────────────────────────────────────────
function relTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function StatusPill({ published, active }: { published: boolean; active: boolean }) {
  if (!active)
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
        Archived
      </span>
    )
  if (!published)
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Draft
      </span>
    )
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      Live
    </span>
  )
}

// ─── tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'pandals' | 'moderation' | 'users'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'pandals', label: 'Pandal Manager', icon: '🏛️' },
  { id: 'moderation', label: 'Moderation', icon: '🛡️' },
  { id: 'users', label: 'Users & Roles', icon: '👥' },
]

// ─── edit modal ───────────────────────────────────────────────────────────────
interface EditModalProps {
  pandal: PandalAdminOut
  onClose: () => void
  onSaved: () => void
}

function EditPandalModal({ pandal, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState<Partial<PandalAdminOut>>({
    name: pandal.name,
    address: pandal.address,
    locality: pandal.locality ?? '',
    theme: pandal.theme ?? '',
    description: pandal.description ?? '',
    latitude: pandal.latitude,
    longitude: pandal.longitude,
    opening_time: pandal.opening_time ?? '04:00',
    closing_time: pandal.closing_time ?? '23:30',
    dates: pandal.dates ?? '',
    accessibility_tags: pandal.accessibility_tags ?? '',
    official_links: pandal.official_links ?? '',
    parking_info: pandal.parking_info ?? '',
    metro_info: pandal.metro_info ?? '',
    route_tips: pandal.route_tips ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.patch(`/admin/pandals/${pandal.id}`, {
        ...form,
        latitude: form.latitude ? parseFloat(String(form.latitude)) : null,
        longitude: form.longitude ? parseFloat(String(form.longitude)) : null,
      })
      onSaved()
      onClose()
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 transition placeholder:text-stone-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-700 bg-stone-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/95 backdrop-blur">
          <h2 className="font-bold text-stone-100">✏️ Edit Pandal #{pandal.id}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Name *" required value={form.name ?? ''} onChange={field('name')} className={inputCls} />
            <input placeholder="Locality" value={form.locality ?? ''} onChange={field('locality')} className={inputCls} />
          </div>
          <input placeholder="Address *" required value={form.address ?? ''} onChange={field('address')} className={inputCls} />
          <input placeholder="Theme" value={form.theme ?? ''} onChange={field('theme')} className={inputCls} />
          <textarea
            rows={2}
            placeholder="Description"
            value={form.description ?? ''}
            onChange={field('description')}
            className={inputCls + ' resize-none'}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Latitude" value={form.latitude ?? ''} onChange={field('latitude')} className={inputCls} />
            <input placeholder="Longitude" value={form.longitude ?? ''} onChange={field('longitude')} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <input placeholder="Open (HH:MM)" value={form.opening_time ?? ''} onChange={field('opening_time')} className={inputCls} />
            <input placeholder="Close (HH:MM)" value={form.closing_time ?? ''} onChange={field('closing_time')} className={inputCls} />
            <input placeholder="Dates" value={form.dates ?? ''} onChange={field('dates')} className={inputCls} />
          </div>
          <input placeholder="Accessibility tags (wheelchair,pram_friendly...)" value={form.accessibility_tags ?? ''} onChange={field('accessibility_tags')} className={inputCls} />
          <input placeholder="Official Links" value={form.official_links ?? ''} onChange={field('official_links')} className={inputCls} />
          <input placeholder="Parking Info" value={form.parking_info ?? ''} onChange={field('parking_info')} className={inputCls} />
          <input placeholder="Metro Info" value={form.metro_info ?? ''} onChange={field('metro_info')} className={inputCls} />
          <textarea rows={2} placeholder="Route Tips" value={form.route_tips ?? ''} onChange={field('route_tips')} className={inputCls + ' resize-none'} />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold py-2.5 text-sm transition"
            >
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="px-5 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-300 text-sm transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── photo panel ──────────────────────────────────────────────────────────────
function PhotoPanel({ pandal, onClose }: { pandal: PandalAdminOut; onClose: () => void }) {
  const [photos, setPhotos] = useState<{ id: number; image_url: string; caption: string | null }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const captionRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ id: number; image_url: string; caption: string | null }[]>(
        `/pandals/${pandal.id}/images`
      )
      setPhotos(r.data)
    } catch {}
  }, [pandal.id])

  useEffect(() => { load() }, [load])

  async function upload(e: FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    if (captionRef.current?.value) fd.append('caption', captionRef.current.value)
    try {
      await api.post(`/admin/pandals/${pandal.id}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (fileRef.current) fileRef.current.value = ''
      if (captionRef.current) captionRef.current.value = ''
      await load()
    } catch {}
    setUploading(false)
  }

  async function del(id: number) {
    if (!confirm('Delete this photo?')) return
    await api.delete(`/admin/photos/${id}`)
    await load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-stone-700 bg-stone-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/95 backdrop-blur">
          <h2 className="font-bold text-stone-100">📷 Photos — {pandal.name}</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <form onSubmit={upload} className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              required
              className="text-xs text-stone-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-stone-950 hover:file:bg-amber-400 cursor-pointer"
            />
            <input ref={captionRef} placeholder="Caption (optional)" className="rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500" />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold py-2 text-sm transition"
            >
              {uploading ? 'Uploading…' : '⬆ Upload Photo'}
            </button>
          </form>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((ph) => (
              <div key={ph.id} className="relative group rounded-xl overflow-hidden border border-stone-800">
                <img src={ph.image_url} alt={ph.caption ?? ''} className="w-full h-32 object-cover" />
                {ph.caption && (
                  <p className="px-2 py-1 text-[11px] text-stone-400 bg-stone-900/80">{ph.caption}</p>
                )}
                <button
                  onClick={() => del(ph.id)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-red-600/90 hover:bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length === 0 && <p className="text-stone-500 text-sm col-span-2">No photos yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // overview state
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  // pandal state
  const [pandals, setPandals] = useState<PandalAdminOut[]>([])
  const [pandalSearch, setPandalSearch] = useState('')
  const [pandalStatus, setPandalStatus] = useState('all')
  const [editingPandal, setEditingPandal] = useState<PandalAdminOut | null>(null)
  const [photosPandal, setPhotosPandal] = useState<PandalAdminOut | null>(null)
  const [pandalBusy, setPandalBusy] = useState<number | null>(null)

  // add pandal form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newLocality, setNewLocality] = useState('')
  const [newTheme, setNewTheme] = useState('')
  const [newLat, setNewLat] = useState('22.5726')
  const [newLng, setNewLng] = useState('88.3639')
  const [newDates, setNewDates] = useState('Oct 18 - Oct 24, 2026')
  const [newAccess, setNewAccess] = useState('')
  const [newLinks, setNewLinks] = useState('')

  // CSV
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvMsg, setCsvMsg] = useState('')
  const [csvWarnings, setCsvWarnings] = useState<string[]>([])
  const csvRef = useRef<HTMLInputElement>(null)

  // moderation state
  const [reviews, setReviews] = useState<ReviewModerationItem[]>([])
  const [moments, setMoments] = useState<MomentModerationItem[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [modTab, setModTab] = useState<'reports' | 'reviews' | 'moments'>('reports')

  // users state
  const [users, setUsers] = useState<User[]>([])
  const [userBusy, setUserBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    api.get<AdminStats>('/admin/dashboard/stats').then((r) => setStats(r.data)).catch(() => {})
    api.get<AdminAnalytics>('/admin/dashboard/analytics').then((r) => setAnalytics(r.data)).catch(() => {})
    api.get<AuditLogEntry[]>('/admin/audit-logs?limit=20').then((r) => setAuditLogs(r.data)).catch(() => {})
    api.get<PandalAdminOut[]>('/admin/pandals?limit=500').then((r) => setPandals(r.data)).catch(() => {})
    api.get<ReviewModerationItem[]>('/admin/moderation/reviews').then((r) => setReviews(r.data)).catch(() => {})
    api.get<MomentModerationItem[]>('/admin/moderation/moments').then((r) => setMoments(r.data)).catch(() => {})
    api.get<ReportItem[]>('/admin/reports').then((r) => setReports(r.data)).catch(() => {})
    api.get<User[]>('/admin/users?limit=200').then((r) => setUsers(r.data)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  // filtered pandals
  const filteredPandals = pandals.filter((p) => {
    const matchSearch = !pandalSearch || p.name.toLowerCase().includes(pandalSearch.toLowerCase()) || (p.locality ?? '').toLowerCase().includes(pandalSearch.toLowerCase())
    const matchStatus =
      pandalStatus === 'all' ||
      (pandalStatus === 'published' && p.is_active && p.is_published) ||
      (pandalStatus === 'draft' && p.is_active && !p.is_published) ||
      (pandalStatus === 'archived' && !p.is_active)
    return matchSearch && matchStatus
  })

  async function togglePublish(p: PandalAdminOut) {
    setPandalBusy(p.id)
    try {
      await api.patch(`/admin/pandals/${p.id}/publish?publish=${!p.is_published}`)
      api.get<PandalAdminOut[]>('/admin/pandals?limit=500').then((r) => setPandals(r.data))
    } catch {}
    setPandalBusy(null)
  }

  async function archivePandal(p: PandalAdminOut) {
    if (!confirm(`Archive "${p.name}"? It will be hidden from the public.`)) return
    setPandalBusy(p.id)
    try {
      await api.delete(`/admin/pandals/${p.id}`)
      api.get<PandalAdminOut[]>('/admin/pandals?limit=500').then((r) => setPandals(r.data))
    } catch {}
    setPandalBusy(null)
  }

  async function restorePandal(p: PandalAdminOut) {
    setPandalBusy(p.id)
    try {
      await api.post(`/admin/pandals/${p.id}/restore`)
      api.get<PandalAdminOut[]>('/admin/pandals?limit=500').then((r) => setPandals(r.data))
    } catch {}
    setPandalBusy(null)
  }

  async function addPandal(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/admin/pandals', {
        name: newName, address: newAddress, locality: newLocality, theme: newTheme,
        latitude: parseFloat(newLat), longitude: parseFloat(newLng),
        dates: newDates, accessibility_tags: newAccess, official_links: newLinks,
      })
      setNewName(''); setNewAddress(''); setNewLocality(''); setNewTheme('')
      setShowAddForm(false)
      api.get<PandalAdminOut[]>('/admin/pandals?limit=500').then((r) => setPandals(r.data))
    } catch {}
  }

  async function handleCsv(e: FormEvent) {
    e.preventDefault()
    const file = csvRef.current?.files?.[0]
    if (!file) return
    setCsvLoading(true); setCsvMsg(''); setCsvWarnings([])
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await api.post<{ message: string; added: number; updated: number; warnings?: string[] }>(
        '/admin/pandals/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setCsvMsg(`✅ ${r.data.message}`)
      if (r.data.warnings) setCsvWarnings(r.data.warnings)
      if (csvRef.current) csvRef.current.value = ''
      load()
    } catch (ex: any) {
      setCsvMsg(`❌ ${ex?.response?.data?.detail ?? 'CSV upload failed'}`)
    }
    setCsvLoading(false)
  }

  async function moderateReview(id: number, approved: boolean) {
    await api.patch(`/admin/moderation/reviews/${id}?approved=${approved}`)
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, is_approved: approved } : r)))
  }

  async function moderateMoment(id: number, approved: boolean) {
    await api.patch(`/admin/moderation/moments/${id}?approved=${approved}`)
    setMoments((prev) => prev.map((m) => (m.id === id ? { ...m, is_approved: approved } : m)))
  }

  async function resolveReport(id: number, st: 'RESOLVED' | 'REJECTED') {
    await api.patch(`/admin/reports/${id}?status=${st}`)
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: st } : r)))
  }

  async function toggleBlock(u: User) {
    if (u.role === 'ADMIN') return
    setUserBusy(u.id)
    try {
      const blocked = u.is_active !== false
      await api.patch(`/admin/users/${u.id}/block?blocked=${blocked}`)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !blocked } : x)))
    } catch {}
    setUserBusy(null)
  }

  async function changeRole(u: User, role: string) {
    setUserBusy(u.id)
    try {
      await api.patch(`/admin/users/${u.id}/role?new_role=${role}`)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: role as any } : x)))
    } catch {}
    setUserBusy(null)
  }

  const inputCls =
    'rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500 transition placeholder:text-stone-600'
  const sectionCls = 'rounded-2xl border border-stone-800 bg-stone-950/70 shadow-xl'

  return (
    <div className="space-y-6">
      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-stone-900 border border-stone-800 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === t.id
                ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/20'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ════════════════ OVERVIEW ════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {stats && (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Total Users', value: stats.total_users, icon: '👥', color: 'text-blue-400' },
                { label: 'Total Pandals', value: stats.total_pandals, icon: '🏛️', color: 'text-amber-400' },
                { label: 'Live Pandals', value: stats.active_pandals ?? '—', icon: '✅', color: 'text-emerald-400' },
                { label: 'Reviews', value: stats.total_reviews, icon: '⭐', color: 'text-yellow-400' },
                { label: 'Crowd Reports', value: stats.total_crowd_reports, icon: '🚦', color: 'text-orange-400' },
                { label: 'Pending Flags', value: stats.pending_reports_count ?? 0, icon: '⚑', color: 'text-red-400' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 flex flex-col gap-1">
                  <p className="text-2xl">{icon}</p>
                  <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
                  <p className="text-xs text-stone-500 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          )}

          {analytics && (
            <div className={`${sectionCls} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-stone-100">📈 Crowd activity (last 24h)</h2>
                <span className="text-xs text-stone-500">Hourly breakdown</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-stone-800 p-4">
                  <p className="text-xs font-semibold text-stone-400 mb-3">Reports per hour</p>
                  {analytics.hourly_crowd.length === 0 ? (
                    <p className="text-stone-500 text-sm">No data yet</p>
                  ) : (
                    <div className="flex items-end gap-1 h-28">
                      {analytics.hourly_crowd.map((pt) => {
                        const max = Math.max(...analytics.hourly_crowd.map((h) => h.report_count), 1)
                        const ht = Math.max(4, Math.round((pt.report_count / max) * 100))
                        return (
                          <div key={pt.hour} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full rounded-t-sm bg-gradient-to-t from-amber-600 to-amber-400 transition-all"
                              style={{ height: `${ht}px` }}
                              title={`${pt.report_count} reports`}
                            />
                            <span className="text-[9px] text-stone-600">{String(pt.hour).padStart(2, '0')}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-stone-800 p-4 space-y-3">
                  <p className="text-xs font-semibold text-stone-400">🔥 Top pandals by activity</p>
                  {analytics.top_pandals.length === 0 ? (
                    <p className="text-stone-500 text-sm">No data yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {analytics.top_pandals.map((tp) => (
                        <div key={tp.pandal_id} className="flex justify-between text-sm">
                          <span className="text-stone-200 truncate max-w-[65%]">{tp.pandal_name}</span>
                          <span className="text-amber-400 font-semibold shrink-0">{tp.report_count} reports</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={`${sectionCls} p-5`}>
            <h2 className="font-bold text-stone-100 mb-4">🗒️ Recent Admin Actions</h2>
            {auditLogs.length === 0 ? (
              <p className="text-stone-500 text-sm">No actions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-stone-900/60 border border-stone-800">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                      {log.action.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-400">{log.action}</p>
                      <p className="text-xs text-stone-400 truncate">
                        {log.user_email ?? 'System'} • {log.entity_type} #{log.entity_id}
                      </p>
                    </div>
                    <span className="text-[10px] text-stone-600 shrink-0">{relTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════ PANDAL MANAGER ════════════════ */}
      {activeTab === 'pandals' && (
        <div className="space-y-5">
          {/* CSV Import */}
          <div className="rounded-3xl border border-blue-500/30 bg-stone-950/80 p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-stone-100">📥 CSV Bulk Import & Verification</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Uploaded pandals are auto-marked as{' '}
                  <strong className="text-blue-400">Verified by Admin</strong>
                </p>
              </div>
              <a
                href="/api/admin/pandals/sample-csv"
                download="pandals_import_template.csv"
                className="px-4 py-2 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-2 shrink-0 transition"
              >
                ⬇ Download Template
              </a>
            </div>
            <form onSubmit={handleCsv} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                ref={csvRef}
                type="file"
                accept=".csv"
                required
                className="block w-full text-xs text-stone-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
              <button
                type="submit"
                disabled={csvLoading}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2 text-xs transition shrink-0"
              >
                {csvLoading ? 'Processing…' : '🚀 Import'}
              </button>
            </form>
            {csvMsg && (
              <div className="mt-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-stone-200">
                {csvMsg}
              </div>
            )}
            {csvWarnings.length > 0 && (
              <div className="mt-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
                <p className="font-bold mb-1">Warnings:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {csvWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              value={pandalSearch}
              onChange={(e) => setPandalSearch(e.target.value)}
              placeholder="🔍 Search by name or locality…"
              className={`${inputCls} flex-1`}
            />
            <select
              value={pandalStatus}
              onChange={(e) => setPandalStatus(e.target.value)}
              className={`${inputCls} sm:w-40`}
            >
              <option value="all">All statuses</option>
              <option value="published">Live</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition shrink-0"
            >
              {showAddForm ? '✕ Cancel' : '+ Add Pandal'}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <form onSubmit={addPandal} className={`${sectionCls} p-5 space-y-3`}>
              <h3 className="font-semibold text-stone-100 text-sm">New Pandal</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Name *" required value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
                <input placeholder="Locality" value={newLocality} onChange={(e) => setNewLocality(e.target.value)} className={inputCls} />
              </div>
              <input placeholder="Address *" required value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className={`${inputCls} w-full`} />
              <input placeholder="Theme" value={newTheme} onChange={(e) => setNewTheme(e.target.value)} className={`${inputCls} w-full`} />
              <div className="grid sm:grid-cols-3 gap-3">
                <input placeholder="Latitude" value={newLat} onChange={(e) => setNewLat(e.target.value)} className={inputCls} />
                <input placeholder="Longitude" value={newLng} onChange={(e) => setNewLng(e.target.value)} className={inputCls} />
                <input placeholder="Dates" value={newDates} onChange={(e) => setNewDates(e.target.value)} className={inputCls} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Accessibility tags" value={newAccess} onChange={(e) => setNewAccess(e.target.value)} className={inputCls} />
                <input placeholder="Official Links" value={newLinks} onChange={(e) => setNewLinks(e.target.value)} className={inputCls} />
              </div>
              <button className="rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-5 py-2 text-sm transition">
                ✓ Save & Verify
              </button>
            </form>
          )}

          {/* Pandal table */}
          <div className={`${sectionCls} overflow-hidden`}>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-900 text-stone-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Name / Locality</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                    <th className="px-4 py-3 text-left">Photos</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/50">
                  {filteredPandals.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-900/40 transition">
                      <td className="px-4 py-3 text-stone-500 font-mono text-xs">{p.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-100 leading-tight">{p.name}</p>
                        <p className="text-xs text-stone-500">{p.locality ?? '—'}</p>
                        {p.is_verified_by_admin && (
                          <span className="text-[10px] text-blue-400 font-semibold">✓ Verified</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill published={p.is_published} active={p.is_active} />
                      </td>
                      <td className="px-4 py-3 text-stone-300">{p.avg_rating != null ? `${p.avg_rating} ★` : '—'}</td>
                      <td className="px-4 py-3 text-stone-300">{p.photo_count}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs">{relTime(p.updated_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => setEditingPandal(p)}
                            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setPhotosPandal(p)}
                            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                          >
                            📷
                          </button>
                          {p.is_active && (
                            <button
                              onClick={() => togglePublish(p)}
                              disabled={pandalBusy === p.id}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                                p.is_published
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {p.is_published ? 'Unpublish' : 'Publish'}
                            </button>
                          )}
                          {p.is_active ? (
                            <button
                              onClick={() => archivePandal(p)}
                              disabled={pandalBusy === p.id}
                              className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold transition disabled:opacity-50"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={() => restorePandal(p)}
                              disabled={pandalBusy === p.id}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-xs font-semibold transition disabled:opacity-50"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPandals.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-stone-500">
                        No pandals found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-stone-800 text-xs text-stone-500">
              Showing {filteredPandals.length} of {pandals.length} pandals
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ MODERATION ════════════════ */}
      {activeTab === 'moderation' && (
        <div className="space-y-5">
          <div className="flex gap-1 p-1 rounded-xl bg-stone-900 border border-stone-800 w-fit text-sm">
            {(
              [
                { id: 'reports', label: `⚑ Flags (${reports.filter((r) => r.status === 'PENDING').length})` },
                { id: 'reviews', label: `⭐ Reviews (${reviews.length})` },
                { id: 'moments', label: `📸 Moments (${moments.length})` },
              ] as { id: 'reports' | 'reviews' | 'moments'; label: string }[]
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setModTab(st.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  modTab === st.id
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {modTab === 'reports' && (
            <div className={`${sectionCls} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-stone-800">
                <h2 className="font-bold text-stone-100">Flagged Inaccuracies & Reports</h2>
                <p className="text-xs text-stone-400 mt-0.5">User-submitted flags about pandal info or abusive content</p>
              </div>
              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-900 text-stone-400 text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Target</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Details</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/50">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-900/40">
                        <td className="px-4 py-3 font-medium text-stone-200">
                          {r.pandal_id
                            ? `Pandal #${r.pandal_id}`
                            : r.review_id
                            ? `Review #${r.review_id}`
                            : 'General'}
                        </td>
                        <td className="px-4 py-3 text-amber-400 font-semibold text-xs">{r.reason}</td>
                        <td className="px-4 py-3 text-stone-400 max-w-[250px] truncate text-xs" title={r.description ?? ''}>
                          {r.description ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              r.status === 'PENDING'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : r.status === 'RESOLVED'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-stone-800 text-stone-400 border border-stone-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status === 'PENDING' && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => resolveReport(r.id, 'RESOLVED')}
                                className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold transition"
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => resolveReport(r.id, 'REJECTED')}
                                className="px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold transition"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-stone-500">
                          No reports — all clean ✅
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modTab === 'reviews' && (
            <div className={`${sectionCls} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-stone-800">
                <h2 className="font-bold text-stone-100">User Reviews</h2>
                <p className="text-xs text-stone-400 mt-0.5">Approve or hide flagged reviews</p>
              </div>
              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-900 text-stone-400 text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Reviewer</th>
                      <th className="px-4 py-3 text-left">Pandal</th>
                      <th className="px-4 py-3 text-left">Rating</th>
                      <th className="px-4 py-3 text-left">Comment</th>
                      <th className="px-4 py-3 text-left">Flags</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/50">
                    {reviews.map((r) => (
                      <tr key={r.id} className="hover:bg-stone-900/40">
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-100">{r.user_name}</p>
                          <p className="text-xs text-stone-500">{r.user_email ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-stone-300 text-xs max-w-[120px] truncate">{r.pandal_name}</td>
                        <td className="px-4 py-3 text-yellow-400 font-bold">{r.rating}★</td>
                        <td
                          className="px-4 py-3 text-stone-400 max-w-[200px] truncate text-xs"
                          title={r.comment ?? ''}
                        >
                          {r.comment ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {r.flag_count > 0 && (
                            <span className="text-red-400 text-xs font-bold">⚑ {r.flag_count}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              r.is_approved
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {r.is_approved ? 'Approved' : 'Hidden'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => moderateReview(r.id, !r.is_approved)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                              r.is_approved
                                ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                            }`}
                          >
                            {r.is_approved ? 'Hide' : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-stone-500">
                          No reviews yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modTab === 'moments' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {moments.map((m) => (
                <div key={m.id} className={`${sectionCls} overflow-hidden`}>
                  <div className="relative">
                    <img src={m.image_url} alt={m.caption ?? ''} className="w-full h-44 object-cover" />
                    <div className="absolute top-2 right-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-sm border ${
                          m.is_approved
                            ? 'bg-emerald-900/80 text-emerald-300 border-emerald-500/30'
                            : 'bg-red-900/80 text-red-300 border-red-500/30'
                        }`}
                      >
                        {m.is_approved ? 'Approved' : 'Hidden'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-stone-200">{m.user_name}</p>
                    {m.caption && <p className="text-xs text-stone-400 line-clamp-2">{m.caption}</p>}
                    <p className="text-[10px] text-stone-600">{relTime(m.created_at)}</p>
                    <button
                      onClick={() => moderateMoment(m.id, !m.is_approved)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition ${
                        m.is_approved
                          ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {m.is_approved ? '🙈 Hide' : '✅ Approve'}
                    </button>
                  </div>
                </div>
              ))}
              {moments.length === 0 && (
                <p className="text-stone-500 text-sm col-span-3 py-12 text-center">No moments yet.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ USERS & ROLES ════════════════ */}
      {activeTab === 'users' && (
        <div className={`${sectionCls} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-stone-100">Users & Roles</h2>
              <p className="text-xs text-stone-400 mt-0.5">{users.length} registered users</p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-900 text-stone-400 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email / Phone</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-900/40 transition">
                    <td className="px-4 py-3 text-stone-500 font-mono text-xs">{u.id}</td>
                    <td className="px-4 py-3 font-semibold text-stone-100">{u.name}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs">{u.email ?? u.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : u.role === 'MODERATOR'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-stone-800 text-stone-400 border border-stone-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active === false ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                          Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{relTime(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'ADMIN' && (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u, e.target.value)}
                            disabled={userBusy === u.id}
                            className="rounded-lg border border-stone-700 bg-stone-800 text-stone-200 text-xs px-2 py-1 outline-none focus:border-amber-500 disabled:opacity-50"
                          >
                            <option value="USER">USER</option>
                            <option value="MODERATOR">MODERATOR</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                          <button
                            onClick={() => toggleBlock(u)}
                            disabled={userBusy === u.id}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                              u.is_active === false
                                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {u.is_active === false ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingPandal && (
        <EditPandalModal
          pandal={editingPandal}
          onClose={() => setEditingPandal(null)}
          onSaved={() => api.get<PandalAdminOut[]>('/admin/pandals?limit=500').then((r) => setPandals(r.data))}
        />
      )}
      {photosPandal && (
        <PhotoPanel pandal={photosPandal} onClose={() => setPhotosPandal(null)} />
      )}
    </div>
  )
}
