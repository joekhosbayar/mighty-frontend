import { Navigate, useLocation, useNavigate } from 'react-router'
import { AuthScreen } from '../components/AuthScreen'
import { useApp } from '../store/context'

export function LoginRoute() {
  const token = useApp(s => s.token)
  const lastError = useApp(s => s.lastError)
  const login = useApp(s => s.login)
  const signup = useApp(s => s.signup)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/lobby'

  if (token) return <Navigate to={from} replace />

  return (
    <AuthScreen
      error={lastError}
      onLogin={async (u, p) => {
        const res = await login(u, p)
        if (res === true) {
          navigate(from, { replace: true })
        }
        return res
      }}
      onLoginSuccess={async () => {
        await useApp.getState().initSession()
        if (useApp.getState().token) {
          navigate(from, { replace: true })
        }
      }}
      onSignup={async (u, p, e) => {
        return await signup(u, p, e)
      }}
    />
  )
}
