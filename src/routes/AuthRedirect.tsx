import { Navigate } from 'react-router'
import { useApp } from '../store/context'

export function AuthRedirect() {
  const token = useApp(s => s.token)
  return <Navigate to={token ? '/lobby' : '/login'} replace />
}
