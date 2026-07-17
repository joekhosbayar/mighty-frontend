import { AuthScreen } from './components/AuthScreen'
import { useApp } from './store'

export function App() {
  const screen = useApp(s => s.screen)
  const lastError = useApp(s => s.lastError)
  const login = useApp(s => s.login)
  const signup = useApp(s => s.signup)

  if (screen.name === 'auth') {
    return <AuthScreen error={lastError} onLogin={login} onSignup={signup} />
  }
  if (screen.name === 'lobby') {
    return <p>Lobby</p>
  }
  return <p>Table</p>
}

export default App
