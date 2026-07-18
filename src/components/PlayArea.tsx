import { useState } from 'react'
import type { Card, Suit } from '../core/types'
import type { TableView } from '../core/view'
import { cardLabel, sameCard } from '../core/cards'
import { Hand } from './Hand'
import { PhysicalCard } from './PhysicalCard'

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

  const mySeatIdx = view.seats.findIndex(s => s.isMe)
  
  const POSITIONS = ['seat-pos-bottom', 'seat-pos-left', 'seat-pos-top-left', 'seat-pos-top-right', 'seat-pos-right']

  return (
    <div className="play-area">
      <div className="seats-container">
        {view.seats.map((s, idx) => {
          const relIdx = mySeatIdx >= 0 ? (idx - mySeatIdx + 5) % 5 : idx
          const trickCard = played.get(s.seat)
          const isTurn = s.isTurn ? 'is-turn' : ''
          return (
            <div key={s.seat} data-testid={`seat-${s.seat}`} className={`seat-wrapper ${POSITIONS[relIdx]}`}>
              <div className={`seat-nameplate ${isTurn}`}>
                {s.name ?? 'empty'}
              </div>
              {(s.isDeclarer || s.isPartner) && (
                <div className="seat-role">{s.isDeclarer ? 'Declarer' : 'Partner'}</div>
              )}
            </div>
          )
        })}

        <div className="trick-area">
          {view.seats.map((s) => {
            const trickCard = played.get(s.seat)
            return trickCard ? (
              <div key={`trick-${s.seat}`} data-testid={`trick-card-${s.seat}`}>
                <PhysicalCard card={trickCard} />
              </div>
            ) : null
          })}
        </div>
      </div>

      <Hand cards={view.hand} mode="play" onCard={handleCard} />
      
      {pendingCaller && (
        <div role="dialog" aria-label="Call the Joker?">
          <p>Lead the Joker Caller — force the Joker out?</p>
          <div className="dialog-actions">
            <button onClick={() => resolveCall(true)}>Call the Joker</button>
            <button onClick={() => resolveCall(false)}>Play without calling</button>
          </div>
        </div>
      )}
      {pendingJoker && (
        <div role="dialog" aria-label="Lead the Joker">
          <p>Call a suit for the trick:</p>
          <div className="dialog-actions">
            {LEAD_SUITS.map(({ suit, label }) => (
              <button key={suit} onClick={() => resolveJokerLead(suit)}>{label}</button>
            ))}
          </div>
          <button onClick={() => setPendingJoker(null)} style={{marginTop: '1rem', background: 'transparent'}}>Cancel</button>
        </div>
      )}
    </div>
  )
}
