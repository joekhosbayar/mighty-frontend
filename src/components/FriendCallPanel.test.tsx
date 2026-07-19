import { fireEvent, render, screen } from '@testing-library/react'
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
    await userEvent.click(screen.getByRole('button', { name: 'Call A of hearts' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'hearts', rank: 'A' })
  })

  it('calls a chosen suit and rank', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} onNoFriend={vi.fn()} />)
    
    const suitWheel = screen.getByRole('listbox', { name: 'Suit' })
    const rankWheel = screen.getByRole('listbox', { name: 'Rank' })

    // Use keyboard navigation to avoid hardcoding scroll offsets
    // Suit starts at 'hearts' (idx 1). We want 'diamonds' (idx 2).
    fireEvent.keyDown(suitWheel, { key: 'ArrowDown' })
    
    // Rank starts at 'A' (idx 0). We want 'K' (idx 1).
    fireEvent.keyDown(rankWheel, { key: 'ArrowDown' })

    await userEvent.click(screen.getByRole('button', { name: 'Call K of diamonds' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'diamonds', rank: 'K' })
  })

  it('calls the joker', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} onNoFriend={vi.fn()} />)
    
    const suitWheel = screen.getByRole('listbox', { name: 'Suit' })
    
    // Suit starts at 'hearts'. We want 'none' (Joker)
    // 'hearts'(1) -> 'diamonds'(2) -> 'clubs'(3) -> 'none'(4)
    fireEvent.keyDown(suitWheel, { key: 'ArrowDown' })
    fireEvent.keyDown(suitWheel, { key: 'ArrowDown' })
    fireEvent.keyDown(suitWheel, { key: 'ArrowDown' })

    await userEvent.click(screen.getByRole('button', { name: 'Call Joker' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'none', rank: 'Joker' })
  })

  it('declares no friend', async () => {
    const onNoFriend = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={vi.fn()} onNoFriend={onNoFriend} />)
    await userEvent.click(screen.getByRole('button', { name: /play alone/i }))
    expect(onNoFriend).toHaveBeenCalled()
  })
})
