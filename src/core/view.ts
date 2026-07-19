import type { Bid, Card, Game, GameConfig, Phase, PlayedCard, Suit } from './types'
import { cardKey, jokerCallerCard, sortHand } from './cards'
import { canCallJoker, legalPlays } from './rules'

export interface SeatView {
  seat: number
  playerId: string
  name: string | null
  isEmpty: boolean
  isMe: boolean
  isTurn: boolean
  isDeclarer: boolean
  isPartner: boolean
  isConnected: boolean
  cardCount: number
  hasVotedPlayAgain: boolean
}

export interface HandCard {
  card: Card
  playable: boolean
}

export interface ScoreRow {
  playerId: string
  name: string
  roundScore: number
  totalScore: number
  cardPoints: number
}

export interface TableView {
  gameId: string
  phase: Phase
  mySeat: number
  isMyTurn: boolean
  amDeclarer: boolean
  seats: SeatView[]
  hand: HandCard[]
  currentTrick: PlayedCard[]
  bids: Bid[]
  currentBid: Bid | null
  contract: Bid | null
  trump: Suit
  partnerCard: Card | null
  partnerRevealed: boolean
  jokerCallCard: Card | null
  jokerLeadCard: Card | null
  scores: ScoreRow[]
  passedPlayers: Record<string, boolean>
  version: number
  config?: GameConfig
}

export function tableView(game: Game, myPlayerId: string): TableView {
  const me = game.players.find(p => p?.id === myPlayerId) ?? null
  const mySeat = me?.seat ?? -1
  const active = game.status === 'bidding' || game.status === 'playing'
  const isMyTurn = mySeat >= 0 && active && game.current_turn === mySeat
  const amDeclarer = mySeat >= 0 && game.declarer === mySeat

  const playable = new Set(
    game.status === 'playing' && mySeat >= 0 ? legalPlays(game, mySeat).map(cardKey) : [],
  )
  const sorted = me?.hand ? sortHand(me.hand, game.trump) : []

  const caller = jokerCallerCard(game.trump)
  const jokerCallCard =
    mySeat >= 0 && playable.has(cardKey(caller)) && canCallJoker(game, mySeat, caller)
      ? caller
      : null

  const tricks = game.tricks ?? []
  const jokerCard: Card = { suit: 'none', rank: 'Joker' }
  const leading = (tricks[tricks.length - 1]?.cards.length ?? -1) === 0
  const jokerLeadCard =
    mySeat >= 0 && leading && playable.has(cardKey(jokerCard)) ? jokerCard : null

  return {
    gameId: game.id,
    phase: game.status,
    mySeat,
    isMyTurn,
    amDeclarer,
    seats: game.players.map((p, i) => ({
      seat: i,
      playerId: p?.id ?? '',
      name: p?.name ?? null,
      isEmpty: !p,
      isMe: i === mySeat,
      isTurn: active && i === game.current_turn,
      isDeclarer: i === game.declarer,
      isPartner: i === game.partner_seat,
      isConnected: p?.is_connected ?? false,
      cardCount: p?.hand?.length ?? 0,
      hasVotedPlayAgain: game.play_again_votes?.[i] ?? false,
    })),
    hand: sorted.map(card => ({ card, playable: playable.has(cardKey(card)) })),
    currentTrick: tricks[tricks.length - 1]?.cards ?? [],
    bids: game.bids ?? [],
    currentBid: game.current_bid,
    contract: game.contract,
    trump: game.trump,
    partnerCard: game.partner_card,
    partnerRevealed: game.partner_seat >= 0,
    jokerCallCard,
    jokerLeadCard,
    scores: game.players.flatMap(p =>
      p
        ? [{
            playerId: p.id,
            name: p.name,
            roundScore: game.scores?.[p.id] ?? 0,
            totalScore: game.total_scores?.[p.id] ?? (game.scores?.[p.id] ?? 0),
            cardPoints: p.points?.length ?? 0,
          }]
        : [],
    ),
    passedPlayers: game.passed_players ?? {},
    version: game.version,
    config: game.config,
  }
}
