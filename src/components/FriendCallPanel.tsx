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
    return <p>Waiting for the declarer to call a friend…</p>
  }

  return (
    <section className="friend-call">
      <h2>Call your friend</h2>
      <label>
        Suit
        <select value={suit} onChange={e => setSuit(e.target.value as Suit)}>
          {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>
        Rank
        <select value={rank} onChange={e => setRank(e.target.value as Rank)}>
          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <button onClick={() => onCallPartner({ suit, rank })}>Call</button>
      <button onClick={onNoFriend}>Play alone (no friend, 2× score)</button>
      <p>Calling a card from your own hand means you play alone (no friend, doubled score).</p>
    </section>
  )
}
