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
    return <p className="panel" style={{ textAlign: 'center', margin: '2rem auto', maxWidth: '400px', color: 'var(--color-text-secondary)' }}>Waiting for the declarer to exchange with the kitty…</p>
  }

  const toggle = (card: Card) =>
    setSelected(sel => {
      const without = sel.filter(s => !sameCard(s, card))
      return without.length < sel.length ? without : [...sel, card]
    })

  const handCards = view.hand.map(h => h.card)

  return (
    <section className="exchange panel" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>Discard exactly 3 cards</h2>
      <Hand cards={view.hand} mode="select" trump={view.trump} selected={selected} onCard={toggle} />
      <div style={{ marginTop: '1.5rem' }}>
        <button
          disabled={!isValidDiscard(handCards, selected)}
          onClick={() => onDiscard(selected)}
          style={{ background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}
        >
          {`Discard ${selected.length}/3`}
        </button>
      </div>
    </section>
  )
}
