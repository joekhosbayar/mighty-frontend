import type { TableView } from '../core/view'

export function ScoreBoard({ view }: { view: TableView }) {
  return (
    <section data-testid="scoreboard">
      <h2>Hand finished</h2>
      {view.contract && (
        <p>
          {`Contract: ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
        </p>
      )}
      <table>
        <thead>
          <tr><th>Player</th><th>Card points</th><th>Role</th></tr>
        </thead>
        <tbody>
          {view.scores.map(row => {
            const seat = view.seats.find(s => s.name === row.name)
            const role = seat?.isDeclarer ? 'declarer' : seat?.isPartner ? 'partner' : ''
            return (
              <tr key={row.playerId}>
                <td>{row.name}</td>
                <td>{row.cardPoints}</td>
                <td>{role}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
