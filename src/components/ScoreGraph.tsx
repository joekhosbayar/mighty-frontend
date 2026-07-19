import { useState } from 'react'
import type { TableView } from '../core/view'

export function ScoreGraph({ view }: { view: TableView }) {
  const [showGraph, setShowGraph] = useState(false)
  
  if (!showGraph) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          onClick={() => setShowGraph(true)}
          style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-glass-border)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
        >
          View Score History Graph
        </button>
      </div>
    )
  }

  // Calculate cumulative scores
  // Set 0 is all 0s.
  const history = view.scoreHistory || []
  
  const players = view.seats.map(s => ({ id: s.playerId, name: s.name }))
  const colors = ['#f44336', '#4caf50', '#2196f3', '#ffeb3b', '#9c27b0']
  
  const data = [[...players.map(() => 0)]] // set 0
  
  history.forEach((roundScores, i) => {
    const prev = data[i]
    const next = players.map((p, pIdx) => prev[pIdx] + (roundScores[p.id] || 0))
    data.push(next)
  })

  // Basic SVG Line Chart setup
  const width = 600
  const height = 300
  const padding = 40
  
  const allValues = data.flat()
  const minVal = Math.min(...allValues, 0)
  const maxVal = Math.max(...allValues, 10)
  const range = maxVal - minVal || 1

  const getX = (index: number) => padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2)
  const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - padding * 2)

  return (
    <div style={{ marginTop: '2rem', background: 'var(--color-glass)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-glass-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: 'var(--color-accent)' }}>Score History</h3>
        <button onClick={() => setShowGraph(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>✖ Close</button>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: '600px', display: 'block', margin: '0 auto', background: 'var(--color-surface)', borderRadius: '4px' }}>
          {/* Grid lines */}
          <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="var(--color-glass-border)" strokeWidth="2" />
          
          {/* Y-axis labels (min, 0, max) */}
          <text x={padding - 10} y={getY(maxVal)} fill="var(--color-text-secondary)" fontSize="12" textAnchor="end" alignmentBaseline="middle">{maxVal}</text>
          <text x={padding - 10} y={getY(0)} fill="var(--color-text-secondary)" fontSize="12" textAnchor="end" alignmentBaseline="middle">0</text>
          <text x={padding - 10} y={getY(minVal)} fill="var(--color-text-secondary)" fontSize="12" textAnchor="end" alignmentBaseline="middle">{minVal}</text>
          
          {/* X-axis labels (Set numbers) */}
          {data.map((_, i) => (
            <text key={i} x={getX(i)} y={height - padding + 20} fill="var(--color-text-secondary)" fontSize="12" textAnchor="middle">Set {i}</text>
          ))}
          
          {/* Lines */}
          {players.map((p, pIdx) => {
            const points = data.map((d, i) => `${getX(i)},${getY(d[pIdx])}`).join(' ')
            return (
              <polyline 
                key={p.id} 
                points={points} 
                fill="none" 
                stroke={colors[pIdx % colors.length]} 
                strokeWidth="3" 
                strokeLinejoin="round" 
              />
            )
          })}
          
          {/* Data points */}
          {players.map((p, pIdx) => 
            data.map((d, i) => (
              <circle 
                key={`${p.id}-${i}`}
                cx={getX(i)} 
                cy={getY(d[pIdx])} 
                r="4" 
                fill="var(--color-surface)" 
                stroke={colors[pIdx % colors.length]} 
                strokeWidth="2" 
              />
            ))
          )}
        </svg>
      </div>
      
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
        {players.map((p, pIdx) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
            <div style={{ width: '12px', height: '12px', background: colors[pIdx % colors.length], borderRadius: '50%' }}></div>
            {p.name}
          </div>
        ))}
      </div>
    </div>
  )
}
