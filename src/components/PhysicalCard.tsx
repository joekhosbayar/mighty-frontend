import type { Card, Suit } from '../core/types'
import { isMighty } from '../core/cards'

export interface PhysicalCardProps {
  card: Card
  trump: Suit
}

const suitSymbols: Record<Card['suit'], string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  none: '',
}

export function PhysicalCard({ card, trump }: PhysicalCardProps) {
  const isJoker = card.rank === 'Joker'
  const isMightyCard = isMighty(card, trump)

  let label = isJoker ? 'J' : card.rank
  let suit = isJoker ? 'kr' : suitSymbols[card.suit]
  let suitClass = isJoker ? 'suit-joker' : `suit-${card.suit}`

  return (
    <div className={`card-physical ${suitClass}`} style={isMightyCard || isJoker ? { border: '2px solid var(--color-accent)' } : undefined}>
      <div className="card-rank">{label}</div>
      <div className="card-suit">{suit}</div>
      <div className="card-watermark">{suit}</div>
    </div>
  )
}
