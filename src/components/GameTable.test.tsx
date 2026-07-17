import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GameTable, type GameTableProps } from './GameTable'
import { tableView } from '../core/view'
import { baseGame, bid, c, player, trick } from '../core/testing/builders'

function renderTable(over: Partial<GameTableProps> = {}, game = baseGame({ status: 'waiting' })) {
  const props: GameTableProps = {
    view: tableView(game, 'p0'),
    connection: 'open',
    error: null,
    onBid: vi.fn(), onPass: vi.fn(), onDiscard: vi.fn(),
    onCallPartner: vi.fn(), onPlayCard: vi.fn(), onLeave: vi.fn(),
    ...over,
  }
  render(<GameTable {...props} />)
  return props
}

describe('GameTable', () => {
  it('shows game id and waiting status', () => {
    renderTable({}, baseGame({ status: 'waiting', players: [player(0), player(1), null, null, null] }))
    expect(screen.getByTestId('game-id')).toHaveTextContent('g1')
    expect(screen.getByText(/waiting for players \(2\/5\)/i)).toBeInTheDocument()
  })

  it('renders the bid panel during bidding', () => {
    renderTable({}, baseGame({ status: 'bidding' }))
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument()
  })

  it('renders the exchange panel during exchanging', () => {
    renderTable({}, baseGame({ status: 'exchanging', declarer: 1 }))
    expect(screen.getByText(/waiting for the declarer to exchange/i)).toBeInTheDocument()
  })

  it('renders the play area during playing', () => {
    renderTable({}, baseGame({ status: 'playing', tricks: [trick()] }))
    expect(screen.getByTestId('seat-0')).toBeInTheDocument()
  })

  it('renders the scoreboard when finished', () => {
    renderTable({}, baseGame({
      status: 'finished',
      contract: bid('p0', 5, 'spades'),
      scores: { p0: 11 },
    }))
    expect(screen.getByTestId('scoreboard')).toBeInTheDocument()
    expect(screen.getByText(/contract: 5 spades/i)).toBeInTheDocument()
  })

  it('shows a reconnecting banner and errors', () => {
    renderTable({ connection: 'reconnecting', error: 'not your turn' }, baseGame({ status: 'bidding' }))
    expect(screen.getByRole('status')).toHaveTextContent(/reconnecting/i)
    expect(screen.getByRole('alert')).toHaveTextContent('not your turn')
  })

  it('shows my hand read-only during bidding', () => {
    const g = baseGame({
      status: 'bidding',
      players: [player(0, { hand: [c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
    })
    renderTable({}, g)
    expect(screen.getByTestId('hand-card-clubs-5')).toBeDisabled()
  })
})
