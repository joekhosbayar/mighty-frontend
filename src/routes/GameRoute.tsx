import { useEffect } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router'
import { useApp } from '../store/context'
import { GameScreen } from '../components/GameScreen'

export function GameRoute() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const resumeGame = useApp(s => s.resumeGame)
  const leaveTable = useApp(s => s.leaveTable)
  const status = useApp(s => s.game?.status)

  // Resume (or confirm we are already connected) whenever the game id changes.
  useEffect(() => {
    let cancelled = false
    void resumeGame(id).then(r => {
      if (!cancelled && !r.ok) navigate('/lobby', { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [id, resumeGame, navigate])

  // Tear the socket down when we actually leave the game route.
  useEffect(() => () => leaveTable(), [leaveTable])

  // Confirm before abandoning a game that is in progress.
  const active = status === 'bidding' || status === 'playing'
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Leave game?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  return <GameScreen />
}
