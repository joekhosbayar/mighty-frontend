import type { Bid, Card, Game, Suit } from './types'
import { cardKey, isJoker, isJokerCaller, isMighty, SUIT_RANK } from './cards'

export interface BidInput {
  points: number
  suit: Suit
  is_no_trump: boolean
}

export function isLegalBid(bid: BidInput, currentBid: Bid | null): boolean {
  if (bid.points < 3 || bid.points > 10) return false
  if (bid.is_no_trump) {
    if (bid.suit !== 'none') return false
  } else if (!(bid.suit in SUIT_RANK)) {
    return false
  }
  if (!currentBid) return true
  if (bid.points < currentBid.points) return false
  if (bid.points === currentBid.points) {
    if (currentBid.is_no_trump) return false
    if (!bid.is_no_trump && SUIT_RANK[bid.suit] <= SUIT_RANK[currentBid.suit]) return false
  }
  return true
}

export function legalPlays(game: Game, seat: number): Card[] {
  const p = game.players[seat]
  if (!p?.hand || game.status !== 'playing' || game.current_turn !== seat) return []
  const tricks = game.tricks ?? []
  const t = tricks[tricks.length - 1]
  if (!t) return []
  const hand = p.hand
  const isFirstTrick = tricks.length === 1

  if (t.joker_called && hand.some(isJoker)) {
    const forced = hand.filter(card => isJoker(card) || isMighty(card, game.trump))
    if (forced.length > 0) return forced
  }

  if (t.cards.length === 0) {
    if (isFirstTrick && hand.some(card => card.suit !== game.trump)) {
      return hand.filter(card => card.suit !== game.trump || isMighty(card, game.trump))
    }
    return [...hand]
  }

  const lead = t.lead_suit
  const canFollow = hand.some(card => card.suit === lead)
  return hand.filter(card => {
    if (card.suit === lead) return true
    if (isJoker(card)) return true
    if (isMighty(card, game.trump)) return !(isFirstTrick && canFollow)
    return !canFollow
  })
}

export function canCallJoker(game: Game, seat: number, card: Card): boolean {
  if (game.status !== 'playing' || game.current_turn !== seat) return false
  const tricks = game.tricks ?? []
  const t = tricks[tricks.length - 1]
  if (!t || t.cards.length > 0) return false
  if (!isJokerCaller(card, game.trump)) return false
  return tricks.length !== 1 && tricks.length !== 10
}

export function isValidDiscard(hand: Card[], selection: Card[]): boolean {
  if (selection.length !== 3) return false
  const keys = selection.map(cardKey)
  if (new Set(keys).size !== 3) return false
  return keys.every(k => hand.some(card => cardKey(card) === k))
}
