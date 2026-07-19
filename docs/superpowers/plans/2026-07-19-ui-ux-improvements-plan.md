# UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Mighty application's visual appeal and UX by adding animations, better interactions, and a welcoming landing page.

**Architecture:** We are making styling changes for interactions, adding custom components for complex UI (slot carousels), and adjusting logic in existing components to improve UX and fix bugs.

**Tech Stack:** React, CSS, Vite.

## Global Constraints
- Use standard CSS where possible (no heavy external component libraries).
- Code must be cleanly formatted and pass existing lint/test checks.

---

### Task 1: Reactive UI Hover Effects

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: N/A
- Produces: CSS rules for `.mock-button`, `button`, and `.card-physical`

- [ ] **Step 1: Write CSS changes**

```css
/* Add to end of src/styles.css */
button {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.card-physical {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-physical:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  z-index: 10;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style: add hover scale and shadow transitions to buttons and cards"
```

---

### Task 2: Teammate Selection (Vertical Wheels)

**Files:**
- Create: `src/components/SlotWheel.tsx`
- Modify: `src/components/FriendCallPanel.tsx`

**Interfaces:**
- Consumes: `FriendCallPanelProps`
- Produces: Visual slot-machine style selector.

- [ ] **Step 1: Create SlotWheel component**

```tsx
// src/components/SlotWheel.tsx
import { useEffect, useRef } from 'react';

interface SlotWheelProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (val: T) => void;
  disabled?: boolean;
}

export function SlotWheel<T extends string>({ options, value, onChange, disabled }: SlotWheelProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 40;

  useEffect(() => {
    if (containerRef.current) {
      const idx = options.indexOf(value);
      if (idx >= 0) {
        containerRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }
  }, [value, options]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    const scrollCenter = target.scrollTop + ITEM_HEIGHT / 2;
    const idx = Math.max(0, Math.min(options.length - 1, Math.floor(scrollCenter / ITEM_HEIGHT)));
    if (options[idx] !== value) {
      onChange(options[idx]);
    }
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: `${ITEM_HEIGHT * 3}px`,
        overflowY: disabled ? 'hidden' : 'scroll',
        scrollSnapType: 'y mandatory',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        width: '120px'
      }}
      className="slot-wheel"
    >
      <div style={{ height: `${ITEM_HEIGHT}px` }} /> {/* Top padding */}
      {options.map((opt) => (
        <div 
          key={opt}
          style={{
            height: `${ITEM_HEIGHT}px`,
            scrollSnapAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: opt === value ? '1.2rem' : '1rem',
            fontWeight: opt === value ? 'bold' : 'normal',
            color: opt === value ? 'var(--color-ink)' : 'var(--color-text-secondary)',
          }}
        >
          {opt}
        </div>
      ))}
      <div style={{ height: `${ITEM_HEIGHT}px` }} /> {/* Bottom padding */}
    </div>
  );
}
```

- [ ] **Step 2: Update FriendCallPanel.tsx**

```tsx
// Overwrite src/components/FriendCallPanel.tsx
import { useState } from 'react'
import type { Card, Rank, Suit } from '../core/types'
import type { TableView } from '../core/view'
import { SlotWheel } from './SlotWheel'

export interface FriendCallPanelProps {
  view: TableView
  onCallPartner(card: Card): void
  onNoFriend(): void
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs', 'none']
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

export function FriendCallPanel({ view, onCallPartner, onNoFriend }: FriendCallPanelProps) {
  const [suit, setSuit] = useState<Suit>('hearts')
  const [rank, setRank] = useState<Rank>('A')

  if (!view.amDeclarer) {
    return <p className="panel" style={{ textAlign: 'center', margin: '2rem auto', maxWidth: '400px', color: 'var(--color-text-secondary)' }}>Waiting for the declarer to call a friend…</p>
  }

  const isJoker = suit === 'none';

  return (
    <section className="friend-call panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>Call your friend</h2>
      <div style={{ display: 'flex', gap: '2rem', margin: '2rem 0', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span className="label">Suit</span>
          <SlotWheel options={SUITS} value={suit} onChange={setSuit} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <span className="label">Rank</span>
          <SlotWheel options={RANKS} value={rank} onChange={setRank} disabled={isJoker} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onCallPartner(isJoker ? { suit: 'none', rank: 'Joker' } : { suit, rank })} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>
          {isJoker ? 'Call Joker' : `Call ${rank} of ${suit}`}
        </button>
        <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
        <button onClick={onNoFriend} style={{ background: 'transparent' }}>Play alone (no friend, 2× score)</button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '1rem', textAlign: 'center' }}>Calling a card from your own hand means you play alone.</p>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SlotWheel.tsx src/components/FriendCallPanel.tsx
git commit -m "feat: replace friend call dropdowns with vertical slot carousels"
```

---

### Task 3: Bidding Auto-Increment

**Files:**
- Modify: `src/components/BidPanel.tsx`

**Interfaces:**
- Update state initialization logic for minimum bids.

- [ ] **Step 1: Update BidPanel points state logic**

```tsx
// Inside src/components/BidPanel.tsx, replace the state initialization lines (around line 21-23) with:
  const minBid = view.config?.num_players === 4 ? 4 : 3
  
  // Calculate next logical bid ceiling at 10
  const highestCurrentPoints = view.currentBid ? view.currentBid.points : (minBid - 1);
  const startingPoints = Math.min(10, Math.max(minBid, highestCurrentPoints + 1));
  
  // Use state but initialize with the calculated starting points, and add effect to sync
  const [points, setPoints] = useState(startingPoints)
  
  import { useEffect } from 'react';
  useEffect(() => {
    setPoints(Math.min(10, Math.max(minBid, highestCurrentPoints + 1)));
  }, [minBid, highestCurrentPoints]);

  const candidate = (suit: Suit): BidInput => ({ points, suit, is_no_trump: suit === 'none' })
```

