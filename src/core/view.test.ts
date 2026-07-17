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
    expect(v.scores.find(s => s.playerId === 'p0')?.cardPoints).toBe(12)
    expect(v.scores.find(s => s.playerId === 'p2')?.cardPoints).toBe(0)
    expect(v.version).toBe(42)
    expect(v.gameId).toBe('g1')
  })
})
