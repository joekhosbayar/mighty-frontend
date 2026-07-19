// src/components/LandingScreen.tsx
import { Link } from 'react-router';

export function LandingScreen() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Left Pane */}
      <div style={{ flex: 2, overflowY: 'auto', padding: '2rem', borderRight: '1px solid var(--color-border)' }}>
        <div style={{ background: 'var(--color-surface-hover)', height: '200px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '4rem', color: 'var(--color-accent)', margin: 0 }}>MIGHTY</h1>
        </div>
        
        <h2>Rulebook</h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          Mighty is a highly strategic 5-player trick-taking game. The game consists of a bidding phase, a friend-calling phase, and the play phase. Your goal is to capture point cards (A, K, 10, J, Q) to meet your bid.
        </p>
        
        <h2>Scoring</h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          Declarers win by meeting their bid. Failing costs heavily. Winning with more tricks yields extra points.
        </p>
      </div>

      {/* Right Pane */}
      <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', background: 'var(--color-surface)' }}>
        <Link to="/login" style={{ textDecoration: 'none' }}>
          <button style={{ width: '100%', background: 'var(--color-accent)', color: 'var(--color-ink)', padding: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
            Log In to Play
          </button>
        </Link>
        
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Active Games</h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>Log in to view and join the open tables.</p>
        </div>
      </div>
    </div>
  );
}
