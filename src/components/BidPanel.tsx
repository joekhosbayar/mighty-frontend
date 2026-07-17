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
  const [points, setPoints] = useState(3)
  const candidate = (suit: Suit): BidInput => ({ points, suit, is_no_trump: suit === 'none' })

  return (
    <section className="bid-panel">
      <h2>Bidding</h2>
      <ol data-testid="bid-history">
        {view.bids.map((b, i) => (
          <li key={i}>{`${b.player_id}: ${b.points} ${b.is_no_trump ? 'no-trump' : b.suit}`}</li>
        ))}
      </ol>
      <label>
        Tricks
        <select value={points} onChange={e => setPoints(Number(e.target.value))}>
          {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      {SUIT_OPTIONS.map(({ suit, label }) => (
        <button
          key={suit}
          disabled={!view.isMyTurn || !isLegalBid(candidate(suit), view.currentBid)}
          onClick={() => onBid(candidate(suit))}
        >
          {`${label} ${points}`}
        </button>
      ))}
      <button disabled={!view.isMyTurn} onClick={onPass}>Pass</button>
    </section>
  )
}
