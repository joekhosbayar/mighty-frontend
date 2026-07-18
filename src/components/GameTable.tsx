import type { Card, Suit } from '../core/types'
import type { TableView } from '../core/view'
import type { ConnectionStatus } from '../api/ws'
import type { BidInput } from '../core/rules'
import { BidPanel } from './BidPanel'
import { ExchangePanel } from './ExchangePanel'
import { FriendCallPanel } from './FriendCallPanel'
import { Hand } from './Hand'
import { PlayArea } from './PlayArea'
import { ScoreBoard } from './ScoreBoard'

export interface GameTableProps {
  view: TableView
  connection: ConnectionStatus
  error: string | null
  onBid(bid: BidInput): void
  onPass(): void
  onDiscard(cards: Card[]): void
  onCallPartner(card: Card): void
  onNoFriend(): void
  onPlayCard(card: Card, callJoker: boolean, calledSuit?: Suit): void
  onLeave(): void
}

export function GameTable(props: GameTableProps) {
  const { view, connection, error } = props
  const seated = view.seats.filter(s => !s.isEmpty).length

  return (
    <main className="table" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="table-header">
        <div className="table-header-info">
          <span className="phase-title" style={{ margin: 0 }}>Mighty</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }} data-testid="game-id">Table {view.gameId.substring(0, 8)}</span>
          <span className="phase-tag" data-testid="phase">{view.phase}</span>
          {view.contract && (
            <span style={{ color: 'var(--color-accent)' }}>
              {`Contract ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
            </span>
          )}
        </div>
        <button onClick={props.onLeave}>Leave Table</button>
      </header>

      <div className="table-content">
        {connection !== 'open' && <p role="status">Reconnecting…</p>}
        {error && <p role="alert">{error}</p>}

      {view.phase === 'waiting' && (
        <div className="panel" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-accent)', marginBottom: '2rem' }}>Waiting for players ({seated}/5)</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {view.seats.map((seat, i) => (
              <li key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '1rem', 
                background: 'rgba(255, 255, 255, 0.03)', 
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <span style={{ 
                  color: seat.isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                  fontStyle: seat.isEmpty ? 'italic' : 'normal',
                  fontFamily: seat.isEmpty ? 'inherit' : 'var(--font-mono)'
                }}>
                  {seat.isEmpty ? `Seat ${i + 1} (Empty)` : seat.name}
                </span>
                {!seat.isEmpty && (
                  <span style={{ 
                    color: seat.isConnected ? 'var(--color-accent)' : 'var(--color-crimson)',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {seat.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.phase === 'bidding' && <BidPanel view={view} onBid={props.onBid} onPass={props.onPass} />}
      {view.phase === 'exchanging' && <ExchangePanel view={view} onDiscard={props.onDiscard} />}
      {view.phase === 'calling' && <FriendCallPanel view={view} onCallPartner={props.onCallPartner} onNoFriend={props.onNoFriend} />}
      {view.phase === 'playing' && <PlayArea view={view} onPlayCard={props.onPlayCard} />}
      {view.phase === 'finished' && <ScoreBoard view={view} />}

      {(view.phase === 'bidding' || view.phase === 'calling') && view.hand.length > 0 && (
          <Hand cards={view.hand} mode="play" onCard={() => undefined} />
        )}
      </div>
    </main>
  )
}
