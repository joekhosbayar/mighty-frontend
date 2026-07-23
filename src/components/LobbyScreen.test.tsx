import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LobbyScreen } from './LobbyScreen'
import { baseGame, player } from '../core/testing/builders'
import { getTableName } from '../core/names'
import * as amplifyAuth from 'aws-amplify/auth'

vi.mock('aws-amplify/auth', () => ({
  associateWebAuthnCredential: vi.fn(),
  listWebAuthnCredentials: vi.fn(async () => ({ credentials: [] })),
}))

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
    expect(screen.getByText(getTableName('g1'))).toBeInTheDocument()
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

  it('creates a four-player table with chosen fail rule', async () => {
    const onCreate = vi.fn()
    render(
      <LobbyScreen games={[]} username="u" onCreate={onCreate} onJoin={vi.fn()}
        onRefresh={vi.fn()} onLogout={vi.fn()} />,
    )
    await userEvent.selectOptions(screen.getByLabelText(/players/i), '4')
    await userEvent.selectOptions(screen.getByLabelText(/failure/i), 'two_one_split')
    await userEvent.click(screen.getByRole('button', { name: /create table/i }))
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ num_players: 4, fail_dist: 'two_one_split' }),
    )
  })

  it('shows seated count out of configured player count', () => {
    const game = {
      id: 'g', status: 'waiting', config: { num_players: 4, allow_joker_partner: true, fail_dist: 'equal_split' },
      players: [{ id: 'a', name: 'A', seat: 0 }, null, null, null], created_at: new Date().toISOString(),
    } as never
    render(
      <LobbyScreen games={[game]} username="u" onCreate={vi.fn()} onJoin={vi.fn()} onRefresh={vi.fn()} onLogout={vi.fn()} />,
    )
    expect(screen.getByText(/1\/4 seated/)).toBeInTheDocument()
  })

  it('registers passkey when button is clicked', async () => {
    render(
      <LobbyScreen games={[]} username="alice" onCreate={vi.fn()} onJoin={vi.fn()} onRefresh={vi.fn()} onLogout={vi.fn()} />
    )
    
    const associateSpy = vi.spyOn(amplifyAuth, 'associateWebAuthnCredential').mockResolvedValue(undefined)
    
    await userEvent.click(screen.getByRole('button', { name: 'Register Passkey' }))
    
    expect(associateSpy).toHaveBeenCalled()
    expect(await screen.findByText('Passkey registered successfully')).toBeInTheDocument()
  })
})
