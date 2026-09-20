import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import BottomNav from './components/BottomNav'
import Navbar from './components/Navbar'
import AdminRoute from './components/auth/AdminRoute'
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AboutPage from './pages/AboutPage'
import FavoritesPage from './pages/FavoritesPage'
import Forbidden from './pages/Forbidden'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import MomentsPage from './pages/MomentsPage'
import PandalDetailPage from './pages/PandalDetailPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import RoutePlannerPage from './pages/RoutePlannerPage'
import TransitHubPage from './pages/TransitHubPage'
import GroupTripPage from './pages/GroupTripPage'

export default function App() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen flex flex-col text-stone-900 bg-[#FFFDF9] selection:bg-red-500 selection:text-white">
      {!isAdminRoute && <Navbar />}
      <div className="flex-1 pb-16 sm:pb-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/planner" element={<RoutePlannerPage />} />
          <Route path="/routes" element={<RoutePlannerPage />} />
          <Route path="/transit" element={<TransitHubPage />} />
          <Route path="/metro" element={<TransitHubPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/group-trip" element={<GroupTripPage />} />
          <Route path="/pandals/:id" element={<PandalDetailPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/moments" element={<MomentsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/forbidden" element={<Forbidden />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isAdminRoute && <BottomNav />}
    </div>
  )
}
