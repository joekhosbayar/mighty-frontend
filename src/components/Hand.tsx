import type { Card } from '../core/types'
import type { HandCard } from '../core/view'
import { cardLabel, sameCard } from '../core/cards'

export interface HandProps {
  cards: HandCard[]
  mode: 'play' | 'select'
  selected?: Card[]
  onCard(card: Card): void
}

export function Hand({ cards, mode, selected = [], onCard }: HandProps) {
  const isSelected = (card: Card) => selected.some(s => sameCard(s, card))
  return (
    <div className="hand" data-testid="hand">
      {cards.map(({ card, playable }) => (
        <button
          key={`${card.suit}-${card.rank}`}
          data-testid={`hand-card-${card.suit}-${card.rank}`}
          disabled={mode === 'play' && !playable}
          aria-pressed={mode === 'select' ? isSelected(card) : undefined}
          onClick={() => onCard(card)}
        >
          {cardLabel(card)}
        </button>
      ))}
    </div>
  )
}
