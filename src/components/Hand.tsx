import type { Card, Suit } from '../core/types'
import type { HandCard } from '../core/view'
import { sameCard } from '../core/cards'
import { PhysicalCard } from './PhysicalCard'

export interface HandProps {
  cards: HandCard[]
  mode: 'play' | 'select'
  trump: Suit
  selected?: Card[]
  onCard(card: Card): void
}

export function Hand({ cards, mode, trump, selected = [], onCard }: HandProps) {
  const isSelected = (card: Card) => selected.some(s => sameCard(s, card))
  return (
    <div className="hand-container" data-testid="hand">
      {cards.map(({ card, playable }) => {
        const isSel = mode === 'select' && isSelected(card)
        return (
          <button
            key={`${card.suit}-${card.rank}`}
            className="hand-card-btn"
            data-testid={`hand-card-${card.suit}-${card.rank}`}
            disabled={mode === 'play' && !playable}
            aria-pressed={isSel ? 'true' : undefined}
            onClick={() => onCard(card)}
            style={isSel ? { transform: 'translateY(-15px)' } : undefined}
          >
            <PhysicalCard card={card} trump={trump} />
          </button>
        )
      })}
    </div>
  )
}
