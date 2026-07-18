import { describe, expect, it } from 'vitest'
import { canCallJoker, isValidDiscard, legalPlays } from './rules'
import { baseGame, c, player, trick } from './testing/builders'

function playingGame(hand: ReturnType<typeof c>[], over = {}) {
  return baseGame({
    status: 'playing',
    trump: 'hearts',
    current_turn: 0,
    players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
    ...over,
  })
}

describe('legalPlays', () => {
  it('returns empty when it is not your turn or not playing', () => {
    const g = playingGame([c('clubs', '5')], { current_turn: 2 })
    expect(legalPlays(g, 0)).toEqual([])
    expect(legalPlays(playingGame([c('clubs', '5')], { status: 'bidding' }), 0)).toEqual([])
  })

  it('when leading trick 1, forbids leading trump, mighty, and joker', () => {
    const hand = [c('hearts', 'K'), c('clubs', '5'), c('spades', 'A')] // hearts trump, ♠A mighty
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5')])
  })

  it('when leading trick 1 with only trumps, allows them', () => {
    const hand = [c('hearts', 'K'), c('hearts', '2')]
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual(hand)
  })

  it('when leading a later trick, everything is legal', () => {
    const hand = [c('hearts', 'K'), c('clubs', '5')]
    const g = playingGame(hand, { tricks: [trick({ winner: 0 }), trick()] })
    expect(legalPlays(g, 0)).toEqual(hand)
  })

  it('must follow the lead suit when able; mighty and joker are exempt', () => {
    const hand = [c('clubs', '5'), c('diamonds', 'K'), c('spades', 'A'), c('none', 'Joker')]
    const g = playingGame(hand, {
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5'), c('spades', 'A'), c('none', 'Joker')])
  })

  it('void in the lead suit, anything goes', () => {
    const hand = [c('diamonds', 'K'), c('hearts', '3')]
    const g = playingGame(hand, {
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    expect(legalPlays(g, 0)).toEqual(hand)
  })

  it('on trick 1, mighty cannot escape following suit when able to follow', () => {
    const hand = [c('clubs', '5'), c('spades', 'A'), c('diamonds', '7')]
    const g = playingGame(hand, {
      tricks: [trick({ lead_suit: 'clubs', cards: [{ player_id: 'p4', seat: 4, card: c('clubs', '9') }] })],
    })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5')])
  })

  it('when the joker is called and you hold it, only joker or mighty are playable', () => {
    const hand = [c('clubs', '5'), c('diamonds', '8'), c('none', 'Joker'), c('spades', 'A')]
    const g = playingGame(hand, {
      tricks: [
        trick({ winner: 1 }),
        trick({
          lead_suit: 'clubs',
          joker_called: true,
          cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '3') }],
        }),
      ],
    })
    expect(legalPlays(g, 0)).toEqual([c('none', 'Joker'), c('spades', 'A')])
  })

  it('cannot lead the joker on trick 1', () => {
    const hand = [c('clubs', '5'), c('diamonds', '7'), c('none', 'Joker')]
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5'), c('diamonds', '7')])
  })

  it('uses the diamond ace as mighty when spades is trump', () => {
    // spades trump → ♦A is the mighty and cannot be led on trick 1, even though
    // it is a diamond. If it were an ordinary diamond it would be a legal lead.
    const hand = [c('hearts', '5'), c('diamonds', 'A'), c('clubs', '7')]
    const g = playingGame(hand, { trump: 'spades', tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('hearts', '5'), c('clubs', '7')])
  })

  it('on trick 1, mighty may follow only as your sole card of the led suit', () => {
    // hearts trump, ♠A mighty. Lead spades, ♠A is the only spade → legal follow.
    const soleSpade = playingGame([c('spades', 'A'), c('clubs', '5'), c('hearts', '7')], {
      tricks: [trick({ lead_suit: 'spades', cards: [{ player_id: 'p4', seat: 4, card: c('spades', '9') }] })],
    })
    expect(legalPlays(soleSpade, 0)).toEqual([c('spades', 'A')])

    // Holding another spade, mighty cannot escape following with the plain spade.
    const twoSpades = playingGame([c('spades', 'A'), c('spades', '2'), c('clubs', '5')], {
      tricks: [trick({ lead_suit: 'spades', cards: [{ player_id: 'p4', seat: 4, card: c('spades', '9') }] })],
    })
    expect(legalPlays(twoSpades, 0)).toEqual([c('spades', '2')])
  })

  it('with 3 cards left holding both mighty and joker, forces one of them', () => {
    const hand = [c('clubs', '5'), c('spades', 'A'), c('none', 'Joker')] // hearts trump
    const g = playingGame(hand, {
      tricks: [...Array.from({ length: 7 }, () => trick({ winner: 0 })), trick({ winner: 0 })],
    })
    expect(legalPlays(g, 0)).toEqual([c('spades', 'A'), c('none', 'Joker')])
  })

  it('with 2 cards left holding either mighty or joker, forces it', () => {
    const hand = [c('clubs', '5'), c('spades', 'A')] // hearts trump
    const g = playingGame(hand, {
      tricks: [...Array.from({ length: 8 }, () => trick({ winner: 0 })), trick({ winner: 0 })],
    })
    expect(legalPlays(g, 0)).toEqual([c('spades', 'A')])
  })
})

describe('canCallJoker', () => {
  const caller = c('clubs', '3') // hearts trump → caller is ♣3
  it('allows calling when leading tricks 2-9 with the joker caller', () => {
    const g = playingGame([caller], { tricks: [trick({ winner: 0 }), trick()] })
    expect(canCallJoker(g, 0, caller)).toBe(true)
  })
  it('forbids calling on trick 1 and trick 10', () => {
    expect(canCallJoker(playingGame([caller], { tricks: [trick()] }), 0, caller)).toBe(false)
    const tenTricks = [...Array.from({ length: 9 }, () => trick({ winner: 0 })), trick()]
    expect(canCallJoker(playingGame([caller], { tricks: tenTricks }), 0, caller)).toBe(false)
  })
  it('forbids calling mid-trick or with a non-caller card', () => {
    const mid = playingGame([caller], {
      tricks: [trick({ winner: 0 }), trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] })],
    })
    expect(canCallJoker(mid, 0, caller)).toBe(false)
    const g = playingGame([c('clubs', '4')], { tricks: [trick({ winner: 0 }), trick()] })
    expect(canCallJoker(g, 0, c('clubs', '4'))).toBe(false)
  })
})

describe('isValidDiscard', () => {
  const hand = [c('clubs', '2'), c('clubs', '3'), c('clubs', '4'), c('clubs', '5')]
  it('accepts exactly 3 distinct held cards', () => {
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '3'), c('clubs', '4')])).toBe(true)
  })
  it('rejects wrong count, duplicates, and cards not held', () => {
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '3')])).toBe(false)
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '2'), c('clubs', '3')])).toBe(false)
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '3'), c('hearts', 'A')])).toBe(false)
  })
})
