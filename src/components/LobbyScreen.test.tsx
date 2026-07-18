import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LobbyScreen } from './LobbyScreen'
import { baseGame, player } from '../core/testing/builders'

describe('LobbyScreen', () => {
  const games = [
    baseGame({ id: 'g1', status: 'waiting', players: [player(0), player(1), null, null, null], created_at: '2026-07-17T22:43:52.453Z' }),
  ]

  it('lists waiting games with player counts and joins on click', async () => {
    const onJoin = vi.fn()
    render(
      <LobbyScreen games={games} username="alice" onCreate={vi.fn()} onJoin={onJoin}
        onRefresh={vi.fn()} onLogout={vi.fn()} />,
    )
    expect(screen.getByText(/Table g1/)).toBeInTheDocument()
    expect(screen.getByText(/2\/5 seated/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Join Table' }))
    expect(onJoin).toHaveBeenCalledWith('g1')
  })

  it('refreshes on mount and then every 3 seconds', () => {
    vi.useFakeTimers()
    try {
      const onRefresh = vi.fn()
      const { unmount } = render(
        <LobbyScreen games={[]} username="alice" onCreate={vi.fn()} onJoin={vi.fn()}
          onRefresh={onRefresh} onLogout={vi.fn()} />,
      )
      expect(onRefresh).toHaveBeenCalledTimes(1)
      act(() => vi.advanceTimersByTime(3000))
      expect(onRefresh).toHaveBeenCalledTimes(2)
      act(() => vi.advanceTimersByTime(6000))
      expect(onRefresh).toHaveBeenCalledTimes(4)
      unmount()
      act(() => vi.advanceTimersByTime(9000))
      expect(onRefresh).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('creates a game', async () => {
    const onCreate = vi.fn()
    render(
      <LobbyScreen games={[]} username="alice" onCreate={onCreate} onJoin={vi.fn()}
        onRefresh={vi.fn()} onLogout={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create Table' }))
    expect(onCreate).toHaveBeenCalled()
  })
})
