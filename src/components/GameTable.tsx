import type { Card, Suit } from '../core/types'
import type { TableView } from '../core/view'
import type { ConnectionStatus } from '../api/ws'
import type { BidInput } from '../core/rules'
import { BidPanel } from './BidPanel'
import { ExchangePanel } from './ExchangePanel'
import { FriendCallPanel } from './FriendCallPanel'
import { Hand } from './Hand'
import { PlayArea } from './PlayArea'
import { ScoreBoard } from './ScoreBoard'

export interface GameTableProps {
  view: TableView
  connection: ConnectionStatus
  error: string | null
  onBid(bid: BidInput): void
  onPass(): void
  onDiscard(cards: Card[]): void
  onCallPartner(card: Card): void
  onNoFriend(): void
  onPlayCard(card: Card, callJoker: boolean, calledSuit?: Suit): void
  onLeave(): void
}

export function GameTable(props: GameTableProps) {
  const { view, connection, error } = props
  const seated = view.seats.filter(s => !s.isEmpty).length

  return (
    <main className="table">
      <header>
        <span data-testid="game-id">{view.gameId}</span>
        <span data-testid="phase">{view.phase}</span>
        {view.contract && (
          <span>
            {`Contract ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
          </span>
        )}
        <button onClick={props.onLeave}>Leave</button>
      </header>
      {connection !== 'open' && <p role="status">Reconnecting…</p>}
      {error && <p role="alert">{error}</p>}

      {view.phase === 'waiting' && <p>{`Waiting for players (${seated}/5)…`}</p>}
      {view.phase === 'bidding' && <BidPanel view={view} onBid={props.onBid} onPass={props.onPass} />}
      {view.phase === 'exchanging' && <ExchangePanel view={view} onDiscard={props.onDiscard} />}
      {view.phase === 'calling' && <FriendCallPanel view={view} onCallPartner={props.onCallPartner} onNoFriend={props.onNoFriend} />}
      {view.phase === 'playing' && <PlayArea view={view} onPlayCard={props.onPlayCard} />}
      {view.phase === 'finished' && <ScoreBoard view={view} />}

      {(view.phase === 'bidding' || view.phase === 'calling') && view.hand.length > 0 && (
        <Hand cards={view.hand} mode="play" onCard={() => undefined} />
      )}
    </main>
  )
}
