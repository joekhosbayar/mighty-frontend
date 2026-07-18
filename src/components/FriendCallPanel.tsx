import { useState } from 'react'
import type { Card, Rank, Suit } from '../core/types'
import type { TableView } from '../core/view'

export interface FriendCallPanelProps {
  view: TableView
  onCallPartner(card: Card): void
  onNoFriend(): void
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

export function FriendCallPanel({ view, onCallPartner, onNoFriend }: FriendCallPanelProps) {
  const [suit, setSuit] = useState<Suit>('hearts')
  const [rank, setRank] = useState<Rank>('A')

  if (!view.amDeclarer) {
    return <p className="panel" style={{ textAlign: 'center', margin: '2rem auto', maxWidth: '400px', color: 'var(--color-text-secondary)' }}>Waiting for the declarer to call a friend…</p>
  }

  return (
    <section className="friend-call panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>Call your friend</h2>
      <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
          Suit
          <select value={suit} onChange={e => setSuit(e.target.value as Suit)}>
            {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
          Rank
          <select value={rank} onChange={e => setRank(e.target.value as Rank)}>
            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
        <button onClick={() => onCallPartner({ suit, rank })} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>Call {rank} of {suit}</button>
        <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
        <button onClick={onNoFriend} style={{ background: 'transparent' }}>Play alone (no friend, 2× score)</button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>Calling a card from your own hand means you play alone.</p>
    </section>
  )
}
