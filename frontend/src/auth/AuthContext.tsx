import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { LoginResult, User } from '../types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string, captchaToken?: string) => Promise<LoginResult>
  verifyMfa: (mfaToken: string, code: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<LoginResult>
  phoneRegister: (idToken: string, name: string, email?: string) => Promise<User>
  phoneLogin: (idToken: string) => Promise<User>
  logout: () => void
  updateProfile: (data: { name?: string; current_password?: string; new_password?: string }) => Promise<User>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on load
  useEffect(() => {
    const token = localStorage.getItem('pf_token')
    const cached = localStorage.getItem('pf_user')
    if (!token) {
      setLoading(false)
      return
    }
    if (cached) {
      try {
        setUser(JSON.parse(cached) as User)
      } catch {
        /* ignore */
      }
    }
    api
      .get<User>('/auth/me')
      .then((res) => {
        setUser(res.data)
        localStorage.setItem('pf_user', JSON.stringify(res.data))
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string, captchaToken?: string): Promise<LoginResult> {
    const payload: { username: string; password: string; captcha_token?: string } = {
      username: email,
      password,
    }
    if (captchaToken) {
      payload.captcha_token = captchaToken
    }

    const { data } = await api.post<{
      access_token?: string
      mfa_required: boolean
      mfa_token?: string
    }>('/auth/login', payload)

    // Check if secondary MFA verification is required
    if (data.mfa_required && data.mfa_token) {
      return {
        mfaRequired: true,
        mfaToken: data.mfa_token,
      }
    }

    if (data.access_token) {
      localStorage.setItem('pf_token', data.access_token)
      const me = await api.get<User>('/auth/me')
      localStorage.setItem('pf_user', JSON.stringify(me.data))
      setUser(me.data)
      return {
        mfaRequired: false,
        user: me.data,
      }
    }

    throw new Error('Unexpected authentication response')
  }

  async function verifyMfa(mfaToken: string, code: string): Promise<User> {
    const { data } = await api.post<{ access_token: string }>('/auth/login/mfa', {
      mfa_token: mfaToken,
      code,
    })
    localStorage.setItem('pf_token', data.access_token)
    const me = await api.get<User>('/auth/me')
    localStorage.setItem('pf_user', JSON.stringify(me.data))
    setUser(me.data)
    return me.data
  }

  async function register(name: string, email: string, password: string) {
    await api.post('/auth/register', { name, email, password })
    return login(email, password)
  }

  async function phoneRegister(idToken: string, name: string, email?: string): Promise<User> {
    const { data } = await api.post<{ access_token: string }>('/auth/phone/register', {
      id_token: idToken,
      name,
      email: email || undefined,
    })
    localStorage.setItem('pf_token', data.access_token)
    const me = await api.get<User>('/auth/me')
    localStorage.setItem('pf_user', JSON.stringify(me.data))
    setUser(me.data)
    return me.data
  }

  async function phoneLogin(idToken: string): Promise<User> {
    const { data } = await api.post<{ access_token: string }>('/auth/phone/login', {
      id_token: idToken,
    })
    localStorage.setItem('pf_token', data.access_token)
    const me = await api.get<User>('/auth/me')
    localStorage.setItem('pf_user', JSON.stringify(me.data))
    setUser(me.data)
    return me.data
  }

  function logout() {
    localStorage.removeItem('pf_token')
    localStorage.removeItem('pf_user')
    setUser(null)
  }

  async function updateProfile(data: { name?: string; current_password?: string; new_password?: string }) {
    const res = await api.put<User>('/auth/profile', data)
    setUser(res.data)
    localStorage.setItem('pf_user', JSON.stringify(res.data))
    return res.data
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyMfa,
        register,
        phoneRegister,
        phoneLogin,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

