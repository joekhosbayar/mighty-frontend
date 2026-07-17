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
    <main className="auth">
      <h1>Mighty</h1>
      <form onSubmit={submit}>
        <label>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {mode === 'signup' && (
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <button type="submit">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      </form>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </main>
  )
}
