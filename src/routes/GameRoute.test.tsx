import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from './test-utils'
import { makeTestDeps, myGame, TEST_TOKEN } from '../core/testing/deps'
import { type Http } from '../api/http'

function authedDeps(getGameImpl: Http['getGame']) {
  return makeTestDeps({ getGame: getGameImpl })
}

afterEach(() => vi.restoreAllMocks())

describe('GameRoute resume', () => {
  it('resumes a participant deep link and opens the socket', async () => {
    const { deps, sockets } = authedDeps(vi.fn(async id => myGame({ id, status: 'playing' })))
    const { router } = renderApp(deps, ['/games/g1'], { token: TEST_TOKEN, userId: 'u1', username: 'alice' })
    await waitFor(() => expect(sockets).toHaveLength(1))
    expect(router.state.location.pathname).toBe('/games/g1')
  })

  it('redirects a non-participant to the lobby with a message', async () => {
    const { deps } = authedDeps(vi.fn(async id => makeTestDeps().deps.http.getGame(id))) // default players p0..p4
    const { store } = renderApp(deps, ['/games/g1'], { token: TEST_TOKEN, userId: 'u1', username: 'alice' })
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
    expect(store.getState().lastError).toBe('That game is no longer available')
  })

  it('redirects a finished game to the lobby with the ended message', async () => {
    const { deps } = authedDeps(vi.fn(async id => myGame({ id, status: 'finished' })))
    const { store } = renderApp(deps, ['/games/g1'], { token: TEST_TOKEN, userId: 'u1', username: 'alice' })
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
    expect(store.getState().lastError).toBe('Game has ended')
  })
})

describe('GameRoute leave-guard', () => {
  it('stays in the game when the leave confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { deps, sockets } = authedDeps(vi.fn(async id => myGame({ id, status: 'playing' })))
    const { router } = renderApp(deps, ['/games/g1'], { token: TEST_TOKEN, userId: 'u1', username: 'alice' })
    await waitFor(() => expect(sockets).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Leave Table' }))
    expect(router.state.location.pathname).toBe('/games/g1')
    expect(sockets[0].socket.close).not.toHaveBeenCalled()
  })

  it('leaves and tears down the socket when the leave is confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { deps, sockets } = authedDeps(vi.fn(async id => myGame({ id, status: 'playing' })))
    const { router } = renderApp(deps, ['/games/g1'], { token: TEST_TOKEN, userId: 'u1', username: 'alice' })
    await waitFor(() => expect(sockets).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Leave Table' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/lobby'))
    expect(sockets[0].socket.close).toHaveBeenCalled()
  })
})
