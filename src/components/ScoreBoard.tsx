import type { TableView } from '../core/view'
import { ScoreGraph } from './ScoreGraph'

export function ScoreBoard({ 
  view, 
  onPlayAgain, 
  onChangeConfig 
}: { 
  view: TableView
  onPlayAgain?: () => void
  onChangeConfig?: (numPlayers: number) => void
}) {
  return (
    <section className="panel" data-testid="scoreboard" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)', margin: '0 0 1rem 0' }}>Hand finished</h2>
      {view.contract && (
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {`Contract: ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
        </p>
      )}
      <table style={{ width: '100%', marginTop: '2rem' }}>
        <thead>
          <tr>
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Player</th>
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Round score</th>
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Total score</th>
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Card points</th>
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Role</th>
          </tr>
        </thead>
        <tbody>
          {view.scores.map(row => {
            const seat = view.seats.find(s => s.name === row.name)
            const declarerRow = view.scores.find(r => view.seats.find(s => s.name === r.name)?.isDeclarer)
            const isFailed = (declarerRow?.roundScore ?? 0) < 0

            let role = seat?.isDeclarer ? 'Declarer' : seat?.isPartner ? 'Partner' : ''
            let roleClass = ''
            if (seat?.isPartner && isFailed) {
              role = 'Loser Friend 🤡'
              roleClass = 'loser-friend-anim'
            }

            const roleColor = role === 'Declarer' ? 'var(--color-accent)' : seat?.isPartner ? 'var(--color-text-primary)' : 'inherit'
            return (
              <tr key={row.playerId} data-testid={`score-row-${row.playerId}`}>
                <td style={{ fontWeight: '600' }}>
                  {row.name} {view.seats.find(s => s.name === row.name)?.hasVotedPlayAgain ? '✅' : ''}
                </td>
                <td
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.1rem',
                    color:
                      row.roundScore < 0
                        ? 'var(--color-crimson)'
                        : row.roundScore > 0
                          ? '#2e7d32'
                          : 'inherit',
                  }}
                >
                  {row.roundScore > 0 ? `+${row.roundScore}` : row.roundScore}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                  {row.totalScore > 0 ? `+${row.totalScore}` : row.totalScore}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{row.cardPoints}</td>
                <td style={{ color: roleColor, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <span className={roleClass}>{role}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ScoreGraph view={view} />

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button 
          onClick={onPlayAgain} 
          disabled={view.seats.find(s => s.isMe)?.hasVotedPlayAgain}
          style={{ padding: '0.75rem 1.5rem', background: 'var(--color-accent)', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {view.seats.find(s => s.isMe)?.hasVotedPlayAgain ? 'Waiting for others...' : 'Play Again'}
        </button>

        <select 
          value={view.config?.num_players ?? 5} 
          onChange={(e) => onChangeConfig?.(Number(e.target.value))}
          style={{ padding: '0.75rem', borderRadius: '4px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        >
          <option value={4}>4-Player Game</option>
          <option value={5}>5-Player Game</option>
        </select>
      </div>
    </section>
  )
}
