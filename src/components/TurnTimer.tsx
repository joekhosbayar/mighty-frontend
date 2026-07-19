import { useEffect, useState } from 'react'

export function TurnTimer({ updatedAt }: { updatedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const localStart = Date.now()

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - localStart) / 1000))
    }, 1000)

    setElapsed(0)
    
    return () => clearInterval(interval)
  }, [updatedAt])

  if (elapsed < 3) return null

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  
  const isOvertime = elapsed >= 60
  // Shake periodically: e.g. every 4 seconds after 60s
  const isShaking = isOvertime && (elapsed % 4 === 0)
  const shakeClass = isShaking ? 'timer-shake' : ''
  const overtimeClass = isOvertime ? 'timer-overtime' : ''

  return (
    <div className={`turn-timer ${shakeClass} ${overtimeClass}`}>
      <span style={{ fontSize: '1.2rem', marginRight: '6px' }}>⏱</span> 
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  )
}
