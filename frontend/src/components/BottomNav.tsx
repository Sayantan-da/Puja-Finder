import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { goNearMe } from '../utils/geo'

const item =
  'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-all duration-200'
const active = 'text-[#D31027] font-bold'
const inactive = 'text-stone-500 hover:text-red-700'

export default function BottomNav() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [locating, setLocating] = useState(false)

  async function onNearMe() {
    setLocating(true)
    await goNearMe(navigate)
    setLocating(false)
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 sm:hidden grid grid-cols-6 backdrop-blur-md bg-white/95"
      style={{
        borderTop: '1px solid rgba(220, 38, 38, 0.18)',
        boxShadow: '0 -4px 20px rgba(211, 16, 39, 0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <NavLink to="/" end className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
        <span className="text-lg leading-none">🏛️</span> Pandals
      </NavLink>
      <NavLink to="/transit" className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
        <span className="text-lg leading-none">🚇</span> Transit
      </NavLink>
      <NavLink to="/planner" className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
        <span className="text-lg leading-none">🧭</span> Planner
      </NavLink>
      <NavLink to="/map" className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
        <span className="text-lg leading-none">🗺️</span> Map
      </NavLink>
      <button onClick={onNearMe} className={`${item} ${inactive}`} aria-label="Find pandals near me">
        <span className="text-lg leading-none">{locating ? '📡' : '📍'}</span>
        {locating ? 'Locating…' : 'Near me'}
      </button>
      {user ? (
        <NavLink to="/profile" className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
          <span className="text-lg leading-none">👤</span> Profile
        </NavLink>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
          <span className="text-lg leading-none">🔐</span> Login
        </NavLink>
      )}
    </nav>
  )
}
