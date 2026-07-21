import { Navigate, useLocation, useNavigate } from 'react-router'
import { AuthScreen } from '../components/AuthScreen'
import { useApp, useAppStore } from '../store/context'

export function LoginRoute() {
  const token = useApp(s => s.token)
  const lastError = useApp(s => s.lastError)
  const login = useApp(s => s.login)
  const signup = useApp(s => s.signup)
  const store = useAppStore()
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
        // login() already populated the store on the direct-DONE path; only the
        // confirmSignIn/MFA completion path leaves the token unset and needs a fetch.
        if (!store.getState().token) {
          await store.getState().initSession()
        }
        if (store.getState().token) {
          navigate(from, { replace: true })
        }
      }}
      onSignup={async (u, p, e) => {
        return await signup(u, p, e)
      }}
    />
  )
}
