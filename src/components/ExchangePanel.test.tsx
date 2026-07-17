import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExchangePanel } from './ExchangePanel'
import { tableView } from '../core/view'
import { baseGame, c, player } from '../core/testing/builders'

const hand = [c('clubs', '2'), c('clubs', '3'), c('clubs', '4'), c('hearts', 'A')]
const declarerView = () =>
  tableView(
    baseGame({
      status: 'exchanging', declarer: 0,
      players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
    }),
    'p0',
  )

describe('ExchangePanel', () => {
  it('shows a waiting message to non-declarers', () => {
    const view = tableView(baseGame({ status: 'exchanging', declarer: 0 }), 'p1')
    render(<ExchangePanel view={view} onDiscard={vi.fn()} />)
    expect(screen.getByText(/waiting for the declarer/i)).toBeInTheDocument()
  })

  it('enables confirm only at exactly 3 selected and submits them', async () => {
    const onDiscard = vi.fn()
    render(<ExchangePanel view={declarerView()} onDiscard={onDiscard} />)
    const confirm = () => screen.getByRole('button', { name: /^Discard/ })
    expect(confirm()).toBeDisabled()
    await userEvent.click(screen.getByTestId('hand-card-clubs-2'))
    await userEvent.click(screen.getByTestId('hand-card-clubs-3'))
    expect(confirm()).toBeDisabled()
    await userEvent.click(screen.getByTestId('hand-card-clubs-4'))
    expect(confirm()).toBeEnabled()
    await userEvent.click(confirm())
    expect(onDiscard).toHaveBeenCalledWith([c('clubs', '2'), c('clubs', '3'), c('clubs', '4')])
  })

  it('clicking a selected card deselects it', async () => {
    render(<ExchangePanel view={declarerView()} onDiscard={vi.fn()} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-2'))
    expect(screen.getByTestId('hand-card-clubs-2')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByTestId('hand-card-clubs-2'))
    expect(screen.getByTestId('hand-card-clubs-2')).toHaveAttribute('aria-pressed', 'false')
  })
})
