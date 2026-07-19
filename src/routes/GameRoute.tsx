import { useApp } from '../store/context'

export function GameRoute() {
  const gameId = useApp(s => s.game?.id) ?? 'none'
  return <p>game {gameId}</p>
}
