import type { TableView } from '../core/view'

export function ScoreBoard({ view }: { view: TableView }) {
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
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Card points</th>
            <th style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>Role</th>
          </tr>
        </thead>
        <tbody>
          {view.scores.map(row => {
            const seat = view.seats.find(s => s.name === row.name)
            const role = seat?.isDeclarer ? 'Declarer' : seat?.isPartner ? 'Partner' : ''
            const roleColor = role === 'Declarer' ? 'var(--color-accent)' : role === 'Partner' ? 'var(--color-text-primary)' : 'inherit'
            return (
              <tr key={row.playerId} data-testid={`score-row-${row.playerId}`}>
                <td style={{ fontWeight: '600' }}>{row.name}</td>
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
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{row.cardPoints}</td>
                <td style={{ color: roleColor, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{role}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
