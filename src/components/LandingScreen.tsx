// src/components/LandingScreen.tsx
import { Link } from 'react-router';

export function LandingScreen() {
  return (
    <div className="landing-container">
      {/* Left Pane */}
      <div className="landing-left-pane">
        <div className="landing-hero">
          <h1 className="landing-title">MIGHTY</h1>
        </div>
        
        <h2>Rulebook</h2>
        <p className="landing-text">
          Mighty is a highly strategic 5-player trick-taking game. The game consists of a bidding phase, a friend-calling phase, and the play phase. Your goal is to capture point cards (A, K, 10, J, Q) to meet your bid.
        </p>
        
        <h2>Scoring</h2>
        <p className="landing-text">
          Declarers win by meeting their bid. Failing costs heavily. Winning with more tricks yields extra points.
        </p>
      </div>

      {/* Right Pane */}
      <div className="landing-right-pane">
        <Link to="/login" className="landing-login-btn">
          Log In to Play
        </Link>
        
        <div className="landing-active-games">
          <h3>Active Games</h3>
          <p className="landing-text">Log in to view and join the open tables.</p>
        </div>
      </div>
    </div>
  );
}
