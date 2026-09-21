import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setBusy(true)
    setError('')

    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSubmitted(true)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Failed to send password reset email. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        <div className="rounded-3xl border border-red-200 bg-white p-8 sm:p-10 shadow-2xl shadow-red-500/10 transition-all duration-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 mb-4 shadow-xs">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 font-cinzel mb-1 tracking-tight">
              Forgot Password?
            </h1>
            <p className="text-stone-600 text-sm font-medium">
              Enter your registered email address and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-5 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-semibold">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            /* Success State */
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium leading-relaxed">
                <p className="font-bold text-base mb-1 text-emerald-950">✉️ Reset Link Sent!</p>
                If an account with <strong className="text-emerald-950">{email}</strong> exists, you will receive an email shortly with instructions to reset your password.
              </div>

              <div className="text-xs text-stone-500 leading-relaxed">
                Didn't receive the email? Check your spam folder or wait a couple of minutes before requesting again.
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 hover:shadow-lg transition-all"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  Account Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    ✉️
                  </span>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 text-stone-900 pl-10 pr-4 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 font-medium"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                id="reset-submit"
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending instructions…
                  </span>
                ) : (
                  'Send Reset Link'
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
