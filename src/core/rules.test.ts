import { describe, expect, it } from 'vitest'
import type { Bid } from './types'
import { isLegalBid } from './rules'

const bid = (points: number, suit: Bid['suit'], is_no_trump = false): Bid =>
  ({ player_id: 'p0', points, suit, is_no_trump })

describe('isLegalBid', () => {
  it('requires points between 3 and 10', () => {
    expect(isLegalBid({ points: 2, suit: 'clubs', is_no_trump: false }, null)).toBe(false)
    expect(isLegalBid({ points: 11, suit: 'clubs', is_no_trump: false }, null)).toBe(false)
    expect(isLegalBid({ points: 3, suit: 'clubs', is_no_trump: false }, null)).toBe(true)
  })

  it('no-trump bids must use suit none; suit bids must use a real suit', () => {
    expect(isLegalBid({ points: 5, suit: 'hearts', is_no_trump: true }, null)).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: true }, null)).toBe(true)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: false }, null)).toBe(false)
  })

  it('must not be below the current bid points', () => {
    expect(isLegalBid({ points: 4, suit: 'spades', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 6, suit: 'clubs', is_no_trump: false }, bid(5, 'spades'))).toBe(true)
  })

  it('at equal points, any raise is illegal regardless of suit', () => {
    expect(isLegalBid({ points: 5, suit: 'diamonds', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'spades', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: true }, bid(5, 'spades'))).toBe(false)
  })

  it('a raise must strictly exceed the current bid points', () => {
    expect(isLegalBid({ points: 6, suit: 'clubs', is_no_trump: false }, bid(5, 'spades'))).toBe(true)
    expect(isLegalBid({ points: 5, suit: 'clubs', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 4, suit: 'clubs', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
  })
})
