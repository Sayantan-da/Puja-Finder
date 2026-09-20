import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import CrowdBadge from '../components/CrowdBadge'
import MapView from '../components/MapView'
import type { Pandal } from '../types'

export default function MapPage() {
  const [pandals, setPandals] = useState<Pandal[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Pandal[]>('/pandals')
      .then((res) => setPandals(res.data))
      .catch(() => setError('Could not reach the API. Is the backend running on port 8000?'))
  }, [])

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Pandal map 🗺️</h1>
      <p className="text-stone-400 mb-5">All registered pandals across Kolkata.</p>
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 text-red-300 px-4 py-3 mb-6">
          {error}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl overflow-hidden border border-stone-800">
          <MapView pandals={pandals} height={520} />
        </div>
        <aside className="max-h-[520px] overflow-y-auto pr-1 space-y-2">
          {pandals.map((p) => (
            <Link
              key={p.id}
              to={`/pandals/${p.id}`}
              className="block rounded-xl border border-stone-800 bg-stone-900/60 hover:border-amber-600/50 transition px-4 py-3"
            >
              <div className="font-medium text-sm">{p.name}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-stone-500">{p.locality}</span>
                <CrowdBadge level={p.crowd_level} />
              </div>
            </Link>
          ))}
        </aside>
      </div>
    </main>
  )
}
