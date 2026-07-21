import { useState } from 'react'
import type { Card, Rank, Suit } from '../core/types'
import type { TableView, HandCard } from '../core/view'
import { SlotWheel } from './SlotWheel'
import { PhysicalCard } from './PhysicalCard'

import { mightyCard, sameCard } from '../core/cards'

export interface FriendCallPanelProps {
  view: TableView
  onCallPartner(card: Card): void
  onNoFriend(): void
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs', 'none']
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

function formatSuit(s: Suit): React.ReactNode {
  if (s === 'none') return 'Joker'
  if (s === 'spades') return <span className="suit-spades">♠ Spades</span>
  if (s === 'hearts') return <span className="suit-hearts">♥ Hearts</span>
  if (s === 'diamonds') return <span className="suit-diamonds">♦ Diamonds</span>
  if (s === 'clubs') return <span className="suit-clubs">♣ Clubs</span>
  return s
}

function getRecommendedFriend(view: TableView): Card | null {
  const trump = view.contract?.suit || 'none'
  const hand = view.hand || []
  const hasCard = (c: Card) => hand.some((hc: HandCard) => sameCard(hc.card, c))

  const mighty = mightyCard(trump)
  if (!hasCard(mighty)) return mighty

  const joker: Card = { suit: 'none', rank: 'Joker' }
  if (!hasCard(joker)) return joker

  if (trump !== 'none') {
    for (const r of RANKS) {
      const c: Card = { suit: trump, rank: r }
      if (!hasCard(c)) return c
    }
  }

  for (const r of RANKS) {
    for (const s of SUITS) {
      if (s === 'none' || s === trump) continue
      const c: Card = { suit: s, rank: r }
      if (!hasCard(c)) return c
    }
  }
  return null
}

export function FriendCallPanel({ view, onCallPartner, onNoFriend }: FriendCallPanelProps) {
  const [suit, setSuit] = useState<Suit>(() => {
    if (view.amDeclarer) {
      const rec = getRecommendedFriend(view)
      if (rec) return rec.suit
    }
    return 'hearts'
  })
  const [rank, setRank] = useState<Rank>(() => {
    if (view.amDeclarer) {
      const rec = getRecommendedFriend(view)
      if (rec) return rec.rank
    }
    return 'A'
  })

  if (!view.amDeclarer) {
    return <p className="panel" style={{ textAlign: 'center', margin: '2rem auto', maxWidth: '400px', color: 'var(--color-text-secondary)' }}>Waiting for the declarer to call a friend…</p>
  }

  const isJoker = suit === 'none';
  const previewCard: Card = isJoker ? { suit: 'none', rank: 'Joker' } : { suit, rank };
  const trump = view.contract?.suit || 'none';

  return (
    <section className="friend-call panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>Call your friend</h2>
      <div style={{ display: 'flex', gap: '3rem', margin: '2rem 0', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Wheels */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span className="label" id="suit-label">Suit</span>
            <SlotWheel options={SUITS} value={suit} onChange={setSuit} formatOption={formatSuit} aria-label="Suit" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span className="label" id="rank-label">Rank</span>
            <SlotWheel options={RANKS} value={rank} onChange={setRank} disabled={isJoker} aria-label="Rank" />
          </div>
        </div>

        {/* Card Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--color-glass)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>PREVIEW</span>
          <PhysicalCard card={previewCard} trump={trump} />
        </div>

      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onCallPartner(previewCard)} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>
          {isJoker ? 'Call Joker' : `Call ${rank} of ${suit}`}
        </button>
        <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
        <button onClick={onNoFriend} style={{ background: 'transparent' }}>Play alone (no friend, 2× score)</button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '1rem', textAlign: 'center' }}>Calling a card from your own hand means you play alone.</p>
    </section>
  )
}
