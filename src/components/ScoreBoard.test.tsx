import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreBoard } from './ScoreBoard'
import { tableView } from '../core/view'
import { baseGame, bid, c, player } from '../core/testing/builders'

describe('ScoreBoard', () => {
  it('shows round scores and card points per player', () => {
    const g = baseGame({
      status: 'finished',
      declarer: 0,
      partner_seat: 1,
      contract: bid('p0', 5, 'spades'),
      players: [
        player(0, { points: [c('hearts', 'A'), c('clubs', '10')] }),
        player(1, { points: [c('diamonds', 'J')] }),
        player(2), player(3), player(4),
      ],
      scores: { p0: 50, p1: 25 },
    })
    render(<ScoreBoard view={tableView(g, 'p0')} />)
    const row0 = screen.getByTestId('score-row-p0')
    expect(row0).toHaveTextContent('50')
    expect(row0).toHaveTextContent('2')
    expect(row0).toHaveTextContent('declarer')
    const row1 = screen.getByTestId('score-row-p1')
    expect(row1).toHaveTextContent('25')
    expect(row1).toHaveTextContent('partner')
    expect(screen.getByText('Round score')).toBeInTheDocument()
    expect(screen.getByText('Card points')).toBeInTheDocument()
  })
})
