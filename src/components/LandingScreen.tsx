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
          Mighty is a high-stakes, 5-player point-trick card game featuring bidding and a "Mystery Friend" partner mechanic. The game consists of a bidding phase, a friend-calling phase, and a 10-trick play phase.
        </p>
        <p className="landing-text">
          Your goal is to capture point cards (A, K, Q, J, and 10 of any suit). There are exactly 20 point cards in the deck. Bids map to a scoring-card target from 13-20. The Declarer chooses the trump suit and secretly calls a friend (partner) by naming a specific card.
        </p>
        <p className="landing-text">
          Watch out for the Magic Cards: The <strong>Mighty</strong> (the strongest card, usually ♠A), the <strong>Joker</strong> (second strongest), and the <strong>Joker Caller</strong> (♣3, which forces the Joker out).
        </p>
        
        <h2>Scoring</h2>
        <p className="landing-text">
          Scores are strictly zero-sum across all five players based on captured scoring cards. Declarers win by meeting their scoring-card target (`bid + 10`).
        </p>
        <p className="landing-text">
          <strong>Success:</strong> Declarer collects +2S, Partner +S, and each opponent pays -S.
          <br/><strong>Failure:</strong> Roles reverse—Declarer pays -2S, Partner -S, and each opponent collects +S.
        </p>
        <p className="landing-text">
          Multipliers (×2) stack for special achievements: running the table (taking all 20 points), back-runs by the defenders, No-Trump contracts, and playing completely alone without a friend.
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
