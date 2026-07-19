import { tableView } from '../core/view'
import type { PlayCardPayload, CallPartnerPayload } from '../core/types'
import { useNavigate } from 'react-router'
import { useApp } from '../store'
import { GameTable } from './GameTable'

export function GameScreen() {
  const game = useApp(s => s.game)
  const userId = useApp(s => s.userId)
  const connection = useApp(s => s.connection)
  const lastError = useApp(s => s.lastError)
  const sendMove = useApp(s => s.sendMove)
  const navigate = useNavigate()

  if (!game || !userId) return <p>Loading game…</p>

  return (
    <GameTable
      view={tableView(game, userId)}
      connection={connection}
      error={lastError}
      onBid={b => sendMove('bid', b)}
      onPass={() => sendMove('pass', null)}
      onDiscard={cards => sendMove('discard', cards)}
      onCallPartner={card => sendMove('call_partner', { card } satisfies CallPartnerPayload)}
      onNoFriend={() => sendMove('call_partner', { no_friend: true } satisfies CallPartnerPayload)}
      onPlayCard={(card, callJoker, calledSuit) =>
        sendMove('play_card', {
          card,
          call_joker: callJoker,
          ...(calledSuit ? { called_suit: calledSuit } : {}),
        } satisfies PlayCardPayload)
      }
      onLeave={() => navigate('/lobby')}
    />
  )
}
