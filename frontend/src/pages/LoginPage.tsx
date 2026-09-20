import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export default function LoginPage() {
  const { login, verifyMfa, user } = useAuth()
  const navigate = useNavigate()

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted] = useState(true)

  // Multi-Factor Authentication (MFA) State
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')

  // Bot Protection (Cloudflare Turnstile)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
  const isTurnstileEnabled = Boolean(turnstileSiteKey)

  // Redirect if already logged in
  if (user) {
    navigate('/')
    return null
  }

  // Load Cloudflare Turnstile script dynamically if configured
  useEffect(() => {
    if (!isTurnstileEnabled || mfaStep) return

    let script = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'cf-turnstile-script'
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const initTurnstile = () => {
      if (window.turnstile && turnstileContainerRef.current && !turnstileWidgetId.current) {
        try {
          turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: turnstileSiteKey,
            theme: 'dark',
            callback: (token: string) => {
              setCaptchaToken(token)
              setError('')
            },
            'expired-callback': () => {
              setCaptchaToken(null)
            },
            'error-callback': () => {
              setCaptchaToken(null)
            },
          })
        } catch (e) {
          console.error('Turnstile render error:', e)
        }
      }
    }

    if (window.turnstile) {
      initTurnstile()
    } else {
      script.onload = initTurnstile
    }

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId.current)
        } catch {
          /* ignore cleanup errors */
        }
        turnstileWidgetId.current = null
      }
    }
  }, [isTurnstileEnabled, mfaStep, turnstileSiteKey])

  // Step 1: Submit Primary Credentials (Email + Password + CAPTCHA)
  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    if (isTurnstileEnabled && !captchaToken) {
      setError('Please complete the security check before logging in.')
      setBusy(false)
      return
    }

    try {
      const result = await login(email, password, captchaToken || undefined)

      if (result.mfaRequired && result.mfaToken) {
        // Switch to secondary MFA step
        setMfaToken(result.mfaToken)
        setMfaStep(true)
        setError('')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      // Standardize generic error display (OWASP A07 - Prevent username enumeration)
      const detail = err?.response?.data?.detail
      setError(detail || 'Invalid email or password.')

      // Reset Turnstile challenge on failure to prevent token replay
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current)
        setCaptchaToken(null)
      }
    } finally {
      setBusy(false)
    }
  }

  // Step 2: Submit Secondary Verification (TOTP 6-digit Code)
  async function onSubmitMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Please enter a valid 6-digit code.')
      return
    }

    setBusy(true)
    setError('')

    try {
      await verifyMfa(mfaToken, mfaCode)
      navigate('/')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Invalid verification code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleBackToLogin() {
    setMfaStep(false)
    setMfaToken('')
    setMfaCode('')
    setError('')
    setCaptchaToken(null)
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Main card */}
        <div
          className={`rounded-3xl border border-red-200 bg-white p-8 sm:p-10 shadow-2xl shadow-red-500/10 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-200 mb-4 shadow-xs">
              <span className="text-3xl">{mfaStep ? '🛡️' : '🔱'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 font-cinzel mb-1 tracking-tight">
              {mfaStep ? 'Two-Factor Verification' : 'Welcome Back'}
            </h1>
            <p className="text-stone-600 text-sm font-medium">
              {mfaStep
                ? 'Enter the 6-digit authentication code from your authenticator app.'
                : 'Login to review pandals, report live crowds and save favourites.'}
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-5 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-fadeIn font-semibold">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!mfaStep ? (
            /* STEP 1: Primary Authentication Form */
            <form onSubmit={onSubmitCredentials} className="space-y-5">
              {/* Email */}
              <div className="group">
                <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    ✉️
                  </span>
                  <input
                    id="login-email"
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

              {/* Password */}
              <div className="group">
                <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    🔑
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 text-stone-900 pl-10 pr-12 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 font-medium"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition text-sm p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Bot Protection Challenge (Cloudflare Turnstile) */}
              {isTurnstileEnabled && (
                <div className="flex justify-center py-2">
                  <div ref={turnstileContainerRef} id="turnstile-container" />
                </div>
              )}

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 disabled:hover:shadow-none disabled:hover:scale-100 active:scale-[0.99] cursor-pointer"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </span>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Multi-Factor Authentication (TOTP) Form */
            <form onSubmit={onSubmitMfa} className="space-y-6">
              <div className="group">
                <label className="text-sm text-stone-700 block mb-2 font-semibold">
                  Authentication Code
                </label>
                <div className="relative">
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono rounded-xl border border-stone-300 bg-stone-50 text-stone-900 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-300 font-bold"
                    placeholder="000000"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-2 text-center">
                  Open Google Authenticator, Microsoft Authenticator or 1Password to view your code.
                </p>
              </div>

              <button
                id="mfa-submit"
                type="submit"
                disabled={busy || mfaCode.length !== 6}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 disabled:hover:shadow-none disabled:hover:scale-100 active:scale-[0.99] cursor-pointer"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying Code…
                  </span>
                ) : (
                  'Verify & Continue'
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full text-center text-sm text-stone-500 hover:text-stone-800 font-semibold transition py-1"
              >
                ← Back to Login
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold">or</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <p className="text-center text-sm text-stone-600 font-medium">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-red-600 hover:text-red-700 font-bold hover:underline transition"
            >
              Sign up
            </Link>
          </p>

          {/* NOTE: Hardcoded demo accounts (admin@pujafinder.in, demo@pujafinder.in)
              have been completely stripped out of the production build (OWASP A07). */}
        </div>
      </div>
    </main>
  )
}
