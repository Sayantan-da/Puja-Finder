import axios from 'axios'

export const api = axios.create({
  baseURL: '/api', // Vite dev server proxies /api → http://localhost:8000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pf_token')
      localStorage.removeItem('pf_user')
    }
    // Puja-night resilience: retry GETs once on network errors / 5xx
    const cfg = err.config
    const retryable = !err.response || err.response.status >= 500
    if (cfg && cfg.method === 'get' && retryable && !cfg._retry) {
      cfg._retry = true
      await new Promise((r) => setTimeout(r, 500))
      return api.request(cfg)
    }
    return Promise.reject(err)
  },
)
