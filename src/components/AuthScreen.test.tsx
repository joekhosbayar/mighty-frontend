import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'
import * as amplifyAuth from 'aws-amplify/auth'

vi.mock('aws-amplify/auth', () => ({
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  confirmSignIn: vi.fn(),
  setUpTOTP: vi.fn(),
}))

describe('AuthScreen', () => {
  it('submits login with username and password', async () => {
    const onLogin = vi.fn()
    render(<AuthScreen error={null} onLogin={onLogin} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Username'), 'alice')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(onLogin).toHaveBeenCalledWith('alice', 'pw123')
  })

  it('switches to signup mode and submits with email', async () => {
    const onSignup = vi.fn()
    render(<AuthScreen error={null} onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    await userEvent.type(screen.getByLabelText('Username'), 'bob')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'bob@x.io')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(onSignup).toHaveBeenCalledWith('bob', 'pw123', 'bob@x.io')
  })

  it('shows the error as an alert', () => {
    render(<AuthScreen error="invalid credentials" onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('invalid credentials')
  })

  it('transitions to confirm mode and submits verification code', async () => {
    const onLogin = vi.fn()
    const onSignup = vi.fn().mockResolvedValue(true)

    render(<AuthScreen error={null} onLogin={onLogin} onLoginSuccess={vi.fn()} onSignup={onSignup} />)
    
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
    render(<AuthScreen error={null} onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={onSignup} />)
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
    render(<AuthScreen error={null} onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    await userEvent.type(screen.getByLabelText('Username'), 'charlie')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'charlie@x.io')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    
    await userEvent.click(screen.getByRole('button', { name: 'Back to Sign up' }))
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
  })

  it('switches to forgot mode and submits username for reset', async () => {
    render(<AuthScreen error={null} onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    
    await userEvent.type(screen.getByLabelText('Username'), 'dave')
    
    const resetSpy = vi.spyOn(amplifyAuth, 'resetPassword').mockResolvedValue({
      isPasswordReset: false,
      nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' }
    } as any)
    
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Code' }))
    
    expect(resetSpy).toHaveBeenCalledWith({ username: 'dave' })
    
    // Should transition to 'reset' mode
    expect(await screen.findByLabelText('Verification Code')).toBeInTheDocument()
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
  })

  it('submits code and new password in reset mode', async () => {
    const onLogin = vi.fn()
    render(<AuthScreen error={null} onLogin={onLogin} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await userEvent.type(screen.getByLabelText('Username'), 'eve')
    
    vi.spyOn(amplifyAuth, 'resetPassword').mockResolvedValue({
      isPasswordReset: false,
      nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' }
    } as any)
    
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Code' }))
    
    const codeInput = await screen.findByLabelText('Verification Code')
    await userEvent.type(codeInput, '789012')
    await userEvent.type(screen.getByLabelText('New Password'), 'newpw123')
    
    const confirmSpy = vi.spyOn(amplifyAuth, 'confirmResetPassword').mockResolvedValue(undefined)
    
    await userEvent.click(screen.getByRole('button', { name: 'Reset Password' }))
    
    expect(confirmSpy).toHaveBeenCalledWith({ username: 'eve', confirmationCode: '789012', newPassword: 'newpw123' })
    
    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('eve', 'newpw123')
    })
  })

  it('shows error when resetPassword fails', async () => {
    render(<AuthScreen error={null} onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await userEvent.type(screen.getByLabelText('Username'), 'failuser')
    vi.spyOn(amplifyAuth, 'resetPassword').mockRejectedValueOnce(new Error('User not found'))
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('User not found')
  })

  it('shows error when confirmResetPassword fails', async () => {
    render(<AuthScreen error={null} onLogin={vi.fn()} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await userEvent.type(screen.getByLabelText('Username'), 'failuser')
    vi.spyOn(amplifyAuth, 'resetPassword').mockResolvedValue({
      isPasswordReset: false,
      nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' }
    } as any)
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Code' }))
    const codeInput = await screen.findByLabelText('Verification Code')
    await userEvent.type(codeInput, '789012')
    await userEvent.type(screen.getByLabelText('New Password'), 'newpw123')
    
    vi.spyOn(amplifyAuth, 'confirmResetPassword').mockRejectedValueOnce(new Error('Invalid code'))
    await userEvent.click(screen.getByRole('button', { name: 'Reset Password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code')
  })

  it('handles MFA selection and transitions to TOTP setup', async () => {
    const onLogin = vi.fn().mockResolvedValue({
      nextStep: { signInStep: 'CONTINUE_SIGN_IN_WITH_MFA_SELECTION' }
    })
    
    vi.spyOn(amplifyAuth, 'confirmSignIn').mockResolvedValueOnce({
      isSignedIn: false,
      nextStep: { signInStep: 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP' }
    } as any)
    
    vi.spyOn(amplifyAuth, 'setUpTOTP').mockResolvedValueOnce({
      getSetupUri: () => ({ toString: () => 'otpauth://totp/test' })
    } as any)

    render(<AuthScreen error={null} onLogin={onLogin} onLoginSuccess={vi.fn()} onSignup={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Username'), 'mfauser')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      expect(amplifyAuth.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: 'TOTP' })
      expect(amplifyAuth.setUpTOTP).toHaveBeenCalled()
      expect(screen.getByText(/Copy this URI/)).toBeInTheDocument()
      expect(screen.getByText('otpauth://totp/test')).toBeInTheDocument()
    })
  })

  it('handles submitting MFA code during TOTP setup', async () => {
    const onLogin = vi.fn().mockResolvedValue({
      nextStep: { signInStep: 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP' }
    })
    const onLoginSuccess = vi.fn()
    
    vi.spyOn(amplifyAuth, 'setUpTOTP').mockResolvedValueOnce({
      getSetupUri: () => ({ toString: () => 'otpauth://totp/test' })
    } as any)

    render(<AuthScreen error={null} onLogin={onLogin} onLoginSuccess={onLoginSuccess} onSignup={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Username'), 'mfauser')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      expect(screen.getByText('otpauth://totp/test')).toBeInTheDocument()
    })

    vi.spyOn(amplifyAuth, 'confirmSignIn').mockResolvedValueOnce({
      isSignedIn: true,
      nextStep: { signInStep: 'DONE' }
    } as any)

    const codeInput = screen.getByLabelText('Authenticator Code')
    await userEvent.type(codeInput, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(amplifyAuth.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '123456' })
    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled()
    })
  })

  it('transitions to software token MFA and confirms', async () => {
    const onLogin = vi.fn().mockResolvedValue({
      nextStep: { signInStep: 'CONTINUE_SIGN_IN_WITH_SOFTWARE_TOKEN_MFA' }
    })
    const onLoginSuccess = vi.fn()

    render(<AuthScreen error={null} onLogin={onLogin} onLoginSuccess={onLoginSuccess} onSignup={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Username'), 'mfauser')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Authenticator Code')).toBeInTheDocument()
      expect(screen.queryByText(/Copy this URI/)).not.toBeInTheDocument()
    })

    vi.spyOn(amplifyAuth, 'confirmSignIn').mockResolvedValueOnce({
      isSignedIn: true,
      nextStep: { signInStep: 'DONE' }
    } as any)

    const codeInput = screen.getByLabelText('Authenticator Code')
    await userEvent.type(codeInput, '654321')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(amplifyAuth.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '654321' })
    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled()
    })
  })
})
