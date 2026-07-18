import { useState } from 'react'
import type { Card, Suit } from '../core/types'
import type { TableView } from '../core/view'
import { cardLabel, sameCard } from '../core/cards'
import { Hand } from './Hand'

export interface PlayAreaProps {
  view: TableView
  onPlayCard(card: Card, callJoker: boolean, calledSuit?: Suit): void
}

const LEAD_SUITS: { suit: Suit; label: string }[] = [
  { suit: 'clubs', label: '♣' },
  { suit: 'diamonds', label: '♦' },
  { suit: 'hearts', label: '♥' },
  { suit: 'spades', label: '♠' },
]

export function PlayArea({ view, onPlayCard }: PlayAreaProps) {
  const [pendingCaller, setPendingCaller] = useState<Card | null>(null)
  const [pendingJoker, setPendingJoker] = useState<Card | null>(null)
  const played = new Map(view.currentTrick.map(pc => [pc.seat, pc.card]))

  const handleCard = (card: Card) => {
    if (view.jokerLeadCard && sameCard(card, view.jokerLeadCard)) setPendingJoker(card)
    else if (view.jokerCallCard && sameCard(card, view.jokerCallCard)) setPendingCaller(card)
    else onPlayCard(card, false)
  }

  const resolveCall = (callJoker: boolean) => {
    if (pendingCaller) onPlayCard(pendingCaller, callJoker)
    setPendingCaller(null)
  }

  const resolveJokerLead = (suit: Suit) => {
    if (pendingJoker) onPlayCard(pendingJoker, false, suit)
    setPendingJoker(null)
  }

  return (
    <section className="play-area">
      <ul className="seats">
        {view.seats.map(s => {
          const trickCard = played.get(s.seat)
          return (
            <li key={s.seat} data-testid={`seat-${s.seat}`} className={s.isTurn ? 'turn' : ''}>
              <span>
                {s.name ?? 'empty'}
                {s.isMe ? ' (you)' : ''}
                {s.isDeclarer ? ' — declarer' : ''}
                {s.isPartner ? ' — partner' : ''}
              </span>
              <span data-testid={`trick-card-${s.seat}`}>
                {trickCard ? cardLabel(trickCard) : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <Hand cards={view.hand} mode="play" onCard={handleCard} />
      {pendingCaller && (
        <div role="dialog" aria-label="Call the Joker?">
          <p>Lead the Joker Caller — force the Joker out?</p>
          <button onClick={() => resolveCall(true)}>Call the Joker</button>
          <button onClick={() => resolveCall(false)}>Play without calling</button>
        </div>
      )}
      {pendingJoker && (
        <div role="dialog" aria-label="Lead the Joker">
          <p>Call a suit for the trick:</p>
          {LEAD_SUITS.map(({ suit, label }) => (
            <button key={suit} onClick={() => resolveJokerLead(suit)}>{label}</button>
          ))}
          <button onClick={() => setPendingJoker(null)}>Cancel</button>
        </div>
      )}
    </section>
  )
}
