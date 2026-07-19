import { describe, expect, it } from 'vitest'
import type { Bid } from './types'
import { isLegalBid } from './rules'

const bid = (points: number, suit: Bid['suit'], is_no_trump = false): Bid =>
  ({ player_id: 'p0', points, suit, is_no_trump })

describe('isLegalBid', () => {
  it('requires points between 13 and 20', () => {
    expect(isLegalBid({ points: 12, suit: 'clubs', is_no_trump: false }, null)).toBe(false)
    expect(isLegalBid({ points: 21, suit: 'clubs', is_no_trump: false }, null)).toBe(false)
    expect(isLegalBid({ points: 13, suit: 'clubs', is_no_trump: false }, null)).toBe(true)
    expect(isLegalBid({ points: 20, suit: 'clubs', is_no_trump: false }, null)).toBe(true)
  })

  it('no-trump bids must use suit none; suit bids must use a real suit', () => {
    expect(isLegalBid({ points: 15, suit: 'hearts', is_no_trump: true }, null)).toBe(false)
    expect(isLegalBid({ points: 15, suit: 'none', is_no_trump: true }, null)).toBe(true)
    expect(isLegalBid({ points: 15, suit: 'none', is_no_trump: false }, null)).toBe(false)
  })

  it('must not be below the current bid points', () => {
    expect(isLegalBid({ points: 14, suit: 'spades', is_no_trump: false }, bid(15, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 16, suit: 'clubs', is_no_trump: false }, bid(15, 'spades'))).toBe(true)
  })

  it('at equal points, any raise is illegal regardless of suit', () => {
    expect(isLegalBid({ points: 15, suit: 'diamonds', is_no_trump: false }, bid(15, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 15, suit: 'spades', is_no_trump: false }, bid(15, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 15, suit: 'none', is_no_trump: true }, bid(15, 'spades'))).toBe(false)
  })

  it('a raise must strictly exceed the current bid points', () => {
    expect(isLegalBid({ points: 16, suit: 'clubs', is_no_trump: false }, bid(15, 'spades'))).toBe(true)
    expect(isLegalBid({ points: 15, suit: 'clubs', is_no_trump: false }, bid(15, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 14, suit: 'clubs', is_no_trump: false }, bid(15, 'clubs'))).toBe(false)
  })
})
