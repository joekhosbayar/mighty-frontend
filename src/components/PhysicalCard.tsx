import type { Card } from '../core/types'

export interface PhysicalCardProps {
  card: Card
}

const suitSymbols: Record<Card['suit'], string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  none: '',
}

export function PhysicalCard({ card }: PhysicalCardProps) {
  const isJoker = card.rank === 'Joker'
  const isMighty = card.suit === 'spades' && card.rank === 'A'
  
  let label = isJoker ? 'J' : card.rank
  let suit = isJoker ? 'kr' : suitSymbols[card.suit]
  let suitClass = isJoker ? 'suit-joker' : `suit-${card.suit}`
  
  return (
    <div className={`card-physical ${suitClass}`} style={isMighty || isJoker ? { border: '2px solid var(--color-accent)' } : undefined}>
      <div className="card-rank">{label}</div>
      <div className="card-suit">{suit}</div>
      <div className="card-watermark">{suit}</div>
    </div>
  )
}
