import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0b]">
      <header className="sticky top-0 z-40 border-b border-stone-800/80 bg-stone-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm">
              🛠️
            </div>
            <span className="font-bold text-stone-100 text-sm hidden sm:inline">PujaFinder Admin</span>
          </Link>
          <div className="h-5 w-px bg-stone-800 hidden sm:block" />
          <Link
            to="/"
            className="text-xs text-stone-500 hover:text-stone-200 transition flex items-center gap-1"
          >
            ← Public site
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-stone-200">{user?.name}</p>
              <p className="text-[10px] text-stone-500">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-stone-950 shrink-0">
              {(user?.name ?? 'A').charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs rounded-lg border border-stone-700 hover:bg-stone-800 text-stone-300 transition font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
