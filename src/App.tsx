import { AuthScreen } from './components/AuthScreen'
import { LobbyScreen } from './components/LobbyScreen'
import { useApp } from './store'

export function App() {
  const screen = useApp(s => s.screen)
  const lastError = useApp(s => s.lastError)
  const login = useApp(s => s.login)
  const signup = useApp(s => s.signup)
  const username = useApp(s => s.username)
  const lobbyGames = useApp(s => s.lobbyGames)
  const refreshLobby = useApp(s => s.refreshLobby)
  const createGame = useApp(s => s.createGame)
  const joinGame = useApp(s => s.joinGame)
  const logout = useApp(s => s.logout)

  if (screen.name === 'auth') {
    return <AuthScreen error={lastError} onLogin={login} onSignup={signup} />
  }
  if (screen.name === 'lobby') {
    return (
      <LobbyScreen
        games={lobbyGames}
        username={username ?? ''}
        onCreate={createGame}
        onJoin={joinGame}
        onRefresh={refreshLobby}
        onLogout={logout}
      />
    )
  }
  return <p>Table</p>
}

export default App
