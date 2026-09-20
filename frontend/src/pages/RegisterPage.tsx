import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { useAuth } from '../auth/AuthContext'
import { auth, isFirebaseConfigured } from '../lib/firebase'

declare global {
  interface Window {
    recaptchaVerifier?: any
  }
}

export default function RegisterPage() {
  const { register, phoneRegister, user } = useAuth()
  const navigate = useNavigate()

  // Tab: 'phone' or 'email'
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone')

  // Common fields
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted] = useState(true)

  // Email flow fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Phone flow fields
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [mockDevMode, setMockDevMode] = useState(!isFirebaseConfigured())

  const recaptchaContainerRef = useRef<HTMLDivElement>(null)

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear()
        } catch {
          // ignore
        }
        window.recaptchaVerifier = null
      }
    }
  }, [])

  // Redirect if already logged in
  if (user) {
    navigate('/')
    return null
  }

  // Password strength for email mode
  const pwStrength =
    password.length === 0
      ? 0
      : password.length < 6
        ? 1
        : password.length < 10
          ? 2
          : /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)
            ? 4
            : 3
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-sky-500', 'bg-emerald-500']

  // Format full international phone number
  const fullPhone = `${phoneCountryCode}${phoneNumber.replace(/\D/g, '')}`

  // ---------- Send OTP ----------
  async function onSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanDigits = phoneNumber.replace(/\D/g, '')
    if (cleanDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    setBusy(true)

    // Check if Firebase is live or in dev-mock mode
    if (!isFirebaseConfigured() || !auth) {
      setMockDevMode(true)
      setOtpSent(true)
      setCountdown(30)
      setBusy(false)
      return
    }

    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // Recaptcha resolved
          },
          'expired-callback': () => {
            if (window.recaptchaVerifier) {
              window.recaptchaVerifier.clear()
              window.recaptchaVerifier = null
            }
          },
        })
      }

      const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier)
      setConfirmationResult(confirmation)
      setOtpSent(true)
      setCountdown(45)
    } catch (err: any) {
      console.error('Firebase send OTP error:', err)
      const msg = err?.message || 'Failed to send OTP SMS'
      if (msg.includes('invalid-phone-number')) {
        setError('The phone number format is invalid.')
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please wait a few minutes before trying again.')
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  // ---------- Verify OTP & Complete Signup ----------
  async function onVerifyOtpAndRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanOtp = otpCode.replace(/\D/g, '')
    if (cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }

    setBusy(true)
    try {
      let idToken = ''

      if (mockDevMode || !confirmationResult) {
        // Fallback testing token for dev environment without active Firebase keys
        idToken = `test-token:${fullPhone}:uid_${Date.now()}`
      } else {
        const credential = await confirmationResult.confirm(cleanOtp)
        idToken = await credential.user.getIdToken()
      }

      await phoneRegister(idToken, name.trim())
      navigate('/')
    } catch (err: any) {
      console.error('Registration error:', err)
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (err?.code === 'auth/invalid-verification-code') {
        setError('Incorrect verification code. Please check your SMS and try again.')
      } else if (err?.code === 'auth/code-expired') {
        setError('Verification code has expired. Please request a new one.')
      } else {
        setError(err?.message || 'Registration failed. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  // ---------- Standard Email & Password Signup ----------
  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(name.trim(), email.trim(), password)
      navigate('/')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Registration failed — try another email?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      {/* Invisible Recaptcha container */}
      <div id="recaptcha-container" ref={recaptchaContainerRef} />

      <div className="w-full max-w-lg relative">
        {/* Main card */}
        <div
          className={`rounded-3xl border border-red-200 bg-white p-8 sm:p-10 shadow-2xl shadow-red-500/10 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-200 mb-4 shadow-xs">
              <span className="text-3xl">🪔</span>
            </div>
            <h1 className="text-2xl font-black text-stone-900 font-cinzel mb-1 tracking-tight">Create your account</h1>
            <p className="text-stone-600 text-sm font-medium">
              Join PujaFinder to explore Kolkata's pujos with live crowd updates.
            </p>
          </div>

          {/* Authentication Method Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-2xl mb-6 border border-stone-200">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('phone')
                setError('')
              }}
              className={`py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMethod === 'phone'
                  ? 'bg-white text-red-600 shadow-sm border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>📱</span> Mobile OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email')
                setError('')
              }}
              className={`py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authMethod === 'email'
                  ? 'bg-white text-red-600 shadow-sm border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>✉️</span> Email & Password
            </button>
          </div>

          {/* -------------------- PHONE OTP SIGNUP FORM -------------------- */}
          {authMethod === 'phone' && (
            <div>
              {/* Step 1: Enter Name & Phone */}
              {!otpSent ? (
                <form onSubmit={onSendOtp} className="space-y-5">
                  {/* Full Name */}
                  <div className="group">
                    <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                      Full name
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                        👤
                      </span>
                      <input
                        id="phone-register-name"
                        required
                        minLength={2}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-stone-300 bg-stone-50/70 pl-10 pr-4 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 text-stone-900 font-medium"
                        placeholder="Rahul Das"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="group">
                    <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                      Mobile number
                    </label>
                    <div className="flex gap-2">
                      <div className="w-24 shrink-0 relative">
                        <select
                          value={phoneCountryCode}
                          onChange={(e) => setPhoneCountryCode(e.target.value)}
                          className="w-full rounded-xl border border-stone-300 bg-stone-50/70 px-3 py-3 outline-none transition focus:border-red-500 text-stone-900 font-mono text-sm font-semibold"
                        >
                          <option value="+91">🇮🇳 +91</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+880">🇧🇩 +880</option>
                        </select>
                      </div>
                      <div className="relative flex-1">
                        <input
                          id="register-phone-number"
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full rounded-xl border border-stone-300 bg-stone-50/70 px-4 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 text-stone-900 placeholder:text-stone-400 font-mono font-medium"
                          placeholder="98765 43210"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 mt-1.5 font-medium">
                      We'll send a 6-digit one-time password (OTP) to this number.
                    </p>
                  </div>

                  {/* Error display */}
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 font-semibold">
                      <span>⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Send OTP button */}
                  <button
                    id="phone-send-otp-btn"
                    type="submit"
                    disabled={busy || !name.trim() || phoneNumber.trim().length < 8}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 disabled:hover:shadow-none disabled:hover:scale-100 active:scale-[0.99] cursor-pointer"
                  >
                    {busy ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending OTP…
                      </span>
                    ) : (
                      'Send OTP SMS 📲'
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Enter 6-digit OTP */
                <form onSubmit={onVerifyOtpAndRegister} className="space-y-5">
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-center">
                    <span className="text-2xl mb-1 block">📩</span>
                    <p className="text-sm font-bold text-red-800">Enter verification code</p>
                    <p className="text-xs text-stone-600 mt-0.5 font-medium">
                      Sent to <span className="font-mono text-stone-900 font-bold">{fullPhone}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false)
                        setOtpCode('')
                        setError('')
                      }}
                      className="text-xs text-red-600 hover:text-red-700 hover:underline mt-2 font-bold inline-block cursor-pointer"
                    >
                      Change phone number
                    </button>
                  </div>

                  {/* OTP Digits Input */}
                  <div className="group">
                    <label className="text-sm text-stone-700 block mb-1.5 text-center font-semibold">
                      6-digit OTP code
                    </label>
                    <input
                      id="register-otp-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold rounded-xl border border-stone-300 bg-stone-50 py-3.5 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 text-red-600 placeholder:text-stone-300"
                      placeholder="••••••"
                    />
                  </div>

                  {/* Resend OTP timer */}
                  <div className="flex items-center justify-between text-xs text-stone-600 px-1 font-medium">
                    <span>Didn't receive SMS?</span>
                    {countdown > 0 ? (
                      <span className="text-stone-500 font-mono font-bold">Resend in {countdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={onSendOtp}
                        disabled={busy}
                        className="text-red-600 hover:text-red-700 hover:underline font-bold cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 font-semibold">
                      <span>⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit verify */}
                  <button
                    id="phone-verify-register-btn"
                    type="submit"
                    disabled={busy || otpCode.length !== 6}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 disabled:hover:shadow-none disabled:hover:scale-100 active:scale-[0.99] cursor-pointer"
                  >
                    {busy ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying & creating account…
                      </span>
                    ) : (
                      'Verify & Create Account ✨'
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* -------------------- EMAIL & PASSWORD SIGNUP FORM -------------------- */}
          {authMethod === 'email' && (
            <form onSubmit={onEmailSubmit} className="space-y-5">
              {/* Name */}
              <div className="group">
                <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  Full name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    👤
                  </span>
                  <input
                    id="register-name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 pl-10 pr-4 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 text-stone-900 font-medium"
                    placeholder="Rahul Das"
                  />
                </div>
              </div>

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
                    id="register-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 pl-10 pr-4 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 text-stone-900 font-medium"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label className="text-sm text-stone-700 block mb-1.5 font-semibold">
                  Password (min 6 chars)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                    🔑
                  </span>
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/70 pl-10 pr-12 py-3 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 placeholder:text-stone-400 text-stone-900 font-medium"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition text-sm cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            pwStrength >= level ? strengthColors[pwStrength] : 'bg-stone-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-stone-500 font-medium">{strengthLabels[pwStrength]}</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 font-semibold">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                id="register-submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white font-bold px-5 py-3.5 shadow-md shadow-red-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.01] disabled:opacity-50 disabled:hover:shadow-none disabled:hover:scale-100 active:scale-[0.99] cursor-pointer"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  'Sign up with Email'
                )}
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
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-red-600 hover:text-red-700 font-bold hover:underline transition"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
