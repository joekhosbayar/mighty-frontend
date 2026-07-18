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
    <main className="lobby" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="table-header">
        <div className="table-header-info">
          <span className="phase-title" style={{ margin: 0 }}>Mighty</span>
          <span className="phase-tag">Lobby</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>{username}</span>
          <button onClick={onLogout}>Log out</button>
        </div>
      </header>

      <div className="table-content" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0 }}>Open Tables</h2>
          <button onClick={onCreate} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}>Create Table</button>
        </div>
        
        {games.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '3rem 1rem' }}>
            No tables waiting — create one to start playing.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {games.map(g => (
              <li key={g.id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>Table {g.id.substring(0, 8)}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    Created {new Date(g.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-accent)' }}>{`${g.players.filter(Boolean).length}/5 seated`}</span>
                  <button onClick={() => onJoin(g.id)}>Join Table</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
