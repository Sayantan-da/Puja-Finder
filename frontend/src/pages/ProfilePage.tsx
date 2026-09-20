import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface UserStats {
  total_reviews: number
  total_crowd_reports: number
  total_favorites: number
  total_moments: number
  member_since: string | null
  role: 'USER' | 'ADMIN'
}

function AnimatedCounter({
  target,
  label,
  icon,
  bengaliLabel,
  gradient,
  borderCol,
  bgLight,
}: {
  target: number
  label: string
  icon: string
  bengaliLabel: string
  gradient: string
  borderCol: string
  bgLight: string
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) {
      setCount(0)
      return
    }
    const duration = 1000
    const steps = 25
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target])

  return (
    <div className="relative group">
      <div
        className={`rounded-2xl border ${borderCol} ${bgLight} p-5 text-center transition-all duration-300 hover:shadow-md hover:-translate-y-1`}
      >
        <span className="text-3xl block mb-2">{icon}</span>
        <p className={`text-3xl font-black bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {count}
        </p>
        <p className="text-xs font-bold text-stone-800 mt-1 uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-stone-500 font-bangla font-semibold mt-0.5">{bengaliLabel}</p>
      </div>
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-red-600 via-rose-600 to-amber-500',
    'from-amber-500 via-orange-600 to-red-600',
    'from-red-700 via-crimson to-amber-600',
    'from-rose-600 via-red-600 to-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Edit name
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Change password
  const [showPwSection, setShowPwSection] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showCurPw, setShowCurPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    if (!user) return
    setStatsLoading(true)
    api
      .get<UserStats>('/auth/stats')
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [user])

  if (!user) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4 animate-bounce">🔐</div>
        <h1 className="text-2xl font-black font-cinzel text-stone-900 mb-2">Login Required</h1>
        <p className="text-stone-600 mb-6 text-sm">Sign in to access your festive profile and hopper dashboard.</p>
        <Link
          to="/login"
          className="inline-block rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold px-8 py-3 transition shadow-md shadow-red-500/20"
        >
          Go to Login
        </Link>
      </main>
    )
  }

  const initials = getInitials(user.name)
  const avatarGrad = getAvatarColor(user.name)

  async function handleSaveName() {
    if (!newName.trim() || newName.trim().length < 2) {
      setNameMsg({ type: 'err', text: 'Name must be at least 2 characters' })
      return
    }
    setNameSaving(true)
    setNameMsg(null)
    try {
      await updateProfile({ name: newName.trim() })
      setEditingName(false)
      setNameMsg({ type: 'ok', text: 'Name updated successfully!' })
      setTimeout(() => setNameMsg(null), 3000)
    } catch (err: any) {
      setNameMsg({ type: 'err', text: err?.response?.data?.detail ?? 'Failed to update name' })
    } finally {
      setNameSaving(false)
    }
  }

  async function handleChangePassword() {
    setPwMsg(null)
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'New passwords do not match' })
      return
    }
    if (newPw.length < 6) {
      setPwMsg({ type: 'err', text: 'New password must be at least 6 characters' })
      return
    }
    setPwSaving(true)
    try {
      await updateProfile({ current_password: curPw, new_password: newPw })
      setCurPw('')
      setNewPw('')
      setConfirmPw('')
      setShowPwSection(false)
      setPwMsg({ type: 'ok', text: 'Password changed successfully!' })
      setTimeout(() => setPwMsg(null), 3000)
    } catch (err: any) {
      setPwMsg({ type: 'err', text: err?.response?.data?.detail ?? 'Failed to change password' })
    } finally {
      setPwSaving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  const memberSince = stats?.member_since
    ? new Date(stats.member_since).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  // Password strength indicator
  const pwStrength =
    newPw.length === 0
      ? 0
      : newPw.length < 6
        ? 1
        : newPw.length < 10
          ? 2
          : /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) && /[^a-zA-Z0-9]/.test(newPw)
            ? 4
            : 3
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500']

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Card with Majestic Bengali Festive Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-red-200 bg-white p-6 sm:p-8 shadow-lg shadow-red-500/5">
        {/* Festive top stripe */}
        <div className="h-2 w-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 absolute top-0 left-0 right-0" />

        {/* Decorative background glow */}
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Bengali Red-Gold Ring */}
          <div className="relative shrink-0">
            <div
              className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-3xl font-black text-white shadow-md ring-4 ring-red-100`}
            >
              {initials}
            </div>
            <div
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-red-200 flex items-center justify-center text-xs shadow-xs"
              title="Verified Devotee"
            >
              🔱
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
              <span className="text-xs font-bangla font-bold text-red-600 tracking-wide uppercase">
                শুভ শারদীয়া ২০২৬ ✦
              </span>
            </div>

            {/* Name (editable) */}
            {editingName ? (
              <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start flex-wrap">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-lg font-bold text-stone-900 outline-none focus:border-red-500 transition w-full max-w-xs shadow-xs"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {nameSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false)
                    setNameMsg(null)
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-black text-stone-900 font-cinzel">{user.name}</h1>
                <button
                  onClick={() => {
                    setNewName(user.name)
                    setEditingName(true)
                  }}
                  className="text-stone-400 hover:text-red-600 transition text-base cursor-pointer"
                  title="Edit name"
                >
                  ✏️
                </button>
              </div>
            )}

            {nameMsg && (
              <p className={`text-xs font-semibold mt-1 ${nameMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
                {nameMsg.text}
              </p>
            )}

            <p className="text-stone-500 text-sm font-medium">{user.email}</p>

            <div className="flex items-center gap-3 mt-3 justify-center sm:justify-start flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
                  user.role === 'ADMIN'
                    ? 'bg-purple-50 text-purple-800 border border-purple-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {user.role === 'ADMIN' ? '🛡️ Admin Master' : '🔱 শারদীয় পরিব্রাজক (Festive Hopper)'}
              </span>
              <span className="text-xs text-stone-500 font-medium bg-stone-100 px-3 py-1 rounded-full">
                📅 Member since {memberSince}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Activity Stats Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-stone-900 font-cinzel flex items-center gap-2">
            <span>📊</span> Your Festival Contributions &amp; Activity
          </h2>
          <span className="text-xs text-red-600 font-bold bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
            শারদ সম্মান ২০২৬
          </span>
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-red-100 bg-white p-5 animate-pulse h-28 shadow-xs" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnimatedCounter
              target={stats.total_reviews}
              label="Reviews"
              bengaliLabel="মতামত ও রেটিং"
              icon="⭐"
              gradient="from-amber-600 to-orange-500"
              borderCol="border-amber-200"
              bgLight="bg-amber-50/50"
            />
            <AnimatedCounter
              target={stats.total_crowd_reports}
              label="Crowd Reports"
              bengaliLabel="লাইভ ভিড়ের তথ্য"
              icon="📡"
              gradient="from-red-600 to-rose-600"
              borderCol="border-red-200"
              bgLight="bg-red-50/50"
            />
            <AnimatedCounter
              target={stats.total_favorites}
              label="Favourites"
              bengaliLabel="পছন্দের মণ্ডপ"
              icon="❤️"
              gradient="from-rose-600 to-pink-600"
              borderCol="border-rose-200"
              bgLight="bg-rose-50/50"
            />
            <AnimatedCounter
              target={stats.total_moments}
              label="Moments"
              bengaliLabel="উৎসবের ছবি"
              icon="📸"
              gradient="from-indigo-600 to-purple-600"
              borderCol="border-indigo-200"
              bgLight="bg-indigo-50/50"
            />
          </div>
        ) : (
          <p className="text-stone-500 text-sm">Could not load stats.</p>
        )}
      </section>

      {/* Pandal Hopper Badges / Passport */}
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-2">
          <span>🏆</span> Pujo Hopper Badges &amp; Passport
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
            <span className="text-2xl block mb-1">🏛️</span>
            <span className="text-xs font-bold text-stone-900 block">North Kolkata</span>
            <span className="text-[10px] text-stone-500">Rajbari Heritage Enthusiast</span>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
            <span className="text-2xl block mb-1">🌙</span>
            <span className="text-xs font-bold text-stone-900 block">Night Hopper</span>
            <span className="text-[10px] text-stone-500">Active 2 AM - 5 AM</span>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
            <span className="text-2xl block mb-1">🚇</span>
            <span className="text-xs font-bold text-stone-900 block">Metro Veteran</span>
            <span className="text-[10px] text-stone-500">Transit Smart Hopper</span>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
            <span className="text-2xl block mb-1">📸</span>
            <span className="text-xs font-bold text-stone-900 block">Darshan Chronicler</span>
            <span className="text-[10px] text-stone-500">Moments Contributor</span>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
          <span>⚡</span> Quick Hopper Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/favorites"
            className="flex items-center gap-3.5 rounded-2xl border border-red-100 bg-white p-4 hover:border-red-300 hover:shadow-md transition shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              ★
            </div>
            <div>
              <span className="text-sm font-bold text-stone-900 block">My Favourites</span>
              <span className="text-[11px] text-stone-500 font-bangla">সংরক্ষিত মণ্ডপ তালিকা</span>
            </div>
          </Link>

          <Link
            to="/moments"
            className="flex items-center gap-3.5 rounded-2xl border border-red-100 bg-white p-4 hover:border-red-300 hover:shadow-md transition shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              📸
            </div>
            <div>
              <span className="text-sm font-bold text-stone-900 block">Moments Feed</span>
              <span className="text-[11px] text-stone-500 font-bangla">উৎসবের স্মরণীয় মুহূর্ত</span>
            </div>
          </Link>

          <Link
            to="/planner"
            className="flex items-center gap-3.5 rounded-2xl border border-red-100 bg-white p-4 hover:border-red-300 hover:shadow-md transition shadow-xs group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              🧭
            </div>
            <div>
              <span className="text-sm font-bold text-stone-900 block">Route Planner</span>
              <span className="text-[11px] text-stone-500 font-bangla">দ্রুততম পরিক্রমা রুট</span>
            </div>
          </Link>

          {user.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="flex items-center gap-3.5 rounded-2xl border border-purple-200 bg-purple-50/50 p-4 hover:border-purple-400 hover:shadow-md transition shadow-xs group sm:col-span-3"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                🛡️
              </div>
              <div>
                <span className="text-sm font-bold text-purple-900 block">Admin Command Center</span>
                <span className="text-[11px] text-purple-700">Manage Pandals, Verify Community Flags, &amp; System Moderation</span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Change Password */}
      <section className="rounded-2xl border border-red-100 bg-white overflow-hidden shadow-xs">
        <button
          onClick={() => setShowPwSection(!showPwSection)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-red-50/50 transition cursor-pointer"
        >
          <span className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <span>🔑</span> Security &amp; Change Password
          </span>
          <span
            className={`text-stone-400 text-xs transition-transform duration-300 ${showPwSection ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
        {showPwSection && (
          <div className="px-6 pb-6 space-y-4 border-t border-red-50 pt-4">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurPw ? 'text' : 'password'}
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 outline-none focus:border-red-500 transition pr-12 font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurPw(!showCurPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                >
                  {showCurPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 outline-none focus:border-red-500 transition pr-12 font-medium"
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                >
                  {showNewPw ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength indicator */}
              {newPw.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          pwStrength >= level ? strengthColors[pwStrength] : 'bg-stone-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold text-stone-500">{strengthLabels[pwStrength]}</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-stone-900 outline-none transition font-medium ${
                  confirmPw && confirmPw !== newPw
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-stone-300 focus:border-red-500'
                }`}
                placeholder="Re-enter new password"
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-red-600 font-semibold mt-1">Passwords don't match</p>
              )}
            </div>
            {pwMsg && (
              <p className={`text-xs font-bold ${pwMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
                {pwMsg.text}
              </p>
            )}
            <button
              onClick={handleChangePassword}
              disabled={pwSaving || !curPw || !newPw || !confirmPw}
              className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-5 py-2.5 text-sm transition shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
            >
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        )}
      </section>

      {/* Account Actions */}
      <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-2">
          <span>🚪</span> Account Session
        </h2>
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded-xl border border-red-200 bg-red-50/70 text-red-700 font-bold px-6 py-2.5 hover:bg-red-100 transition text-sm cursor-pointer shadow-xs"
          >
            Sign Out
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-semibold text-stone-700">Are you sure you want to sign out?</p>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2 transition text-sm cursor-pointer shadow-xs"
            >
              Yes, Sign Out
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="rounded-xl border border-stone-300 text-stone-700 text-sm font-semibold px-4 py-2 hover:bg-stone-50 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
