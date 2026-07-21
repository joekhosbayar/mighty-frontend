import { useEffect, useState } from 'react'
import type { Game, GameConfig } from '../core/types'
import { getTableName } from '../core/names'
import { associateWebAuthnCredential, listWebAuthnCredentials } from 'aws-amplify/auth'

export interface LobbyScreenProps {
  games: Game[]
  username: string
  onCreate(config: GameConfig): void
  onJoin(gameId: string): void
  onRefresh(): void
  onLogout(): void
}

export function LobbyScreen({ games, username, onCreate, onJoin, onRefresh, onLogout }: LobbyScreenProps) {
  const [numPlayers, setNumPlayers] = useState(5)
  const [failDist, setFailDist] = useState<GameConfig['fail_dist']>('equal_split')
  const [allowJoker, setAllowJoker] = useState(true)
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null)
  const [hasPasskey, setHasPasskey] = useState(false)
  useEffect(() => {
    onRefresh()
    const timer = setInterval(onRefresh, 3000)
    listWebAuthnCredentials().then(res => {
      if (res.credentials?.length > 0) setHasPasskey(true)
    }).catch(() => {})
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
          {passkeyStatus && <span role="status" style={{ color: 'var(--color-accent)', fontSize: '0.85rem' }}>{passkeyStatus}</span>}
          {!hasPasskey && (
            <button 
              onClick={async () => {
                try {
                  setPasskeyStatus(null)
                  await associateWebAuthnCredential()
                  setPasskeyStatus('Passkey registered successfully')
                  setHasPasskey(true)
                } catch (e: unknown) {
                  setPasskeyStatus(`Failed to register passkey: ${e instanceof Error ? e.message : String(e)}`)
                }
              }} 
              style={{ background: 'transparent', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}
            >
              Register Passkey
            </button>
          )}
          <button onClick={onLogout}>Log out</button>
        </div>
      </header>

      <div className="table-content" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0 }}>Open Tables</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label>Players
            <select aria-label="players" value={numPlayers} onChange={e => setNumPlayers(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={4}>4</option>
            </select>
          </label>
          {numPlayers === 4 && (
            <>
              <label>Failure rule
                <select aria-label="failure rule" value={failDist} onChange={e => setFailDist(e.target.value as GameConfig['fail_dist'])}>
                  <option value="equal_split">Equal split</option>
                  <option value="declarer_alone">Declarer pays alone</option>
                  <option value="two_one_split">2x / 1x split</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={allowJoker} onChange={e => setAllowJoker(e.target.checked)} /> Allow joker partner
              </label>
            </>
          )}
          <button
            onClick={() => onCreate({ num_players: numPlayers, allow_joker_partner: numPlayers === 5 ? true : allowJoker, fail_dist: failDist })}
            style={{ background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}
          >
            Create Table
          </button>
        </div>
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
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{getTableName(g.id)}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    Created {new Date(g.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-accent)' }}>{`${g.players.filter(Boolean).length}/${g.config?.num_players ?? 5} seated`}</span>
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
