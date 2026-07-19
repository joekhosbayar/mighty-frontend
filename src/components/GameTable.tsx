import { useState, useEffect, useRef } from 'react'
import type { Card, Suit } from '../core/types'
import type { TableView } from '../core/view'
import { getTableName } from '../core/names'
import type { ConnectionStatus } from '../api/ws'
import type { BidInput } from '../core/rules'
import { BidPanel } from './BidPanel'
import { ExchangePanel } from './ExchangePanel'
import { FriendCallPanel } from './FriendCallPanel'
import { Hand } from './Hand'
import { PlayArea } from './PlayArea'
import { ScoreBoard } from './ScoreBoard'
import { TurnTimer } from './TurnTimer'

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
  onPlayAgain?: () => void
  onChangeConfig?: (numPlayers: number) => void
}

export function GameTable(props: GameTableProps) {
  const { view, connection, error } = props
  const seated = view.seats.filter(s => !s.isEmpty).length
  
  // Show timer only when it's an active phase requiring input
  const showTimer = ['bidding', 'exchanging', 'calling', 'playing'].includes(view.phase)

  // Track bids for toast notification
  const [toasts, setToasts] = useState<{ id: number, text: string }[]>([])
  const prevBidsLen = useRef(view.bids.length)

  useEffect(() => {
    if (view.bids.length > prevBidsLen.current) {
      const newBids = view.bids.slice(prevBidsLen.current)
      
      const newToasts = newBids.map((bid, idx) => {
        const player = view.seats.find(s => s.playerId === bid.player_id)
        const isPass = bid.points === 0
        const text = isPass 
          ? `${player?.name ?? bid.player_id} passed`
          : `${player?.name ?? bid.player_id} bid ${bid.points} ${bid.is_no_trump ? 'NT' : bid.suit}`
        return { id: Date.now() + idx, text }
      })

      setToasts(prev => [...prev, ...newToasts])
      
      newToasts.forEach(t => {
        setTimeout(() => {
          setToasts(prev => prev.filter(toast => toast.id !== t.id))
        }, 3000)
      })
    }
    prevBidsLen.current = view.bids.length
  }, [view.bids, view.seats])

  return (
    <main className="table" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-glass-border)',
            color: 'var(--color-accent)',
            padding: '0.75rem 1.5rem',
            borderRadius: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            animation: 'slideInDown 0.3s ease-out',
            whiteSpace: 'nowrap'
          }}>
            {toast.text}
          </div>
        ))}
      </div>
      <header className="table-header">
        <div className="table-header-info">
          <span className="phase-title" style={{ margin: 0 }}>Mighty</span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }} data-testid="game-id">{getTableName(view.gameId)}</span>
          <span className="phase-tag" data-testid="phase">{view.phase}</span>
          {view.contract && (
            <span style={{ color: 'var(--color-accent)' }}>
              {`Contract ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {showTimer && <TurnTimer updatedAt={view.updatedAt} />}
          <button onClick={props.onLeave}>Leave Table</button>
        </div>
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
      {view.phase === 'finished' && <ScoreBoard view={view} onPlayAgain={props.onPlayAgain} onChangeConfig={props.onChangeConfig} />}

      {(view.phase === 'bidding' || view.phase === 'calling') && view.hand.length > 0 && (
          <Hand cards={view.hand} mode="play" trump={view.trump} onCard={() => undefined} />
        )}
      </div>
    </main>
  )
}
