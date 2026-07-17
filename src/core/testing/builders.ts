import type { Bid, Card, Game, Player, Suit, Trick } from '../types'

export const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

export function player(seat: number, over: Partial<Player> = {}): Player {
  return { id: `p${seat}`, name: `Player ${seat}`, seat, is_connected: true, ...over }
}

export function baseGame(over: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    status: 'playing',
    players: [0, 1, 2, 3, 4].map(s => player(s)),
    current_turn: 0,
    dealer: 0,
    bids: [],
    current_bid: null,
    declarer: -1,
    passed_players: {},
    contract: null,
    partner_card: null,
    partner_seat: -1,
    is_no_friend: false,
    trump: 'spades',
    tricks: [],
    scores: {},
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function trick(over: Partial<Trick> = {}): Trick {
  return { cards: [], lead_suit: 'none', winner: -1, joker_called: false, ...over }
}

export function bid(playerId: string, points: number, suit: Suit, isNoTrump = false): Bid {
  return { player_id: playerId, points, suit, is_no_trump: isNoTrump }
}
