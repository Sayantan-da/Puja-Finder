import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Password strength calculation
  const strength = useMemo(() => {
    let score = 0
    if (password.length >= 6) score += 1
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    return score // 0-5
  }, [password])

  const strengthLabel = useMemo(() => {
    if (!password) return ''
    if (strength <= 1) return 'Very Weak'
    if (strength === 2) return 'Weak'
    if (strength === 3) return 'Moderate'
    if (strength === 4) return 'Strong'
    return 'Very Strong'
  }, [password, strength])

  const strengthColor = useMemo(() => {
    if (strength <= 1) return 'bg-red-500'
    if (strength === 2) return 'bg-orange-500'
    if (strength === 3) return 'bg-amber-500'
    if (strength === 4) return 'bg-emerald-500'
    return 'bg-green-600'
  }, [strength])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Password reset token is missing from URL. Please use the link sent to your email.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    setError('')

    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: password,
      })
      setSuccess(true)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Failed to reset password. The link may have expired.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <span className="text-4xl mb-4 inline-block">⚠️</span>
          <h1 className="text-2xl font-black text-stone-900 font-cinzel mb-2">Invalid Reset Link</h1>
          <p className="text-stone-600 text-sm mb-6">
            This password reset link is missing a security token. Please request a new link from the forgot password page.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold px-5 py-3 shadow-md hover:shadow-lg transition-all"
          >
            Request New Reset Link
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        <div className="rounded-3xl border border-red-200 bg-white p-8 sm:p-10 shadow-2xl shadow-red-500/10 transition-all duration-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 mb-4 shadow-xs">
              <span className="text-3xl">🔑</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 font-cinzel mb-1 tracking-tight">
              Create New Password
            </h1>
            <p className="text-stone-600 text-sm font-medium">
              Choose a strong, secure password for your PujaFinder account.
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-5 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-semibold">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success ? (
            /* Success State */
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium leading-relaxed">
                <p className="font-bold text-base mb-1 text-emerald-950">🎉 Password Reset Successfully!</p>
                Your password has been updated. You can now use your new password to sign in.
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 hover:shadow-lg transition-all cursor-pointer"
                >
                  Proceed to Login
                </button>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    🔒
                  </span>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 text-stone-900 pl-10 pr-12 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 font-medium"
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition text-sm p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {password && (
                  <div className="mt-2 space-y-1 animate-fadeIn">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500">Strength:</span>
                      <span className="font-semibold text-stone-700">{strengthLabel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${(strength / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    🔁
                  </span>
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 text-stone-900 pl-10 pr-4 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 font-medium"
                    placeholder="Re-type new password"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="reset-password-submit"
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating password…
                  </span>
                ) : (
                  'Reset Password & Sign In'
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition hover:underline"
                >
                  ← Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