*(Note: ensure `useEffect` is imported from 'react' at the top of the file)*

- [ ] **Step 2: Commit**

```bash
git add src/components/BidPanel.tsx
git commit -m "feat: auto-increment bidding menu to next legal minimum bid"
```

---

### Task 4: Trick Order Bug Fix

**Files:**
- Modify: `src/components/PlayArea.tsx`

**Interfaces:**
- Consumes: `view.currentTrick` (array of `PlayedCard`)

- [ ] **Step 1: Fix trick rendering logic**

```tsx
// Inside src/components/PlayArea.tsx, update the `trick-area` div (around line 63)
        <div className="trick-area">
          {view.currentTrick.map((pc, i) => {
            return (
              <div 
                key={`trick-${pc.seat}-${i}`} 
                data-testid={`trick-card-${pc.seat}`}
                style={{ zIndex: i }}
              >
                <PhysicalCard card={pc.card} trump={view.trump} />
              </div>
            )
          })}
        </div>
```
*(This replaces the previous logic that relied on the unordered `view.seats.map` and the `played` map.)*

- [ ] **Step 2: Commit**

```bash
git add src/components/PlayArea.tsx
git commit -m "fix: render trick cards exactly in the order they were played"
```

---

### Task 5: Move Animations (Cards & Bids)

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/PlayArea.tsx`
- Modify: `src/components/BidPanel.tsx`

**Interfaces:**
- Add CSS animations for popups.

- [ ] **Step 1: Add CSS animation rules**

```css
/* Add to src/styles.css */
@keyframes pop-in-out {
  0% { opacity: 0; transform: scale(0.5) translateY(10px); }
  15% { opacity: 1; transform: scale(1.1) translateY(0); }
  25% { opacity: 1; transform: scale(1); }
  80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8) translateY(-10px); }
}

.anim-bubble {
  position: absolute;
  top: -40px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  animation: pop-in-out 1.5s forwards;
  pointer-events: none;
  z-index: 100;
  white-space: nowrap;
}

@keyframes slide-in {
  from { opacity: 0; transform: translateY(50px); }
  to { opacity: 1; transform: translateY(0); }
}

.trick-area > div {
  animation: slide-in 0.3s ease-out;
}
```

- [ ] **Step 2: Implement Bubbles in PlayArea**

*(Note: We will display the most recent bid for a player as a bubble. Since we only want it transient, we will use a small component tracking previous bids to trigger the animation.)*

```tsx
// Add this helper component in src/components/PlayArea.tsx above the PlayArea function:
import { useRef, useEffect } from 'react';
import type { Bid } from '../core/types';

function BidBubble({ seat, bids }: { seat: number, bids: Bid[] }) {
  const myLastBid = bids.filter(b => b.player_idx === seat).pop();
  const [bubble, setBubble] = useState<{ id: number, text: string } | null>(null);
  const lastBidRef = useRef(myLastBid);

  useEffect(() => {
    if (myLastBid && myLastBid !== lastBidRef.current) {
      lastBidRef.current = myLastBid;
      const text = myLastBid.pass ? '🏳️ Pass' : `${myLastBid.points} ${myLastBid.is_no_trump ? 'NT' : myLastBid.suit}`;
      setBubble({ id: Date.now(), text });
      const timer = setTimeout(() => setBubble(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [myLastBid]);

  if (!bubble) return null;
  return <div key={bubble.id} className="anim-bubble">{bubble.text}</div>;
}
```

```tsx
// Inside PlayArea, right below the <div className={`seat-nameplate ${isTurn}`}>
              <div className={`seat-nameplate ${isTurn}`}>
                {s.name ?? 'empty'}
              </div>
              <BidBubble seat={s.seat} bids={view.bids} />
```

- [ ] **Step 3: Commit**

```bash
git add src/styles.css src/components/PlayArea.tsx
git commit -m "feat: add animations for card plays and bidding popups"
```

---

### Task 6: Landing Page Redesign

**Files:**
- Create: `src/components/LandingScreen.tsx`
- Modify: `src/routes/routes.tsx`
- Modify: `src/routes/LoginRoute.tsx`

**Interfaces:**
- Consumes: `AuthScreen` will be placed on the right pane or kept separate. Based on spec, "a prominent Log In button" that goes to the login page is sufficient.

- [ ] **Step 1: Create LandingScreen.tsx**

```tsx
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
```

- [ ] **Step 2: Update Routes**

```tsx
// src/routes/routes.tsx
import { type RouteObject } from 'react-router'
import { LandingScreen } from '../components/LandingScreen'
import { RequireAuth } from './RequireAuth'
import { LoginRoute } from './LoginRoute'
import { LobbyRoute } from './LobbyRoute'
import { GameRoute } from './GameRoute'

export function makeRoutes(): RouteObject[] {
  return [
    { path: '/', element: <LandingScreen /> },
    { path: '/login', element: <LoginRoute /> },
    { path: '/lobby', element: <RequireAuth><LobbyRoute /></RequireAuth> },
    { path: '/games/:id', element: <RequireAuth><GameRoute /></RequireAuth> },
    { path: '*', element: <LandingScreen /> },
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LandingScreen.tsx src/routes/routes.tsx
git commit -m "feat: implement split-screen landing page"
```
