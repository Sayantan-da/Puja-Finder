import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PandalCard from '../components/PandalCard'
import type { Pandal } from '../types'

export default function FavoritesPage() {
  const { user } = useAuth()
  const [pandals, setPandals] = useState<Pandal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    api
      .get<Pandal[]>('/favorites')
      .then((r) => setPandals(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-2xl mb-3">🔒</p>
        <h1 className="text-xl font-bold mb-2">Login required</h1>
        <p className="text-stone-400 mb-5">Please login to see your favourite pandals.</p>
        <Link to="/login" className="rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold px-5 py-2.5 inline-block transition">
          Go to login
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">★ Your favourite pandals</h1>
      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : pandals.length === 0 ? (
        <p className="text-stone-500">
          Nothing saved yet. Open a pandal and tap “☆ Add to favourites”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pandals.map((p) => (
            <PandalCard key={p.id} pandal={p} />
          ))}
        </div>
      )}
    </main>
  )
}
