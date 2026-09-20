import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import RatingStars from '../components/RatingStars'
import type { MomentItem } from '../types'
import { timeAgo } from '../utils/format'

export default function MomentsPage() {
  const { user } = useAuth()
  const [moments, setMoments] = useState<MomentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const captionInput = useRef<HTMLInputElement>(null)

  const PAGE_SIZE = 24

  const load = () => {
    setLoading(true)
    api
      .get<MomentItem[]>(`/moments?limit=${PAGE_SIZE}`)
      .then((r) => {
        setMoments(r.data)
        setHasMore(r.data.length === PAGE_SIZE)
      })
      .catch(() => setNotice('Could not load moments'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const loadMore = () => {
    setLoadingMore(true)
    api
      .get<MomentItem[]>(`/moments?limit=${PAGE_SIZE}&offset=${moments.length}`)
      .then((r) => {
        setMoments((prev) => [...prev, ...r.data])
        setHasMore(r.data.length === PAGE_SIZE)
      })
      .catch(() => setNotice('Could not load more'))
      .finally(() => setLoadingMore(false))
  }

  async function upload(e: FormEvent) {
    e.preventDefault()
    setNotice('')
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setNotice('Choose a photo first')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    if (captionInput.current?.value) fd.append('caption', captionInput.current.value)
    try {
      await api.post('/moments', fd)
      if (fileInput.current) fileInput.current.value = ''
      if (captionInput.current) captionInput.current.value = ''
      setNotice('✅ Moment shared!')
      load()
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Upload failed')
    }
  }

  async function rate(moment: MomentItem, rating: number) {
    try {
      const { data } = await api.post(`/moments/${moment.id}/rate`, { rating })
      setMoments((prev) =>
        prev.map((m) =>
          m.id === moment.id
            ? { ...m, avg_rating: data.avg_rating, vote_count: data.vote_count, my_rating: data.my_rating }
            : m,
        ),
      )
    } catch (err: any) {
      setNotice(err?.response?.data?.detail === 'Not authenticated' ? 'Login to rate moments' : 'Could not rate')
    }
  }

  async function remove(moment: MomentItem) {
    if (!confirm('Delete this moment?')) return
    try {
      await api.delete(`/moments/${moment.id}`)
      load()
    } catch (err: any) {
      setNotice(err?.response?.data?.detail ?? 'Could not delete')
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* ── Moments Header with Reference Photos (Celebratory Dhunuchi Naach) ── */}
      <div className="rounded-3xl border border-red-200 bg-white p-6 sm:p-8 mb-8 shadow-lg relative overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 absolute top-0 left-0 right-0" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 border border-red-300 text-red-800 text-xs font-bangla font-semibold mb-3">
              <span>📸</span> পুজো পরিক্রমার মুহূর্ত ও স্মৃতি ✦ Pujo Moments
            </div>
            <h1
              className="text-3xl sm:text-4xl font-extrabold text-stone-900 leading-tight"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Kolkata <span className="sindoor-text">Puja Moments</span> &amp; Dhunuchi Naach
            </h1>
            <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
              Capture and share the golden lights, thakur dekha, dhunuchi naach, and vibrant street life of Durga Puja. Star-rate the finest moments shared by fellow revellers!
            </p>
          </div>

          <div className="md:col-span-4 flex justify-center">
            <div className="w-56 h-40 rounded-2xl overflow-hidden border-2 border-red-200 shadow-md">
              <img
                src="/assets/hero-dhunuchi-red.jpg"
                alt="Happy Durga Puja Dhunuchi Celebration"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 font-semibold shadow-xs">
          {notice}
        </div>
      )}

      {/* Upload Section */}
      {user ? (
        <form
          onSubmit={upload}
          className="mb-8 rounded-2xl border border-red-200 bg-white p-5 flex flex-wrap items-center gap-3 shadow-md"
        >
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-stone-600 file:mr-3 file:rounded-xl file:border-0 file:bg-red-50 file:text-red-700 file:font-semibold file:px-4 file:py-2 file:text-sm hover:file:bg-red-100 cursor-pointer"
          />
          <input
            ref={captionInput}
            placeholder="Caption — where was this pujo moment? 🪔"
            className="flex-1 min-w-[220px] rounded-xl border border-red-200 bg-white px-4 py-2 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-red-500 shadow-xs"
          />
          <button
            type="submit"
            className="rounded-xl font-bold px-5 py-2.5 text-sm text-white shadow-md hover:brightness-105 transition"
            style={{
              background: 'linear-gradient(135deg, #D31027 0%, #EF4444 100%)',
            }}
          >
            ⬆ Share Moment
          </button>
        </form>
      ) : (
        <div className="mb-8 rounded-2xl border border-red-100 bg-white p-5 text-sm text-stone-600 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <span>Sign in to upload your own Durga Puja clicks and rate others.</span>
          <Link
            to="/login"
            className="font-bold text-red-700 hover:text-red-800 bg-red-50 px-4 py-1.5 rounded-lg border border-red-200"
          >
            Login to post →
          </Link>
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="text-center py-16">
          <div className="text-3xl animate-bounce mb-2">📸</div>
          <p className="text-stone-500">Loading festive moments…</p>
        </div>
      ) : moments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-red-100 p-8 text-center text-stone-600">
          <p className="font-semibold">No moments shared yet — be the first to post a photo!</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {moments.map((m) => (
            <div key={m.id} className="rounded-2xl border border-red-100 bg-white overflow-hidden shadow-md hover:shadow-xl transition group">
              <div className="w-full h-60 bg-stone-100 overflow-hidden relative">
                <img
                  src={m.image_url}
                  alt={m.caption ?? 'moment'}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div className="p-4">
                {m.caption && <p className="text-sm font-semibold text-stone-900 mb-1">{m.caption}</p>}
                <p className="text-xs text-stone-500 mb-3">
                  by <span className="font-semibold text-stone-700">{m.user_name}</span>
                  {m.created_at ? ` · ${timeAgo(m.created_at)}` : ''}
                </p>
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-red-50">
                  <RatingStars value={m.avg_rating} count={m.vote_count} />
                  {user && (
                    <span className="inline-flex items-center">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => rate(m, n)}
                          className={`text-lg leading-none -ml-0.5 transition hover:scale-110 ${
                            n <= (m.my_rating ?? 0) ? 'text-amber-500' : 'text-stone-300 hover:text-amber-400'
                          }`}
                          title={`Rate ${n} star${n > 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </span>
                  )}
                  {user && (user.id === m.user_id || user.role === 'ADMIN') && (
                    <button onClick={() => remove(m)} className="text-xs text-red-500 hover:text-red-700 p-1">
                      🗑
                    </button>
                  )}
                </div>
                {user && m.my_rating != null && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1">You rated this {m.my_rating}★</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center mt-8">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-xl border border-red-300 bg-white hover:bg-red-50 disabled:opacity-50 text-red-700 font-bold px-6 py-3 text-sm transition shadow-sm"
          >
            {loadingMore ? 'Loading…' : '⬇ Load more moments'}
          </button>
        </div>
      )}
    </main>
  )
}
