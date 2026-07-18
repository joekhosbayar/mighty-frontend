import { useState, type FormEvent } from 'react'

export interface AuthScreenProps {
  error: string | null
  onLogin(username: string, password: string): void
  onSignup(username: string, password: string, email: string): void
}

export function AuthScreen({ error, onLogin, onSignup }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') onLogin(username, password)
    else onSignup(username, password, email)
  }

  return (
    <main className="auth" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, color: 'var(--color-accent)' }}>Mighty</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>STRATEGIC TRICK-TAKING</p>
      </div>
      <div className="panel" style={{ width: '100%', maxWidth: '400px' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        </form>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)' }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </div>
    </main>
  )
}
