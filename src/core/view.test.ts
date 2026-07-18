import { describe, expect, it } from 'vitest'
import { tableView } from './view'
import { baseGame, bid, c, player, trick } from './testing/builders'

describe('tableView', () => {
  it('locates my seat, turn, and declarer flags', () => {
    const g = baseGame({ status: 'bidding', current_turn: 2, declarer: 2 })
    const v = tableView(g, 'p2')
    expect(v.mySeat).toBe(2)
    expect(v.isMyTurn).toBe(true)
    expect(v.amDeclarer).toBe(true)
    expect(tableView(g, 'p0').isMyTurn).toBe(false)
    expect(tableView(g, 'stranger').mySeat).toBe(-1)
  })

  it('marks seats with turn, declarer, partner, and emptiness', () => {
    const g = baseGame({
      status: 'playing', current_turn: 1, declarer: 3, partner_seat: 4,
      players: [player(0), null, player(2), player(3), player(4)],
    })
    const v = tableView(g, 'p0')
    expect(v.seats).toHaveLength(5)
    expect(v.seats[1].isEmpty).toBe(true)
    expect(v.seats[3].isDeclarer).toBe(true)
    expect(v.seats[4].isPartner).toBe(true)
    expect(v.partnerRevealed).toBe(true)
  })

  it('sorts my hand and flags playable cards during playing', () => {
    const hand = [c('clubs', '5'), c('spades', 'A'), c('hearts', 'K')] // hearts trump → ♠A mighty
    const g = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
      tricks: [trick()], // trick 1: no trump lead
    })
    const v = tableView(g, 'p0')
    expect(v.hand.map(h => h.card)).toEqual([c('hearts', 'K'), c('spades', 'A'), c('clubs', '5')])
    expect(v.hand.find(h => h.card.rank === 'K')?.playable).toBe(false)
    expect(v.hand.find(h => h.card.suit === 'spades')?.playable).toBe(true)
  })

  it('leaves all cards unplayable outside the playing phase', () => {
    const g = baseGame({
      status: 'bidding',
      players: [player(0, { hand: [c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
    })
    expect(tableView(g, 'p0').hand.every(h => !h.playable)).toBe(true)
  })

  it('exposes the joker-call card only when a call is possible', () => {
    const caller = c('clubs', '3')
    const g = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [caller, c('diamonds', '2')] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(g, 'p0').jokerCallCard).toEqual(caller)
    const trick1 = { ...g, tricks: [trick()] }
    expect(tableView(trick1, 'p0').jokerCallCard).toBeNull()
  })

  it('carries bids, contract, trick, scores, and version through', () => {
    const g = baseGame({
      status: 'finished',
      bids: [bid('p0', 5, 'spades')],
      contract: bid('p0', 5, 'spades'),
      scores: { p0: 12, p1: 3 },
      version: 42,
      tricks: [trick({ cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }], lead_suit: 'clubs', winner: 1 })],
    })
    const v = tableView(g, 'p0')
    expect(v.bids).toHaveLength(1)
    expect(v.contract?.points).toBe(5)
    expect(v.currentTrick).toHaveLength(1)
    expect(v.scores.find(s => s.playerId === 'p0')?.roundScore).toBe(12)
    expect(v.scores.find(s => s.playerId === 'p2')?.roundScore).toBe(0)
    expect(v.version).toBe(42)
    expect(v.gameId).toBe('g1')
  })
})

describe('jokerLeadCard', () => {
  const joker = c('none', 'Joker')

  it('exposes the joker when leading with it playable', () => {
    const g = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [joker, c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(g, 'p0').jokerLeadCard).toEqual(joker)
  })

  it('is null when following, when not my turn, and when not holding the joker', () => {
    const following = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [joker] }), player(1), player(2), player(3), player(4)],
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    expect(tableView(following, 'p0').jokerLeadCard).toBeNull()

    const notMyTurn = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 2,
      players: [player(0, { hand: [joker] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(notMyTurn, 'p0').jokerLeadCard).toBeNull()

    const noJoker = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(noJoker, 'p0').jokerLeadCard).toBeNull()
  })
})

describe('score rows', () => {
  it('separates round scores from card points', () => {
    const g = baseGame({
      status: 'finished',
      players: [
        player(0, { points: [c('hearts', 'A'), c('clubs', '10'), c('spades', 'K')] }),
        player(1, { points: [c('diamonds', 'J')] }),
        player(2), player(3), player(4),
      ],
      scores: { p0: 140, p1: 70 },
    })
    const rows = tableView(g, 'p0').scores
    expect(rows.find(r => r.playerId === 'p0')).toMatchObject({ roundScore: 140, cardPoints: 3 })
    expect(rows.find(r => r.playerId === 'p1')).toMatchObject({ roundScore: 70, cardPoints: 1 })
    expect(rows.find(r => r.playerId === 'p2')).toMatchObject({ roundScore: 0, cardPoints: 0 })
  })
})
