export type Suit = 'spades' | 'diamonds' | 'hearts' | 'clubs' | 'none'
export type Rank =
  | 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2' | 'Joker'

export interface Card {
  suit: Suit
  rank: Rank
}

export type Phase = 'waiting' | 'bidding' | 'exchanging' | 'calling' | 'playing' | 'finished'
export type MoveType = 'bid' | 'pass' | 'discard' | 'call_partner' | 'play_card'

export interface Bid {
  player_id: string
  points: number
  suit: Suit
  is_no_trump: boolean
}

export interface Player {
  id: string
  name: string
  seat: number
  hand?: Card[]
  points?: Card[]
  is_connected: boolean
}

export interface PlayedCard {
  player_id: string
  seat: number
  card: Card
}

export interface Trick {
  cards: PlayedCard[]
  lead_suit: Suit
  winner: number
  joker_called: boolean
}

export interface Game {
  id: string
  status: Phase
  players: (Player | null)[]
  kitty?: Card[]
  current_turn: number
  dealer: number
  bids: Bid[] | null
  current_bid: Bid | null
  declarer: number
  passed_players: Record<string, boolean> | null
  contract: Bid | null
  partner_card: Card | null
  partner_seat: number
  is_no_friend: boolean
  trump: Suit
  tricks: Trick[] | null
  scores: Record<string, number> | null
  version: number
  created_at: string
  updated_at: string
}

export type ServerMessage =
  | { kind: 'game'; game: Game }
  | { kind: 'error'; error: string }
  | { kind: 'event'; type: string }

// The server sends three shapes: {"type":"ERROR",...}, move envelopes with a
// full game under "game_state", and stateless envelopes (e.g. player_joined)
// after which clients must refetch state over REST.
export function parseServerMessage(raw: string): ServerMessage {
  const data = JSON.parse(raw) as Record<string, unknown>
  if (data.type === 'ERROR') {
    return { kind: 'error', error: typeof data.error === 'string' ? data.error : 'unknown error' }
  }
  if (typeof data.type === 'string') {
    if (data.game_state && typeof data.game_state === 'object') {
      return { kind: 'game', game: data.game_state as unknown as Game }
    }
    return { kind: 'event', type: data.type }
  }
  return { kind: 'game', game: data as unknown as Game }
}
