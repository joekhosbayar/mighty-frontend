import type { Card, Suit } from './types'

export const SUIT_RANK: Record<string, number> = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 }

export const cardKey = (c: Card): string => `${c.suit}:${c.rank}`
export const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank
export const isJoker = (c: Card): boolean => c.rank === 'Joker'
export const isPointCard = (c: Card): boolean => ['A', 'K', 'Q', 'J', '10'].includes(c.rank)

export const mightyCard = (trump: Suit): Card =>
  trump === 'spades' ? { suit: 'diamonds', rank: 'A' } : { suit: 'spades', rank: 'A' }
export const isMighty = (c: Card, trump: Suit): boolean => sameCard(c, mightyCard(trump))

export const jokerCallerCard = (trump: Suit): Card =>
  trump === 'clubs' ? { suit: 'spades', rank: '3' } : { suit: 'clubs', rank: '3' }
export const isJokerCaller = (c: Card, trump: Suit): boolean => sameCard(c, jokerCallerCard(trump))

const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', none: '',
}

export function cardLabel(c: Card): string {
  return isJoker(c) ? 'Joker' : `${SUIT_SYMBOL[c.suit]}${c.rank}`
}

export function sortHand(hand: Card[], trump: Suit): Card[] {
  const suitWeight = (c: Card): number => {
    if (isJoker(c)) return 0
    if (c.suit === trump) return 1
    return 6 - (SUIT_RANK[c.suit] ?? 0)
  }
  return [...hand].sort(
    (a, b) => suitWeight(a) - suitWeight(b) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank),
  )
}
