import type { Bid, Suit } from './types'
import { SUIT_RANK } from './cards'

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
