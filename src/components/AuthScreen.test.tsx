import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'

describe('AuthScreen', () => {
  it('submits login with username and password', async () => {
    const onLogin = vi.fn()
    render(<AuthScreen error={null} onLogin={onLogin} onSignup={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Username'), 'alice')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(onLogin).toHaveBeenCalledWith('alice', 'pw123')
  })

  it('switches to signup mode and submits with email', async () => {
    const onSignup = vi.fn()
    render(<AuthScreen error={null} onLogin={vi.fn()} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    await userEvent.type(screen.getByLabelText('Username'), 'bob')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'bob@x.io')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(onSignup).toHaveBeenCalledWith('bob', 'pw123', 'bob@x.io')
  })

  it('shows the error as an alert', () => {
    render(<AuthScreen error="invalid credentials" onLogin={vi.fn()} onSignup={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('invalid credentials')
  })
})
