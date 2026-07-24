import { useState, useRef, useEffect } from 'react'
import type { Card, Suit, Bid } from '../core/types'
import type { TableView } from '../core/view'
import { sameCard } from '../core/cards'
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

function BidBubble({ playerId, bids, passedPlayers }: { playerId: string, bids: Bid[], passedPlayers: Record<string, boolean> }) {
  const myLastBid = bids.filter(b => b.player_id === playerId).pop();
  const isPassed = passedPlayers[playerId] || false;
  
  const [bubble, setBubble] = useState<{ id: number, text: string } | null>(null);
  
  const prevBidHash = myLastBid ? `${myLastBid.points}-${myLastBid.suit}-${myLastBid.is_no_trump}` : '';
  const prevBidRef = useRef(prevBidHash);
  const prevPassedRef = useRef(isPassed);

  useEffect(() => {
    let text = null;
    if (isPassed && !prevPassedRef.current) {
      text = '🏳️ Pass';
    } else if (myLastBid && prevBidHash !== prevBidRef.current) {
      text = `${myLastBid.points} ${myLastBid.is_no_trump ? 'NT' : myLastBid.suit}`;
    }
    
    prevBidRef.current = prevBidHash;
    prevPassedRef.current = isPassed;

    if (text) {
      setBubble({ id: Date.now(), text });
    } else if (!isPassed && !myLastBid) {
      setBubble(null);
    }
  }, [myLastBid, isPassed, prevBidHash]);

  useEffect(() => {
    if (bubble) {
      const timer = setTimeout(() => setBubble(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [bubble]);

  if (!bubble) return null;
  return <div key={bubble.id} className="anim-bubble">{bubble.text}</div>;
}


export function PlayArea({ view, onPlayCard }: PlayAreaProps) {
  const [pendingCaller, setPendingCaller] = useState<Card | null>(null)
  const [pendingJoker, setPendingJoker] = useState<Card | null>(null)
  const [clearingTrick, setClearingTrick] = useState<{ cards: PlayedCard[], id: number } | null>(null)
  
  const prevPreviousTrickRef = useRef(view.previousTrick)

  useEffect(() => {
    // We only care about comparing the cards, not the exact object reference
    const prevHash = prevPreviousTrickRef.current?.map(c => `${c.seat}-${c.card.rank}-${c.card.suit}`).join(',')
    const currHash = view.previousTrick?.map(c => `${c.seat}-${c.card.rank}-${c.card.suit}`).join(',')
    
    if (currHash !== prevHash && view.previousTrick) {
      const id = Date.now()
      setClearingTrick({ cards: view.previousTrick, id })
      const timer = setTimeout(() => {
        setClearingTrick(current => current?.id === id ? null : current)
      }, 2500)
    }
    prevPreviousTrickRef.current = view.previousTrick
  }, [view.previousTrick])

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
  
  const guaranteedDefenderPoints = view.seats
    .filter(s => !s.isDeclarer && (view.partnerRevealed || !view.partnerCard ? !s.isPartner : false))
    .reduce((sum, s) => sum + s.capturedPoints.length, 0)
  const contractBreached = view.contract && guaranteedDefenderPoints > (20 - view.contract.points)

  const POSITIONS = ['seat-pos-bottom', 'seat-pos-left', 'seat-pos-top-left', 'seat-pos-top-right', 'seat-pos-right']

  return (
    <div className="play-area">
      <div className="seats-container">
        {view.seats.map((s, idx) => {
          const relIdx = mySeatIdx >= 0 ? (idx - mySeatIdx + 5) % 5 : idx
          const isTurn = s.isTurn ? 'is-turn' : ''
          return (
            <div key={s.seat} data-testid={`seat-${s.seat}`} className={`seat-wrapper ${POSITIONS[relIdx]}`}>
              <div className={`seat-nameplate ${isTurn}`}>
                {s.name ?? 'empty'}
              </div>
              <BidBubble playerId={s.playerId} bids={view.bids} passedPlayers={view.passedPlayers} />
              {(s.isDeclarer || s.isPartner) && (
                <div className="seat-role">{s.isDeclarer ? 'Declarer' : 'Partner'}</div>
              )}
              
              {/* Captured Cards / Discard Pile */}
              {s.capturedCount > 0 && (
                <div key={`captured-${s.capturedCount}`} className="seat-captured captured-animate" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.5rem', display: 'flex', gap: '0.2rem', zIndex: 10 }}>
                  {(s.isDeclarer || s.isPartner) ? (
                    // Declarer/Teammate: single face-down stack
                    <div className="card-physical card-back" style={{ transform: 'scale(0.5)', transformOrigin: 'top center' }}>
                      <div style={{ position: 'absolute', bottom: '-40px', left: '0', right: '0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {s.capturedCount}
                      </div>
                    </div>
                  ) : (
                    // Defender: fan of face-up point cards
                    s.capturedPoints.map((c, ci) => (
                      <div key={`${c.suit}-${c.rank}`} style={{ transform: 'scale(0.4)', transformOrigin: 'top center', marginLeft: ci > 0 ? '-30px' : '0' }}>
                        <PhysicalCard card={c} trump={view.trump} />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Frowny Face Emitter for Breached Contract */}
              {s.isDeclarer && contractBreached && (
                <div className="frowny-emitter" aria-hidden="true">
                  <div className="frowny frowny-1">☹️</div>
                  <div className="frowny frowny-2">😭</div>
                  <div className="frowny frowny-3">📉</div>
                </div>
              )}
            </div>
          )
        })}

        <div className={`trick-area ${clearingTrick ? 'trick-clearing' : ''}`}>
          {(clearingTrick ? clearingTrick.cards : view.currentTrick).map((pc, i) => {
            const isJokerLead = i === 0 && pc.card.rank === 'Joker'
            const calledSuitObj = LEAD_SUITS.find(s => s.suit === view.leadSuit)
            const suitColor = (view.leadSuit === 'hearts' || view.leadSuit === 'diamonds') ? 'var(--color-crimson)' : 'var(--color-ink)'

            return (
              <div 
                key={`trick-${pc.seat}-${i}`} 
                data-testid={`trick-card-${pc.seat}`}
                style={{ zIndex: i, position: 'relative' }}
              >
                {isJokerLead && calledSuitObj && (
                  <div style={{
                    position: 'absolute',
                    top: '-25px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--color-surface)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    border: '1px solid var(--color-glass-border)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    color: 'var(--color-text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    Called: <span style={{ color: suitColor, fontSize: '1rem' }}>{calledSuitObj.label}</span>
                  </div>
                )}
                <PhysicalCard card={pc.card} trump={view.trump} />
              </div>
            )
          })}
        </div>
      </div>

      <Hand cards={view.hand} mode="play" trump={view.trump} onCard={handleCard} />
      
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
