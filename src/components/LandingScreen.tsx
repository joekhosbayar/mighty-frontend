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

        <h2>Card Play Restrictions</h2>
        <ul className="landing-restrictions">
          <li><strong>First Trick (Leading):</strong> You cannot lead the Joker or the Mighty. You cannot lead a Trump card unless you only hold Trump and special cards.</li>
          <li><strong>First Trick (Following):</strong> You cannot play the Joker. You cannot play the Mighty unless its base suit was led AND it is your only card in that suit.</li>
          <li><strong>Late Game (Anti-Hoarding):</strong> The Mighty and Joker lose their power on the final trick. To prevent hoarding, you are forced to play them early: with 3 cards left in hand, if you hold both, you MUST play one. With 2 cards left, if you hold either, you MUST play it.</li>
        </ul>

        <h2>10-Trick Tutorial (Example Game)</h2>
        <div className="landing-tutorial">
          <div><strong>1. The First Lead:</strong> The Declarer leads. Trump cannot be led. The Mighty cannot be played (unless void in the led suit). The Joker loses its power.</div>
          <div><strong>2. Following Suit:</strong> Players must follow the led suit. Highest card wins. Point cards (A, K, Q, J, 10) won are captured by the trick winner.</div>
          <div><strong>3. Trumping:</strong> A player who is void in the led suit plays a Trump card. Trumps beat any off-suit cards, regardless of rank.</div>
          <div><strong>4. The Friend Revealed:</strong> A player plays the Declarer's "Called Card". Their identity is now known, and the two explicitly work together to capture points.</div>
          <div><strong>5. Sloughing Points:</strong> A player who is void in the led suit throws an off-suit point card to their partner, who is currently winning the trick.</div>
          <div><strong>6. The Joker Caller (Ripper):</strong> A player leads the Joker Caller (♣3). The player holding the Joker is now forced to play it!</div>
          <div><strong>7. The Mighty's Defense:</strong> The Joker was forced out, but that player ALSO holds the Mighty! They play the Mighty instead, saving their Joker and winning the trick.</div>
          <div><strong>8. The Joker's Revenge:</strong> The Joker is finally played. It beats everything except the Mighty. Since the Mighty is already out of the game (played in Trick 7), the Joker is guaranteed to win.</div>
          <div><strong>9. Drawing Trumps:</strong> The Declarer leads high Trumps to exhaust the opponents' remaining trumps, ensuring their off-suit winners are safe.</div>
          <div><strong>10. The Final Trick:</strong> The Joker loses all its power again! Any remaining point cards are heavily contested as the final trick resolves.</div>
        </div>
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
