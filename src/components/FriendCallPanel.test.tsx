import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FriendCallPanel } from './FriendCallPanel'
import { tableView } from '../core/view'
import { baseGame } from '../core/testing/builders'

const callingView = (playerId = 'p0') =>
  tableView(baseGame({ status: 'calling', declarer: 0 }), playerId)

describe('FriendCallPanel', () => {
  it('shows a waiting message to non-declarers', () => {
    render(<FriendCallPanel view={callingView('p1')} onCallPartner={vi.fn()} onNoFriend={vi.fn()} />)
    expect(screen.getByText(/waiting for the declarer/i)).toBeInTheDocument()
  })

  it('calls the default hearts ace', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} onNoFriend={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Call' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'hearts', rank: 'A' })
  })

  it('calls a chosen suit and rank', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} onNoFriend={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Suit'), 'diamonds')
    await userEvent.selectOptions(screen.getByLabelText('Rank'), 'K')
    await userEvent.click(screen.getByRole('button', { name: 'Call' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'diamonds', rank: 'K' })
  })

  it('declares no friend', async () => {
    const onNoFriend = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={vi.fn()} onNoFriend={onNoFriend} />)
    await userEvent.click(screen.getByRole('button', { name: /play alone/i }))
    expect(onNoFriend).toHaveBeenCalled()
  })
})
