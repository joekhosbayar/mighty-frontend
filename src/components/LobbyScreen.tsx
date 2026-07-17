import { useEffect } from 'react'
import type { Game } from '../core/types'

export interface LobbyScreenProps {
  games: Game[]
  username: string
  onCreate(): void
  onJoin(gameId: string): void
  onRefresh(): void
  onLogout(): void
}

export function LobbyScreen({ games, username, onCreate, onJoin, onRefresh, onLogout }: LobbyScreenProps) {
  useEffect(() => {
    onRefresh()
    const timer = setInterval(onRefresh, 3000)
    return () => clearInterval(timer)
  }, [onRefresh])

  return (
    <main className="lobby">
      <header>
        <h1>Lobby</h1>
        <span>{username}</span>
        <button onClick={onLogout}>Log out</button>
      </header>
      <button onClick={onCreate}>Create game</button>
      {games.length === 0 ? (
        <p>No games waiting — create one.</p>
      ) : (
        <ul>
          {games.map(g => (
            <li key={g.id}>
              <span>{g.id}</span>
              <span>{`${g.players.filter(Boolean).length}/5`}</span>
              <button onClick={() => onJoin(g.id)}>Join</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
