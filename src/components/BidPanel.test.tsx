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
    await userEvent.selectOptions(screen.getByLabelText('Tricks'), '5')
    await userEvent.click(screen.getByRole('button', { name: '♠ 5' }))
    expect(onBid).toHaveBeenCalledWith({ points: 5, suit: 'spades', is_no_trump: false })
  })

  it('sends a no-trump bid with suit none', async () => {
    const onBid = vi.fn()
    render(<BidPanel view={biddingView()} onBid={onBid} onPass={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'NT 3' }))
    expect(onBid).toHaveBeenCalledWith({ points: 3, suit: 'none', is_no_trump: true })
  })

  it('disables bids that do not beat the current bid', () => {
    const view = biddingView({ current_bid: bid('p1', 3, 'hearts'), bids: [bid('p1', 3, 'hearts')] })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByRole('button', { name: '♣ 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '♠ 3' })).toBeEnabled()
  })

  it('disables everything when it is not my turn', () => {
    render(<BidPanel view={biddingView({ current_turn: 1 })} onBid={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pass' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '♠ 3' })).toBeDisabled()
  })

  it('passes and shows bid history', async () => {
    const onPass = vi.fn()
    const view = biddingView({ bids: [bid('p1', 4, 'clubs')] })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={onPass} />)
    expect(screen.getByTestId('bid-history')).toHaveTextContent('p1: 4 clubs')
    await userEvent.click(screen.getByRole('button', { name: 'Pass' }))
    expect(onPass).toHaveBeenCalled()
  })
})
