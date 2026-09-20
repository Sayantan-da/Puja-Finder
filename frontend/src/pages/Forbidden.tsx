import { Link } from 'react-router-dom'

export default function Forbidden() {
  return (
    <main className="max-w-md mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">🚫</p>
      <h1 className="text-2xl font-bold">403 — Forbidden</h1>
      <p className="text-stone-400 mt-2 mb-6">You need ADMIN access to view this page.</p>
      <Link to="/" className="rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold px-5 py-2.5 inline-block transition">
        Back to home
      </Link>
    </main>
  )
}
