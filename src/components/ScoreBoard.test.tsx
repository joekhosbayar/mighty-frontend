import { render, screen, within } from '@testing-library/react'
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
    expect(row0).toHaveTextContent('Declarer')
    const row1 = screen.getByTestId('score-row-p1')
    expect(row1).toHaveTextContent('25')
    expect(row1).toHaveTextContent('Partner')
    expect(screen.getByText('Round score')).toBeInTheDocument()
    expect(screen.getByText('Card points')).toBeInTheDocument()
  })

  it('shows a negative round score with a minus sign, colored as a loss', () => {
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
      scores: { p0: 20, p1: -5, p2: -5, p3: -5, p4: -5 },
    })
    render(<ScoreBoard view={tableView(g, 'p2')} />)
    const row2 = screen.getByTestId('score-row-p2')
    expect(row2).toHaveTextContent('-5')
    expect(within(row2).getAllByText('-5')[0]).toHaveStyle({ color: 'var(--color-crimson)' })
    const row0 = screen.getByTestId('score-row-p0')
    expect(row0).toHaveTextContent('+20')
  })
  it('renders one row per seated player in a four-player game', () => {
    const game = {
      config: { num_players: 4, allow_joker_partner: true, fail_dist: 'equal_split' },
      players: [
        { id: 'a', name: 'A', seat: 0 }, { id: 'b', name: 'B', seat: 1 },
        { id: 'c', name: 'C', seat: 2 }, { id: 'd', name: 'D', seat: 3 }, null,
      ],
      scores: { a: 3, b: 3, c: -3, d: -3 },
    } as never
    render(<ScoreBoard view={tableView(game, 'a')} />)
    expect(screen.getAllByTestId(/score-row-/)).toHaveLength(4)
  })
})
