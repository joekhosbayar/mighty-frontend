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
  const trump = game.trump
  const isFirstTrick = tricks.length === 1
  const leading = t.cards.length === 0

  const mighty = (card: Card): boolean => isMighty(card, trump)
  const special = (card: Card): boolean => mighty(card) || isJoker(card)

  // Late-game forcing: the mighty and joker cannot be hoarded for the final tricks.
  const hasMighty = hand.some(mighty)
  const hasJoker = hand.some(isJoker)
  if (hand.length === 3 && hasMighty && hasJoker) return hand.filter(special)
  if (hand.length === 2 && (hasMighty || hasJoker)) return hand.filter(special)

  // Joker called: its holder must surrender the joker (the mighty is the only out).
  if (t.joker_called && hasJoker) return hand.filter(special)

  if (leading) {
    if (!isFirstTrick) return [...hand]
    const hasPlainNonTrump = hand.some(card => card.suit !== trump && !special(card))
    return hand.filter(card => {
      if (special(card)) return false
      if (card.suit === trump && hasPlainNonTrump) return false
      return true
    })
  }

  const lead = t.lead_suit
  const canFollow = hand.some(card => card.suit === lead)
  const leadCount = hand.filter(card => card.suit === lead).length
  return hand.filter(card => {
    if (isFirstTrick && isJoker(card)) return false
    if (isFirstTrick && mighty(card)) return card.suit === lead && leadCount === 1
    if (card.suit === lead) return true
    if (special(card)) return true
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
