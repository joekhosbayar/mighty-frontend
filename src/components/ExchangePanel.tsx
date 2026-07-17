import { useState } from 'react'
import type { Card } from '../core/types'
import type { TableView } from '../core/view'
import { sameCard } from '../core/cards'
import { isValidDiscard } from '../core/rules'
import { Hand } from './Hand'

export interface ExchangePanelProps {
  view: TableView
  onDiscard(cards: Card[]): void
}

export function ExchangePanel({ view, onDiscard }: ExchangePanelProps) {
  const [selected, setSelected] = useState<Card[]>([])

  if (!view.amDeclarer) {
    return <p>Waiting for the declarer to exchange with the kitty…</p>
  }

  const toggle = (card: Card) =>
    setSelected(sel => {
      const without = sel.filter(s => !sameCard(s, card))
      return without.length < sel.length ? without : [...sel, card]
    })

  const handCards = view.hand.map(h => h.card)

  return (
    <section className="exchange">
      <h2>Discard exactly 3 cards</h2>
      <Hand cards={view.hand} mode="select" selected={selected} onCard={toggle} />
      <button
        disabled={!isValidDiscard(handCards, selected)}
        onClick={() => onDiscard(selected)}
      >
        {`Discard ${selected.length}/3`}
      </button>
    </section>
  )
}
