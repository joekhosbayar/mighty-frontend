import { useState, type FormEvent } from 'react'
import { confirmSignUp, resendSignUpCode, resetPassword, confirmResetPassword, confirmSignIn, setUpTOTP, type SignInOutput } from 'aws-amplify/auth'

export interface AuthScreenProps {
  error: string | null
  onLogin(username: string, password: string): Promise<boolean | SignInOutput>
  onLoginSuccess(): void
  onSignup(username: string, password: string, email: string): void | boolean | Promise<void | boolean>
}

export function AuthScreen({ error, onLogin, onLoginSuccess, onSignup }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'confirm' | 'forgot' | 'reset' | 'totp_setup' | 'mfa_confirm'>('login')
  const [totpUri, setTotpUri] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const processSignInStep = async (res: boolean | SignInOutput) => {
    if (typeof res !== 'boolean' && res?.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_MFA_SELECTION') {
      try {
        res = await confirmSignIn({ challengeResponse: 'TOTP' })
      } catch (err: unknown) {
        setConfirmError(err instanceof Error && err.message ? err.message : 'Failed to select MFA')
        return
      }
    }
    if (typeof res !== 'boolean' && res?.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
      try {
        const totpSetupDetails = await setUpTOTP()
        setTotpUri(totpSetupDetails.getSetupUri('Mighty').toString())
        setCode('')
        setMode('totp_setup')
      } catch (err: unknown) {
        setConfirmError(err instanceof Error && err.message ? err.message : 'Failed to setup TOTP')
      }
    } else if (typeof res !== 'boolean' && res?.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_SOFTWARE_TOKEN_MFA') {
      setMode('mfa_confirm')
      setCode('')
    } else if (typeof res !== 'boolean' && res?.nextStep?.signInStep === 'DONE') {
      onLoginSuccess()
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      const res = await onLogin(username, password)
      await processSignInStep(res)
    } else if (mode === 'signup') {
      const result = await onSignup(username, password, email)
      if (result) setMode('confirm')
    }
  }

  const handleMfaConfirm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setConfirmError(null)
      const res = await confirmSignIn({ challengeResponse: code })
      await processSignInStep(res)
    } catch (err: unknown) {
      setConfirmError(err instanceof Error && err.message ? err.message : 'Verification failed')
    }
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setConfirmError(null)
      setConfirmMessage(null)
      await confirmSignUp({ username, confirmationCode: code })
      const res = await onLogin(username, password)
      await processSignInStep(res)
    } catch (err: unknown) {
      setConfirmError(err instanceof Error && err.message ? err.message : 'Confirmation failed')
    }
  }

  const handleResend = async () => {
    try {
      setConfirmError(null)
      setConfirmMessage(null)
      await resendSignUpCode({ username })
      setConfirmMessage('Code resent successfully')
    } catch (err: unknown) {
      setConfirmError(err instanceof Error && err.message ? err.message : 'Failed to resend code')
    }
  }

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setConfirmError(null)
      setConfirmMessage(null)
      await resetPassword({ username })
      setCode('')
      setMode('reset')
    } catch (err: unknown) {
      setConfirmError(err instanceof Error && err.message ? err.message : 'Failed to send reset code')
    }
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setConfirmError(null)
      setConfirmMessage(null)
      await confirmResetPassword({ username, confirmationCode: code, newPassword })
      const res = await onLogin(username, newPassword)
      await processSignInStep(res)
    } catch (err: unknown) {
      setConfirmError(err instanceof Error && err.message ? err.message : 'Failed to reset password')
    }
  }

  const handleSubmit = (e: FormEvent) => {
    if (mode === 'confirm') return handleConfirm(e)
    if (mode === 'forgot') return handleForgot(e)
    if (mode === 'reset') return handleReset(e)
    if (mode === 'totp_setup' || mode === 'mfa_confirm') return handleMfaConfirm(e)
    return submit(e)
  }

  return (
    <main className="auth" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, color: 'var(--color-accent)' }}>Mighty</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>STRATEGIC TRICK-TAKING</p>
      </div>
      <div className="panel" style={{ width: '100%', maxWidth: '400px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'confirm' ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Verification Code
                <input value={code} onChange={e => setCode(e.target.value)} />
              </label>
              {confirmMessage && <p role="status" style={{ color: 'var(--color-accent)' }}>{confirmMessage}</p>}
              {confirmError && <p role="alert">{confirmError}</p>}
              {error && <p role="alert">{error}</p>}
              <button type="submit" style={{ marginTop: '1rem', background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}>
                Confirm
              </button>
              <button type="button" onClick={handleResend} style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Resend Code
              </button>
            </>
          ) : mode === 'forgot' ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Username
                <input value={username} onChange={e => setUsername(e.target.value)} />
              </label>
              {confirmError && <p role="alert">{confirmError}</p>}
              {error && <p role="alert">{error}</p>}
              <button type="submit" style={{ marginTop: '1rem', background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}>
                Send Reset Code
              </button>
            </>
          ) : mode === 'reset' ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Verification Code
                <input value={code} onChange={e => setCode(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                New Password
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </label>
              {confirmError && <p role="alert">{confirmError}</p>}
              {error && <p role="alert">{error}</p>}
              <button type="submit" style={{ marginTop: '1rem', background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}>
                Reset Password
              </button>
            </>
          ) : mode === 'totp_setup' || mode === 'mfa_confirm' ? (
            <>
              {mode === 'totp_setup' && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <p>Copy this URI to your authenticator app:</p>
                  <div style={{ wordBreak: 'break-all', background: '#f4f4f5', color: '#000', padding: '1rem', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                    {totpUri}
                  </div>
                </div>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Authenticator Code
                <input value={code} onChange={e => setCode(e.target.value)} />
              </label>
              {confirmError && <p role="alert">{confirmError}</p>}
              {error && <p role="alert">{error}</p>}
              <button type="submit" style={{ marginTop: '1rem', background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}>
                Verify
              </button>
            </>
          ) : (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Username
                <input value={username} onChange={e => setUsername(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Password
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </label>
              {mode === 'signup' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  Email
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </label>
              )}
              {error && <p role="alert">{error}</p>}
              <button type="submit" style={{ marginTop: '1rem', background: 'var(--color-accent)', color: 'var(--color-ink)', fontWeight: 'bold' }}>
                {mode === 'login' ? 'Log in' : 'Sign up'}
              </button>
              {mode === 'login' && (
                <button type="button" onClick={() => setMode('forgot')} style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}>
                  Forgot password?
                </button>
              )}
            </>
          )}
        </form>
        {mode === 'login' || mode === 'signup' ? (
          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        ) : (
          <button type="button" onClick={() => setMode(mode === 'confirm' ? 'signup' : 'login')} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {mode === 'confirm' ? 'Back to Sign up' : 'Back to Log in'}
          </button>
        )}
      </div>
    </main>
  )
}
