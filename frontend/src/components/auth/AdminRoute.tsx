import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'ADMIN') {
    return <Navigate to="/forbidden" replace />
  }
  return <>{children}</>
}
