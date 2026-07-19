import { useState } from 'react'
import type { Card, Rank, Suit } from '../core/types'
import type { TableView } from '../core/view'
import { SlotWheel } from './SlotWheel'

export interface FriendCallPanelProps {
  view: TableView
  onCallPartner(card: Card): void
  onNoFriend(): void
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs', 'none']
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

export function FriendCallPanel({ view, onCallPartner, onNoFriend }: FriendCallPanelProps) {
  const [suit, setSuit] = useState<Suit>('hearts')
  const [rank, setRank] = useState<Rank>('A')

  if (!view.amDeclarer) {
    return <p className="panel" style={{ textAlign: 'center', margin: '2rem auto', maxWidth: '400px', color: 'var(--color-text-secondary)' }}>Waiting for the declarer to call a friend…</p>
  }

  const isJoker = suit === 'none';

  return (
    <section className="friend-call panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>Call your friend</h2>
      <div style={{ display: 'flex', gap: '2rem', margin: '2rem 0', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span className="label">Suit</span>
          <SlotWheel options={SUITS} value={suit} onChange={setSuit} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span className="label">Rank</span>
          <SlotWheel options={RANKS} value={rank} onChange={setRank} disabled={isJoker} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onCallPartner(isJoker ? { suit: 'none', rank: 'Joker' } : { suit, rank })} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>
          {isJoker ? 'Call Joker' : `Call ${rank} of ${suit}`}
        </button>
        <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
        <button onClick={onNoFriend} style={{ background: 'transparent' }}>Play alone (no friend, 2× score)</button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '1rem', textAlign: 'center' }}>Calling a card from your own hand means you play alone.</p>
    </section>
  )
}
