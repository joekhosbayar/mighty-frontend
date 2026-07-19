import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './test-utils'
import { makeTestDeps, TEST_TOKEN } from '../core/testing/deps'

describe('routing shell', () => {
  it('redirects an unauthenticated deep link to /', async () => {
    const { deps } = makeTestDeps()
    renderApp(deps, ['/lobby'])
    expect(await screen.findByRole('heading', { name: 'MIGHTY' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log In to Play' })).toBeInTheDocument()
  })

  it('redirects an authenticated user away from /login to the lobby', async () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    renderApp(deps, ['/login'])
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
  })

  it('creating a table navigates to its game URL', async () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    const { router } = renderApp(deps, ['/lobby'])
    await userEvent.click(await screen.findByRole('button', { name: 'Create Table' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/games/g7'))
  })

  it('joining a table navigates to its game URL', async () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    const { router } = renderApp(deps, ['/lobby'])
    await userEvent.click(await screen.findByRole('button', { name: 'Join Table' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/games/gA'))
  })
})
