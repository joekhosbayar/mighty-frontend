import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './test-utils'
import { makeTestDeps } from '../core/testing/deps'

// With preferredChallenge: 'PASSWORD_SRP', Amplify completes password auth in a
// single round-trip and signIn resolves to DONE for a non-MFA user. This is the
// real production path — the store then syncs the token and the app routes to
// the lobby. (The store tests mocked signIn->DONE but never rendered the routes,
// so the LoginRoute wiring that broke in production was never exercised.)
vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(async () => ({ isSignedIn: true, nextStep: { signInStep: 'DONE' } })),
  confirmSignIn: vi.fn(),
  signUp: vi.fn(async () => ({})),
  signOut: vi.fn(async () => {}),
  fetchAuthSession: vi.fn(async () => ({ tokens: { accessToken: { toString: () => 'header.payload.sig' } } })),
  fetchUserAttributes: vi.fn(async () => ({ sub: 'u1', preferred_username: 'alice' })),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  setUpTOTP: vi.fn(),
  resendSignUpCode: vi.fn(),
}))

describe('LoginRoute', () => {
  it('lands in the lobby after a successful password login', async () => {
    const { deps } = makeTestDeps()
    renderApp(deps, ['/login'])

    await userEvent.type(screen.getByLabelText('Email'), 'alice@x.io')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    // The session token must be synced into the store and the user routed to the lobby.
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
  })

  it('requests SRP password auth up front (no first-factor-selection stall)', async () => {
    const { signIn } = await import('aws-amplify/auth')
    const { deps } = makeTestDeps()
    renderApp(deps, ['/login'])

    await userEvent.type(screen.getByLabelText('Email'), 'alice@x.io')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await screen.findByText('Open Tables')
    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ authFlowType: 'USER_AUTH', preferredChallenge: 'PASSWORD_SRP' }),
      }),
    )
  })
})
