import { useState, type FormEvent } from 'react'
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'

export interface AuthScreenProps {
  error: string | null
  onLogin(username: string, password: string): void
  onSignup(username: string, password: string, email: string): void | boolean | Promise<void | boolean>
}

export function AuthScreen({ error, onLogin, onSignup }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'confirm'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') onLogin(username, password)
    else if (mode === 'signup') {
      const result = await onSignup(username, password, email)
      if (result) setMode('confirm')
    }
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setConfirmError(null)
      setConfirmMessage(null)
      await confirmSignUp({ username, confirmationCode: code })
      onLogin(username, password)
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

  return (
    <main className="auth" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, color: 'var(--color-accent)' }}>Mighty</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>STRATEGIC TRICK-TAKING</p>
      </div>
      <div className="panel" style={{ width: '100%', maxWidth: '400px' }}>
        <form onSubmit={mode === 'confirm' ? handleConfirm : submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            </>
          )}
        </form>
        {mode !== 'confirm' ? (
          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        ) : (
          <button type="button" onClick={() => setMode('signup')} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            Back to Sign up
          </button>
        )}
      </div>
    </main>
  )
}
