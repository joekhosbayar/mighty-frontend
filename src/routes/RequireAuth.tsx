import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useApp } from '../store/context'

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useApp(s => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/" state={{ from: location }} replace />
  return <>{children}</>
}
