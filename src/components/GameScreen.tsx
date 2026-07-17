import { tableView } from '../core/view'
import { useApp } from '../store'
import { GameTable } from './GameTable'

export function GameScreen() {
  const game = useApp(s => s.game)
  const userId = useApp(s => s.userId)
  const connection = useApp(s => s.connection)
  const lastError = useApp(s => s.lastError)
  const sendMove = useApp(s => s.sendMove)
  const leaveTable = useApp(s => s.leaveTable)

  if (!game || !userId) return <p>Loading game…</p>

  return (
    <GameTable
      view={tableView(game, userId)}
      connection={connection}
      error={lastError}
      onBid={b => sendMove('bid', b)}
      onPass={() => sendMove('pass', null)}
      onDiscard={cards => sendMove('discard', cards)}
      onCallPartner={card => sendMove('call_partner', card)}
      onPlayCard={(card, callJoker) => sendMove('play_card', { card, call_joker: callJoker })}
      onLeave={leaveTable}
    />
  )
}
