import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'
import * as amplifyAuth from 'aws-amplify/auth'

vi.mock('aws-amplify/auth', () => ({
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
}))

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

  it('transitions to confirm mode and submits verification code', async () => {
    const onLogin = vi.fn()
    const onSignup = vi.fn().mockResolvedValue(true)

    render(<AuthScreen error={null} onLogin={onLogin} onSignup={onSignup} />)
    
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    
    await userEvent.type(screen.getByLabelText('Username'), 'charlie')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'charlie@x.io')
    
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    
    expect(onSignup).toHaveBeenCalledWith('charlie', 'pw123', 'charlie@x.io')

    const codeInput = await screen.findByLabelText('Verification Code')
    await userEvent.type(codeInput, '123456')
    
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    
    expect(amplifyAuth.confirmSignUp).toHaveBeenCalledWith({ username: 'charlie', confirmationCode: '123456' })
    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('charlie', 'pw123')
    })
  })

  it('resends verification code', async () => {
    const onSignup = vi.fn().mockResolvedValue(true)
    render(<AuthScreen error={null} onLogin={vi.fn()} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    await userEvent.type(screen.getByLabelText('Username'), 'charlie')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'charlie@x.io')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    
    await userEvent.click(screen.getByRole('button', { name: 'Resend Code' }))
    expect(amplifyAuth.resendSignUpCode).toHaveBeenCalledWith({ username: 'charlie' })
    expect(await screen.findByRole('status')).toHaveTextContent('Code resent successfully')
  })

  it('can go back to signup from confirm mode', async () => {
    const onSignup = vi.fn().mockResolvedValue(true)
    render(<AuthScreen error={null} onLogin={vi.fn()} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    await userEvent.type(screen.getByLabelText('Username'), 'charlie')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'charlie@x.io')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    
    await userEvent.click(screen.getByRole('button', { name: 'Back to Sign up' }))
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
  })
})
