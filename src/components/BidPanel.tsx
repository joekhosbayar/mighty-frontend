import { useState, useEffect } from 'react'
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
  const minBid = view.config?.num_players === 4 ? 4 : 3
  
  // Calculate next logical bid ceiling at 10
  const highestCurrentPoints = view.currentBid ? view.currentBid.points : (minBid - 1);
  const startingPoints = Math.min(10, Math.max(minBid, highestCurrentPoints + 1));
  
  // Use state but initialize with the calculated starting points, and add effect to sync
  const [points, setPoints] = useState(startingPoints)
  
  // Track new bids for pop-up toasts
  const [toast, setToast] = useState<{ id: number, text: string } | null>(null)
  
  useEffect(() => {
    setPoints(startingPoints);
  }, [startingPoints]);

  useEffect(() => {
    if (view.bids.length > 0) {
      const latestBid = view.bids[view.bids.length - 1];
      const player = view.seats.find(s => s.playerId === latestBid.player_id);
      const text = `${player?.name ?? latestBid.player_id} bid ${latestBid.points} ${latestBid.is_no_trump ? 'NT' : latestBid.suit}`;
      const id = Date.now();
      setToast({ id, text });
      
      const timer = setTimeout(() => {
        setToast(current => current?.id === id ? null : current);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [view.bids.length, view.bids, view.seats]);

  const candidate = (suit: Suit): BidInput => ({ points, suit, is_no_trump: suit === 'none' })

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-glass-border)',
          color: 'var(--color-accent)',
          padding: '1rem 2rem',
          borderRadius: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          fontFamily: 'var(--font-mono)',
          fontWeight: 'bold',
          fontSize: '1.2rem',
          animation: 'slideInDown 0.3s ease-out'
        }}>
          {toast.text}
        </div>
      )}
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
            {Array.from({ length: 10 - minBid + 1 }, (_, i) => i + minBid).map(n => (
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
    </>
  )
}
