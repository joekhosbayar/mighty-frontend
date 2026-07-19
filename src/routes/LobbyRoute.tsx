import { useNavigate } from 'react-router'
import { LobbyScreen } from '../components/LobbyScreen'
import { useApp } from '../store/context'

export function LobbyRoute() {
  const games = useApp(s => s.lobbyGames)
  const username = useApp(s => s.username)
  const refreshLobby = useApp(s => s.refreshLobby)
  const createGame = useApp(s => s.createGame)
  const joinGame = useApp(s => s.joinGame)
  const logout = useApp(s => s.logout)
  const navigate = useNavigate()

  return (
    <LobbyScreen
      games={games}
      username={username ?? ''}
      onRefresh={refreshLobby}
      onCreate={async () => {
        const id = await createGame()
        if (id) navigate(`/games/${id}`)
      }}
      onJoin={async id => {
        if (await joinGame(id)) navigate(`/games/${id}`)
      }}
      onLogout={logout}
    />
  )
}
