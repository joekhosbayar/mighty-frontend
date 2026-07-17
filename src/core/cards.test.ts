import { describe, expect, it } from 'vitest'
import type { Card } from './types'
import {
  cardLabel, isJokerCaller, isMighty, isPointCard, jokerCallerCard, mightyCard, sortHand,
} from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('special card identity', () => {
  it('mighty is the spade ace normally', () => {
    expect(mightyCard('hearts')).toEqual(c('spades', 'A'))
    expect(isMighty(c('spades', 'A'), 'hearts')).toBe(true)
  })

  it('mighty shifts to the club ace when spades are trump', () => {
    expect(mightyCard('spades')).toEqual(c('clubs', 'A'))
    expect(isMighty(c('spades', 'A'), 'spades')).toBe(false)
    expect(isMighty(c('clubs', 'A'), 'spades')).toBe(true)
  })

  it('joker caller is the club 3, shifting to spade 3 when clubs are trump', () => {
    expect(jokerCallerCard('hearts')).toEqual(c('clubs', '3'))
    expect(jokerCallerCard('clubs')).toEqual(c('spades', '3'))
    expect(isJokerCaller(c('spades', '3'), 'clubs')).toBe(true)
  })
})

describe('point cards', () => {
  it('A K Q J 10 are points; 9 and Joker are not', () => {
    expect(isPointCard(c('hearts', 'A'))).toBe(true)
    expect(isPointCard(c('clubs', '10'))).toBe(true)
    expect(isPointCard(c('clubs', '9'))).toBe(false)
    expect(isPointCard(c('none', 'Joker'))).toBe(false)
  })
})

describe('sortHand', () => {
  it('orders joker, then trump, then remaining suits high-suit-first, ranks descending', () => {
    const hand = [c('clubs', '2'), c('hearts', 'K'), c('hearts', 'A'), c('none', 'Joker'), c('spades', '5')]
    expect(sortHand(hand, 'hearts')).toEqual([
      c('none', 'Joker'), c('hearts', 'A'), c('hearts', 'K'), c('spades', '5'), c('clubs', '2'),
    ])
  })

  it('does not mutate the input', () => {
    const hand = [c('clubs', '2'), c('spades', 'A')]
    sortHand(hand, 'none')
    expect(hand[0]).toEqual(c('clubs', '2'))
  })
})

describe('cardLabel', () => {
  it('renders suit symbol and rank, and Joker plainly', () => {
    expect(cardLabel(c('spades', 'A'))).toBe('♠A')
    expect(cardLabel(c('none', 'Joker'))).toBe('Joker')
  })
})
