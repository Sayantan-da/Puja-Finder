import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { goNearMe } from '../utils/geo'

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-red-600 to-rose-700',
    'from-amber-500 to-red-600',
    'from-red-700 to-orange-700',
    'from-rose-500 to-red-700',
    'from-orange-500 to-red-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
      isActive
        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-sm shadow-red-500/20'
        : 'text-stone-700 font-medium hover:text-red-600 hover:bg-red-50/80'
    }`

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [dropdownOpen])

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md transition-colors"
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        borderBottom: '1px solid rgba(220, 38, 38, 0.15)',
        boxShadow: '0 4px 20px rgba(211, 16, 39, 0.05)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2">
        {/* Logo with Bengali Durga Motif */}
        <Link to="/" className="flex items-center gap-2.5 mr-3 group shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white text-lg shadow-sm group-hover:scale-105 transition-transform">
            🔱
          </div>
          <div className="flex flex-col">
            <span
              className="text-xl font-black brand-text tracking-tight leading-none"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              PujaFinder
            </span>
            <span className="text-[10px] font-bangla font-semibold text-red-600 tracking-wider">
              শারদোৎসব ২০২৬ ✦
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto py-1 scrollbar-none">
          <NavLink className={navLinkClass} to="/" end>
            <span>🏛️</span> Pandals
          </NavLink>
          <NavLink className={navLinkClass} to="/planner">
            <span>🧭</span> Route Planner
          </NavLink>
          <NavLink className={navLinkClass} to="/transit">
            <span>🚇</span> Transit &amp; Metro
          </NavLink>
          <NavLink className={navLinkClass} to="/map">
            <span>🗺️</span> Map
          </NavLink>
          <NavLink className={navLinkClass} to="/group-trip">
            <span>👥</span> Group Trip
          </NavLink>
          <NavLink className={navLinkClass} to="/moments">
            <span>📸</span> Moments
          </NavLink>
          <NavLink className={({ isActive }) => `${navLinkClass({ isActive })} hidden md:inline-flex`} to="/about">
            <span>📖</span> About Pujo
          </NavLink>
          <button
            className="px-3 py-1.5 rounded-xl text-sm font-medium text-stone-700 hover:text-red-600 hover:bg-red-50/80 transition-all duration-200 hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            onClick={() => goNearMe(navigate)}
            title="Find pandals near my location"
          >
            <span>📍</span> Near me
          </button>
        </nav>

        {/* Auth section */}
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-full p-0.5 transition-all hover:ring-2 hover:ring-red-400"
              title={user.name}
            >
              <div
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(user.name)} flex items-center justify-center text-xs font-bold text-white shadow-md`}
              >
                {getInitials(user.name)}
              </div>
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden animate-[fadeIn_0.15s_ease-out] bg-white border border-red-100 shadow-2xl z-50"
              >
                {/* User info header */}
                <div className="px-4 py-3 bg-red-50/50 border-b border-red-100">
                  <p className="font-bold text-sm truncate text-stone-800">{user.name}</p>
                  <p className="text-xs truncate text-stone-500">{user.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-red-50 hover:text-red-700 transition"
                  >
                    <span>👤</span> Profile
                  </Link>
                  <Link
                    to="/favorites"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-red-50 hover:text-red-700 transition"
                  >
                    <span>★</span> Favourites
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link
                      to="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 font-medium transition"
                    >
                      <span>🛡️</span> Admin Panel
                    </Link>
                  )}
                </div>

                {/* Logout */}
                <div className="py-1 border-t border-red-100">
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      logout()
                      navigate('/')
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition font-medium"
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              className="px-3 py-1.5 text-sm font-semibold rounded-lg text-stone-700 hover:text-red-600 hover:bg-red-50 transition"
              to="/login"
            >
              Login
            </Link>
            <Link
              className="px-4 py-2 text-sm rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:scale-102"
              style={{
                background: 'linear-gradient(135deg, #D31027 0%, #EF4444 100%)',
                boxShadow: '0 4px 14px rgba(211, 16, 39, 0.3)',
              }}
              to="/register"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>

      {/* Traditional red & gold line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-40" />
    </header>
  )
}
