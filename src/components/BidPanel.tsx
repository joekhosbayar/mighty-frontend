import { useState } from 'react'
import type { Suit } from '../core/types'
import type { TableView } from '../core/view'
import { isLegalBid, type BidInput } from '../core/rules'

export interface BidPanelProps {
  view: TableView
  onBid(bid: BidInput): void
  onPass(): void
}

const SUIT_OPTIONS: { suit: Suit; label: string }[] = [
  { suit: 'clubs', label: '♣' },
  { suit: 'diamonds', label: '♦' },
  { suit: 'hearts', label: '♥' },
  { suit: 'spades', label: '♠' },
  { suit: 'none', label: 'NT' },
]

export function BidPanel({ view, onBid, onPass }: BidPanelProps) {
  const minBid = view.config?.num_players === 4 ? 14 : 13
  const [points, setPoints] = useState(minBid)
  const candidate = (suit: Suit): BidInput => ({ points, suit, is_no_trump: suit === 'none' })

  return (
    <section className="bid-panel panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>Bidding</h2>
      <ol data-testid="bid-history" style={{ listStyle: 'none', padding: 0, margin: '1rem 0', fontFamily: 'var(--font-mono)' }}>
        {view.bids.map((b, i) => (
          <li key={i}>{`${b.player_id}: ${b.points} ${b.is_no_trump ? 'no-trump' : b.suit}`}</li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
          Tricks:
          <select value={points} onChange={e => setPoints(Number(e.target.value))}>
            {Array.from({ length: 20 - minBid + 1 }, (_, i) => i + minBid).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SUIT_OPTIONS.map(({ suit, label }) => (
            <button
              key={suit}
              disabled={!view.isMyTurn || !isLegalBid(candidate(suit), view.currentBid, minBid)}
              onClick={() => onBid(candidate(suit))}
              style={{ minWidth: '4rem' }}
            >
              <span style={suit === 'hearts' || suit === 'diamonds' ? { color: 'var(--color-crimson)' } : undefined}>{label}</span> {points}
            </button>
          ))}
          <button disabled={!view.isMyTurn} onClick={onPass} style={{ background: 'transparent' }}>Pass</button>
        </div>
      </div>
    </section>
  )
}
