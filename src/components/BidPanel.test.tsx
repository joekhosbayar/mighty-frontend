import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BidPanel } from './BidPanel'
import { tableView } from '../core/view'
import { baseGame, bid } from '../core/testing/builders'

const biddingView = (over = {}) =>
  tableView(baseGame({ status: 'bidding', current_turn: 0, ...over }), 'p0')

describe('BidPanel', () => {
  it('sends a suit bid with the chosen points', async () => {
    const onBid = vi.fn()
    render(<BidPanel view={biddingView()} onBid={onBid} onPass={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Tricks:'), '15')
    await userEvent.click(screen.getByRole('button', { name: '♠ 15' }))
    expect(onBid).toHaveBeenCalledWith({ points: 15, suit: 'spades', is_no_trump: false })
  })

  it('sends a no-trump bid with suit none', async () => {
    const onBid = vi.fn()
    render(<BidPanel view={biddingView()} onBid={onBid} onPass={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'NT 13' }))
    expect(onBid).toHaveBeenCalledWith({ points: 13, suit: 'none', is_no_trump: true })
  })

  it('disables bids that do not beat the current bid', async () => {
    const view = biddingView({ current_bid: bid('p1', 13, 'hearts'), bids: [bid('p1', 13, 'hearts')] })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByRole('button', { name: '♣ 13' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '♠ 13' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Tricks:'), '14')
    expect(screen.getByRole('button', { name: '♠ 14' })).toBeEnabled()
  })

  it('disables everything when it is not my turn', () => {
    render(<BidPanel view={biddingView({ current_turn: 1 })} onBid={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pass' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '♠ 13' })).toBeDisabled()
  })

  it('passes and shows bid history', async () => {
    const onPass = vi.fn()
    const view = biddingView({ bids: [bid('p1', 14, 'clubs')] })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={onPass} />)
    expect(screen.getByTestId('bid-history')).toHaveTextContent('p1: 14 clubs')
    await userEvent.click(screen.getByRole('button', { name: 'Pass' }))
    expect(onPass).toHaveBeenCalled()
  })

  it('offers minimum bid 4 for a four-player game', () => {
    const view = biddingView({ config: { num_players: 4, allow_joker_partner: true, fail_dist: 'equal_split' } })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={vi.fn()} />)
    const options = screen.getAllByRole('option').map(o => Number((o as HTMLOptionElement).value))
    expect(Math.min(...options)).toBe(14)
  })

  it('offers minimum bid 3 for a five-player game', () => {
    render(<BidPanel view={biddingView()} onBid={vi.fn()} onPass={vi.fn()} />)
    const options = screen.getAllByRole('option').map(o => Number((o as HTMLOptionElement).value))
    expect(Math.min(...options)).toBe(13)
  })
})
