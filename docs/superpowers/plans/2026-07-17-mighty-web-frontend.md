# Mighty Web Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable end-to-end web client (auth → lobby → full hand of Mighty) for the go-mighty backend, built test-first, with a thin Electron shell at the end.

**Architecture:** Thin client over a server-authoritative Go backend. A framework-free `src/core/` layer of pure TypeScript (contract types, legal-move derivation mirroring `go-mighty/internal/game/rules.go`, view-model derivation) sits under dumb React components. One zustand store holds session + latest `Game` broadcast; only the `api/` layers write to it.

**Tech Stack:** React 18 + TypeScript (strict) + Vite, zustand, Vitest + React Testing Library, Playwright (E2E + Electron smoke), `ws` + `tsx` for the Node bot harness, Electron.

**Spec:** `docs/superpowers/specs/2026-07-17-mighty-web-frontend-design.md`

## Global Constraints

- Node ≥ 22 (global `fetch`; `ws` package for bots because Node's WebSocket cannot omit headers we control).
- `tsconfig` has `"strict": true`. No `any` except where a test intentionally forges bad data.
- **Same-origin rule**: all browser network calls use relative paths (`/auth/...`, `/games/...`). The backend's WS upgrader rejects cross-origin browsers (`internal/api/ws.go` requires `Origin` host == request host, or no Origin header) and REST has no CORS headers. Dev and preview servers proxy to `http://localhost:8080` and **strip the Origin header on proxied WS upgrades**.
- **Server is authoritative.** `core/rules.ts` exists only to enable/disable UI affordances and must mirror `go-mighty/internal/game/rules.go` exactly; never block a move the server would accept.
- JSON field names are snake_case exactly as the Go struct tags: `is_no_trump`, `player_id`, `client_version`, `current_turn`, `partner_seat`, `lead_suit`, `joker_called`, `is_connected`, etc.
- Phase values: `waiting | bidding | exchanging | calling | playing | finished`. Move types: `bid | pass | discard | call_partner | play_card`. Suits: `spades | diamonds | hearts | clubs | none`. Ranks: `A K Q J 10 9 8 7 6 5 4 3 2 Joker` (strings).
- WS protocol: client sends `{"type":"AUTH","token":...}` within 5s of open, then `{"type":"MOVE","move_type":...,"payload":...,"client_version":...}`. Server sends either a raw `Game` JSON object or `{"type":"ERROR","error":"..."}`.
- Suit bid ranking: clubs(1) < diamonds(2) < hearts(3) < spades(4); no-trump beats any suit at equal points; equal-points NT-over-NT is illegal.
- Special cards: Mighty = ♠A (♣A if spades trump); Joker Caller = ♣3 (♠3 if clubs trump).
- Unit/component tests are colocated `src/**/*.test.ts(x)` and never require a running backend. Only Tasks 20–21 need the real server (docker compose in `../go-mighty`).
- Commit after every green cycle with conventional-commit messages (`feat:`, `test:`, `chore:`).
- Working directory for all commands: `/Users/joekhosbayar/mighty/mighty-frontend`.

## File Structure

```
mighty-frontend/
  package.json  vite.config.ts  tsconfig.json  playwright.config.ts
  index.html
  src/
    main.tsx  App.tsx  styles.css  test-setup.ts
    core/
      types.ts        # contract mirrors + parseServerMessage
      cards.ts        # special-card identity, sorting, labels
      rules.ts        # isLegalBid, legalPlays, canCallJoker, isValidDiscard
      view.ts         # tableView(game, myPlayerId) -> TableView
      testing/builders.ts   # test fixtures (c, player, baseGame, trick, bid)
    api/
      http.ts         # createHttp (injectable fetch), ApiError, decodeToken
      ws.ts           # GameSocket (AUTH, MOVE+version, reconnect, resync)
    store/
      index.ts        # createAppStore(deps), appStore, useApp
    components/
      AuthScreen.tsx  LobbyScreen.tsx  Hand.tsx  BidPanel.tsx
      ExchangePanel.tsx  FriendCallPanel.tsx  PlayArea.tsx
      ScoreBoard.tsx  GameTable.tsx  GameScreen.tsx
  e2e/
    bots/bot.ts  bots/spawn.ts  bots/run-bots.ts
    full-game.spec.ts  electron.spec.ts
  scripts/capture-fixtures.ts
  fixtures/full-game.json     # committed capture from real server
  electron/main.cjs
```

---

### Task 1: Project scaffold with Vitest and same-origin dev proxy

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/test-setup.ts`, `src/App.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run dev` (port 5173, proxies `/auth` + `/games` incl. WS to :8080 with Origin stripped). `App` renders an `<h1>Mighty</h1>` placeholder that Task 11 replaces.

- [ ] **Step 1: Scaffold and install**

```bash
npm create vite@latest . -- --template react-ts
npm install zustand
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Configure Vite + Vitest + proxy**

Replace `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Go backend rejects cross-origin WS upgrades but allows requests with
// no Origin header, so the proxy strips Origin on upgrade requests.
const backendProxy = {
  '/auth': { target: 'http://localhost:8080', changeOrigin: true },
  '/games': {
    target: 'http://localhost:8080',
    changeOrigin: true,
    ws: true,
    configure(proxy: { on(ev: string, cb: (proxyReq: { removeHeader(n: string): void }) => void): void }) {
      proxy.on('proxyReqWs', proxyReq => proxyReq.removeHeader('origin'))
    },
  },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: backendProxy },
  preview: { port: 5173, proxy: backendProxy },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Replace `src/App.tsx`:

```tsx
export function App() {
  return <h1>Mighty</h1>
}
export default App
```

Replace `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create `src/styles.css` (replace scaffold CSS; delete `src/index.css`/`src/App.css` and their imports if the template generated them):

```css
body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
.hand button { margin: 2px; padding: 0.5rem; font-size: 1.1rem; }
.seats { list-style: none; display: flex; gap: 1rem; padding: 0; }
.seats .turn { font-weight: bold; text-decoration: underline; }
[role='alert'] { color: #b00020; }
```

Add to `package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`.

- [ ] **Step 3: Write the smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the app title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Mighty' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` — Expected: 1 passed.
Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS app with Vitest and backend proxy"
```

---

### Task 2: Contract types and server-message parsing

**Files:**
- Create: `src/core/types.ts`
- Test: `src/core/types.test.ts`

**Interfaces:**
- Produces: `Suit`, `Rank`, `Card`, `Phase`, `MoveType`, `Bid`, `Player`, `PlayedCard`, `Trick`, `Game`, `ServerMessage`, `parseServerMessage(raw: string): ServerMessage`. All later tasks import these.

- [ ] **Step 1: Write the failing test**

Create `src/core/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseServerMessage } from './types'

describe('parseServerMessage', () => {
  it('classifies an ERROR envelope', () => {
    const msg = parseServerMessage('{"type":"ERROR","error":"invalid move: not your turn"}')
    expect(msg).toEqual({ kind: 'error', error: 'invalid move: not your turn' })
  })

  it('classifies anything else as a game broadcast', () => {
    const msg = parseServerMessage('{"id":"g1","status":"bidding","version":7}')
    expect(msg.kind).toBe('game')
    if (msg.kind === 'game') {
      expect(msg.game.id).toBe('g1')
      expect(msg.game.version).toBe(7)
    }
  })

  it('defaults a malformed ERROR to a message', () => {
    expect(parseServerMessage('{"type":"ERROR"}')).toEqual({ kind: 'error', error: 'unknown error' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Write the implementation**

Create `src/core/types.ts` (field names mirror the Go struct tags in `go-mighty/internal/game/{card,game}.go`):

```ts
export type Suit = 'spades' | 'diamonds' | 'hearts' | 'clubs' | 'none'
export type Rank =
  | 'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2' | 'Joker'

export interface Card {
  suit: Suit
  rank: Rank
}

export type Phase = 'waiting' | 'bidding' | 'exchanging' | 'calling' | 'playing' | 'finished'
export type MoveType = 'bid' | 'pass' | 'discard' | 'call_partner' | 'play_card'

export interface Bid {
  player_id: string
  points: number
  suit: Suit
  is_no_trump: boolean
}

export interface Player {
  id: string
  name: string
  seat: number
  hand?: Card[]
  points?: Card[]
  is_connected: boolean
}

export interface PlayedCard {
  player_id: string
  seat: number
  card: Card
}

export interface Trick {
  cards: PlayedCard[]
  lead_suit: Suit
  winner: number
  joker_called: boolean
}

export interface Game {
  id: string
  status: Phase
  players: (Player | null)[]
  kitty?: Card[]
  current_turn: number
  dealer: number
  bids: Bid[] | null
  current_bid: Bid | null
  declarer: number
  passed_players: Record<string, boolean> | null
  contract: Bid | null
  partner_card: Card | null
  partner_seat: number
  is_no_friend: boolean
  trump: Suit
  tricks: Trick[] | null
  scores: Record<string, number> | null
  version: number
  created_at: string
  updated_at: string
}

export type ServerMessage = { kind: 'game'; game: Game } | { kind: 'error'; error: string }

export function parseServerMessage(raw: string): ServerMessage {
  const data = JSON.parse(raw) as Record<string, unknown>
  if (data.type === 'ERROR') {
    return { kind: 'error', error: typeof data.error === 'string' ? data.error : 'unknown error' }
  }
  return { kind: 'game', game: data as unknown as Game }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/types.test.ts` — Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/types.test.ts
git commit -m "feat: contract types and server message parsing"
```

---

### Task 3: Card identities, sorting, and labels

**Files:**
- Create: `src/core/cards.ts`
- Test: `src/core/cards.test.ts`

**Interfaces:**
- Consumes: `Card`, `Suit` from `./types`.
- Produces: `SUIT_RANK: Record<string, number>`, `cardKey(c: Card): string`, `sameCard(a: Card, b: Card): boolean`, `isJoker(c: Card): boolean`, `isPointCard(c: Card): boolean`, `mightyCard(trump: Suit): Card`, `isMighty(c: Card, trump: Suit): boolean`, `jokerCallerCard(trump: Suit): Card`, `isJokerCaller(c: Card, trump: Suit): boolean`, `cardLabel(c: Card): string`, `sortHand(hand: Card[], trump: Suit): Card[]`.

- [ ] **Step 1: Write the failing test**

Create `src/core/cards.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Card } from './types'
import {
  cardLabel, isJokerCaller, isMighty, isPointCard, jokerCallerCard, mightyCard, sortHand,
} from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('special card identity', () => {
  it('mighty is the spade ace normally', () => {
    expect(mightyCard('hearts')).toEqual(c('spades', 'A'))
    expect(isMighty(c('spades', 'A'), 'hearts')).toBe(true)
  })

  it('mighty shifts to the club ace when spades are trump', () => {
    expect(mightyCard('spades')).toEqual(c('clubs', 'A'))
    expect(isMighty(c('spades', 'A'), 'spades')).toBe(false)
    expect(isMighty(c('clubs', 'A'), 'spades')).toBe(true)
  })

  it('joker caller is the club 3, shifting to spade 3 when clubs are trump', () => {
    expect(jokerCallerCard('hearts')).toEqual(c('clubs', '3'))
    expect(jokerCallerCard('clubs')).toEqual(c('spades', '3'))
    expect(isJokerCaller(c('spades', '3'), 'clubs')).toBe(true)
  })
})

describe('point cards', () => {
  it('A K Q J 10 are points; 9 and Joker are not', () => {
    expect(isPointCard(c('hearts', 'A'))).toBe(true)
    expect(isPointCard(c('clubs', '10'))).toBe(true)
    expect(isPointCard(c('clubs', '9'))).toBe(false)
    expect(isPointCard(c('none', 'Joker'))).toBe(false)
  })
})

describe('sortHand', () => {
  it('orders joker, then trump, then remaining suits high-suit-first, ranks descending', () => {
    const hand = [c('clubs', '2'), c('hearts', 'K'), c('hearts', 'A'), c('none', 'Joker'), c('spades', '5')]
    expect(sortHand(hand, 'hearts')).toEqual([
      c('none', 'Joker'), c('hearts', 'A'), c('hearts', 'K'), c('spades', '5'), c('clubs', '2'),
    ])
  })

  it('does not mutate the input', () => {
    const hand = [c('clubs', '2'), c('spades', 'A')]
    sortHand(hand, 'none')
    expect(hand[0]).toEqual(c('clubs', '2'))
  })
})

describe('cardLabel', () => {
  it('renders suit symbol and rank, and Joker plainly', () => {
    expect(cardLabel(c('spades', 'A'))).toBe('♠A')
    expect(cardLabel(c('none', 'Joker'))).toBe('Joker')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/cards.test.ts`
Expected: FAIL — cannot resolve `./cards`.

- [ ] **Step 3: Write the implementation**

Create `src/core/cards.ts`:

```ts
import type { Card, Suit } from './types'

export const SUIT_RANK: Record<string, number> = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 }

export const cardKey = (c: Card): string => `${c.suit}:${c.rank}`
export const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank
export const isJoker = (c: Card): boolean => c.rank === 'Joker'
export const isPointCard = (c: Card): boolean => ['A', 'K', 'Q', 'J', '10'].includes(c.rank)

export const mightyCard = (trump: Suit): Card =>
  trump === 'spades' ? { suit: 'clubs', rank: 'A' } : { suit: 'spades', rank: 'A' }
export const isMighty = (c: Card, trump: Suit): boolean => sameCard(c, mightyCard(trump))

export const jokerCallerCard = (trump: Suit): Card =>
  trump === 'clubs' ? { suit: 'spades', rank: '3' } : { suit: 'clubs', rank: '3' }
export const isJokerCaller = (c: Card, trump: Suit): boolean => sameCard(c, jokerCallerCard(trump))

const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', none: '',
}

export function cardLabel(c: Card): string {
  return isJoker(c) ? 'Joker' : `${SUIT_SYMBOL[c.suit]}${c.rank}`
}

export function sortHand(hand: Card[], trump: Suit): Card[] {
  const suitWeight = (c: Card): number => {
    if (isJoker(c)) return 0
    if (c.suit === trump) return 1
    return 6 - (SUIT_RANK[c.suit] ?? 0)
  }
  return [...hand].sort(
    (a, b) => suitWeight(a) - suitWeight(b) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank),
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/cards.test.ts` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/cards.ts src/core/cards.test.ts
git commit -m "feat: card identities, sorting, and labels"
```

---

### Task 4: Bidding legality rules

**Files:**
- Create: `src/core/rules.ts`
- Test: `src/core/rules.test.ts`

**Interfaces:**
- Consumes: `Bid`, `Suit` from `./types`; `SUIT_RANK` from `./cards`.
- Produces: `BidInput { points: number; suit: Suit; is_no_trump: boolean }`, `isLegalBid(bid: BidInput, currentBid: Bid | null): boolean`. Mirrors `validateBid` in `go-mighty/internal/game/rules.go:88-147` (turn/phase checks excluded — the view layer handles those).

- [ ] **Step 1: Write the failing test**

Create `src/core/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Bid } from './types'
import { isLegalBid } from './rules'

const bid = (points: number, suit: Bid['suit'], is_no_trump = false): Bid =>
  ({ player_id: 'p0', points, suit, is_no_trump })

describe('isLegalBid', () => {
  it('requires points between 3 and 10', () => {
    expect(isLegalBid({ points: 2, suit: 'clubs', is_no_trump: false }, null)).toBe(false)
    expect(isLegalBid({ points: 11, suit: 'clubs', is_no_trump: false }, null)).toBe(false)
    expect(isLegalBid({ points: 3, suit: 'clubs', is_no_trump: false }, null)).toBe(true)
  })

  it('no-trump bids must use suit none; suit bids must use a real suit', () => {
    expect(isLegalBid({ points: 5, suit: 'hearts', is_no_trump: true }, null)).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: true }, null)).toBe(true)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: false }, null)).toBe(false)
  })

  it('must not be below the current bid points', () => {
    expect(isLegalBid({ points: 4, suit: 'spades', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 6, suit: 'clubs', is_no_trump: false }, bid(5, 'spades'))).toBe(true)
  })

  it('at equal points, requires a strictly higher suit', () => {
    expect(isLegalBid({ points: 5, suit: 'diamonds', is_no_trump: false }, bid(5, 'clubs'))).toBe(true)
    expect(isLegalBid({ points: 5, suit: 'clubs', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'hearts', is_no_trump: false }, bid(5, 'spades'))).toBe(false)
  })

  it('at equal points, no-trump beats any suit but nothing beats no-trump', () => {
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: true }, bid(5, 'spades'))).toBe(true)
    expect(isLegalBid({ points: 5, suit: 'spades', is_no_trump: false }, bid(5, 'none', true))).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: true }, bid(5, 'none', true))).toBe(false)
    expect(isLegalBid({ points: 6, suit: 'clubs', is_no_trump: false }, bid(5, 'none', true))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/rules.test.ts`
Expected: FAIL — cannot resolve `./rules`.

- [ ] **Step 3: Write the implementation**

Create `src/core/rules.ts`:

```ts
import type { Bid, Suit } from './types'
import { SUIT_RANK } from './cards'

export interface BidInput {
  points: number
  suit: Suit
  is_no_trump: boolean
}

export function isLegalBid(bid: BidInput, currentBid: Bid | null): boolean {
  if (bid.points < 3 || bid.points > 10) return false
  if (bid.is_no_trump) {
    if (bid.suit !== 'none') return false
  } else if (!(bid.suit in SUIT_RANK)) {
    return false
  }
  if (!currentBid) return true
  if (bid.points < currentBid.points) return false
  if (bid.points === currentBid.points) {
    if (currentBid.is_no_trump) return false
    if (!bid.is_no_trump && SUIT_RANK[bid.suit] <= SUIT_RANK[currentBid.suit]) return false
  }
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/rules.test.ts` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/rules.ts src/core/rules.test.ts
git commit -m "feat: bidding legality rules mirroring server validateBid"
```

---

### Task 5: Test builders and play-phase legality rules

**Files:**
- Create: `src/core/testing/builders.ts`
- Modify: `src/core/rules.ts` (append)
- Test: `src/core/rules-play.test.ts`

**Interfaces:**
- Consumes: types from `../types`; `isJoker`, `isMighty`, `isJokerCaller`, `jokerCallerCard`, `cardKey` from `./cards`.
- Produces:
  - Builders: `c(suit, rank): Card`, `player(seat: number, over?: Partial<Player>): Player`, `baseGame(over?: Partial<Game>): Game`, `trick(over?: Partial<Trick>): Trick`, `bid(playerId: string, points: number, suit: Suit, isNoTrump?: boolean): Bid` — used by every later test.
  - Rules: `legalPlays(game: Game, seat: number): Card[]`, `canCallJoker(game: Game, seat: number, card: Card): boolean`, `isValidDiscard(hand: Card[], selection: Card[]): boolean`. Mirrors `validatePlayCard`/`validateDiscard` in `go-mighty/internal/game/rules.go:163-305`.

- [ ] **Step 1: Create the builders**

Create `src/core/testing/builders.ts`:

```ts
import type { Bid, Card, Game, Player, Suit, Trick } from '../types'

export const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

export function player(seat: number, over: Partial<Player> = {}): Player {
  return { id: `p${seat}`, name: `Player ${seat}`, seat, is_connected: true, ...over }
}

export function baseGame(over: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    status: 'playing',
    players: [0, 1, 2, 3, 4].map(s => player(s)),
    current_turn: 0,
    dealer: 0,
    bids: [],
    current_bid: null,
    declarer: -1,
    passed_players: {},
    contract: null,
    partner_card: null,
    partner_seat: -1,
    is_no_friend: false,
    trump: 'spades',
    tricks: [],
    scores: {},
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function trick(over: Partial<Trick> = {}): Trick {
  return { cards: [], lead_suit: 'none', winner: -1, joker_called: false, ...over }
}

export function bid(playerId: string, points: number, suit: Suit, isNoTrump = false): Bid {
  return { player_id: playerId, points, suit, is_no_trump: isNoTrump }
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/core/rules-play.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canCallJoker, isValidDiscard, legalPlays } from './rules'
import { baseGame, c, player, trick } from './testing/builders'

function playingGame(hand: ReturnType<typeof c>[], over = {}) {
  return baseGame({
    status: 'playing',
    trump: 'hearts',
    current_turn: 0,
    players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
    ...over,
  })
}

describe('legalPlays', () => {
  it('returns empty when it is not your turn or not playing', () => {
    const g = playingGame([c('clubs', '5')], { current_turn: 2 })
    expect(legalPlays(g, 0)).toEqual([])
    expect(legalPlays(playingGame([c('clubs', '5')], { status: 'bidding' }), 0)).toEqual([])
  })

  it('when leading trick 1, forbids leading trump unless mighty or all-trump', () => {
    const hand = [c('hearts', 'K'), c('clubs', '5'), c('spades', 'A')] // hearts trump, ♠A mighty
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5'), c('spades', 'A')])
  })

  it('when leading trick 1 with only trumps, allows them', () => {
    const hand = [c('hearts', 'K'), c('hearts', '2')]
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual(hand)
  })

  it('when leading a later trick, everything is legal', () => {
    const hand = [c('hearts', 'K'), c('clubs', '5')]
    const g = playingGame(hand, { tricks: [trick({ winner: 0 }), trick()] })
    expect(legalPlays(g, 0)).toEqual(hand)
  })

  it('must follow the lead suit when able; mighty and joker are exempt', () => {
    const hand = [c('clubs', '5'), c('diamonds', 'K'), c('spades', 'A'), c('none', 'Joker')]
    const g = playingGame(hand, {
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5'), c('spades', 'A'), c('none', 'Joker')])
  })

  it('void in the lead suit, anything goes', () => {
    const hand = [c('diamonds', 'K'), c('hearts', '3')]
    const g = playingGame(hand, {
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    expect(legalPlays(g, 0)).toEqual(hand)
  })

  it('on trick 1, mighty cannot escape following suit when able to follow', () => {
    const hand = [c('clubs', '5'), c('spades', 'A')]
    const g = playingGame(hand, {
      tricks: [trick({ lead_suit: 'clubs', cards: [{ player_id: 'p4', seat: 4, card: c('clubs', '9') }] })],
    })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5')])
  })

  it('when the joker is called and you hold it, only joker or mighty are playable', () => {
    const hand = [c('clubs', '5'), c('none', 'Joker'), c('spades', 'A')]
    const g = playingGame(hand, {
      tricks: [
        trick({ winner: 1 }),
        trick({
          lead_suit: 'clubs',
          joker_called: true,
          cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '3') }],
        }),
      ],
    })
    expect(legalPlays(g, 0)).toEqual([c('none', 'Joker'), c('spades', 'A')])
  })
})

describe('canCallJoker', () => {
  const caller = c('clubs', '3') // hearts trump → caller is ♣3
  it('allows calling when leading tricks 2-9 with the joker caller', () => {
    const g = playingGame([caller], { tricks: [trick({ winner: 0 }), trick()] })
    expect(canCallJoker(g, 0, caller)).toBe(true)
  })
  it('forbids calling on trick 1 and trick 10', () => {
    expect(canCallJoker(playingGame([caller], { tricks: [trick()] }), 0, caller)).toBe(false)
    const tenTricks = [...Array.from({ length: 9 }, () => trick({ winner: 0 })), trick()]
    expect(canCallJoker(playingGame([caller], { tricks: tenTricks }), 0, caller)).toBe(false)
  })
  it('forbids calling mid-trick or with a non-caller card', () => {
    const mid = playingGame([caller], {
      tricks: [trick({ winner: 0 }), trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] })],
    })
    expect(canCallJoker(mid, 0, caller)).toBe(false)
    const g = playingGame([c('clubs', '4')], { tricks: [trick({ winner: 0 }), trick()] })
    expect(canCallJoker(g, 0, c('clubs', '4'))).toBe(false)
  })
})

describe('isValidDiscard', () => {
  const hand = [c('clubs', '2'), c('clubs', '3'), c('clubs', '4'), c('clubs', '5')]
  it('accepts exactly 3 distinct held cards', () => {
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '3'), c('clubs', '4')])).toBe(true)
  })
  it('rejects wrong count, duplicates, and cards not held', () => {
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '3')])).toBe(false)
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '2'), c('clubs', '3')])).toBe(false)
    expect(isValidDiscard(hand, [c('clubs', '2'), c('clubs', '3'), c('hearts', 'A')])).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/core/rules-play.test.ts`
Expected: FAIL — `legalPlays` is not exported.

- [ ] **Step 4: Append the implementation**

Append to `src/core/rules.ts`:

```ts
import type { Card, Game } from './types'
import { cardKey, isJoker, isJokerCaller, isMighty } from './cards'

export function legalPlays(game: Game, seat: number): Card[] {
  const p = game.players[seat]
  if (!p?.hand || game.status !== 'playing' || game.current_turn !== seat) return []
  const tricks = game.tricks ?? []
  const t = tricks[tricks.length - 1]
  if (!t) return []
  const hand = p.hand
  const isFirstTrick = tricks.length === 1

  if (t.joker_called && hand.some(isJoker)) {
    const forced = hand.filter(card => isJoker(card) || isMighty(card, game.trump))
    if (forced.length > 0) return forced
  }

  if (t.cards.length === 0) {
    if (isFirstTrick && hand.some(card => card.suit !== game.trump)) {
      return hand.filter(card => card.suit !== game.trump || isMighty(card, game.trump))
    }
    return [...hand]
  }

  const lead = t.lead_suit
  const canFollow = hand.some(card => card.suit === lead)
  return hand.filter(card => {
    if (card.suit === lead) return true
    if (isJoker(card)) return true
    if (isMighty(card, game.trump)) return !(isFirstTrick && canFollow)
    return !canFollow
  })
}

export function canCallJoker(game: Game, seat: number, card: Card): boolean {
  if (game.status !== 'playing' || game.current_turn !== seat) return false
  const tricks = game.tricks ?? []
  const t = tricks[tricks.length - 1]
  if (!t || t.cards.length > 0) return false
  if (!isJokerCaller(card, game.trump)) return false
  return tricks.length !== 1 && tricks.length !== 10
}

export function isValidDiscard(hand: Card[], selection: Card[]): boolean {
  if (selection.length !== 3) return false
  const keys = selection.map(cardKey)
  if (new Set(keys).size !== 3) return false
  return keys.every(k => hand.some(card => cardKey(card) === k))
}
```

(Merge the new `import` lines with the existing imports at the top of the file.)

- [ ] **Step 5: Run all core tests**

Run: `npx vitest run src/core` — Expected: all passed.

- [ ] **Step 6: Commit**

```bash
git add src/core
git commit -m "feat: play-phase legality rules and test builders"
```

---

### Task 6: Table view-model

**Files:**
- Create: `src/core/view.ts`
- Test: `src/core/view.test.ts`

**Interfaces:**
- Consumes: types from `./types`; `sortHand`, `cardKey`, `jokerCallerCard` from `./cards`; `legalPlays`, `canCallJoker` from `./rules`; builders from `./testing/builders`.
- Produces:

```ts
interface SeatView { seat: number; name: string | null; isEmpty: boolean; isMe: boolean; isTurn: boolean; isDeclarer: boolean; isPartner: boolean; isConnected: boolean; cardCount: number }
interface HandCard { card: Card; playable: boolean }
interface ScoreRow { playerId: string; name: string; cardPoints: number }
interface TableView {
  gameId: string; phase: Phase; mySeat: number; isMyTurn: boolean; amDeclarer: boolean
  seats: SeatView[]; hand: HandCard[]; currentTrick: PlayedCard[]
  bids: Bid[]; currentBid: Bid | null; contract: Bid | null; trump: Suit
  partnerCard: Card | null; partnerRevealed: boolean; jokerCallCard: Card | null
  scores: ScoreRow[]; version: number
}
function tableView(game: Game, myPlayerId: string): TableView
```

- [ ] **Step 1: Write the failing test**

Create `src/core/view.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tableView } from './view'
import { baseGame, bid, c, player, trick } from './testing/builders'

describe('tableView', () => {
  it('locates my seat, turn, and declarer flags', () => {
    const g = baseGame({ status: 'bidding', current_turn: 2, declarer: 2 })
    const v = tableView(g, 'p2')
    expect(v.mySeat).toBe(2)
    expect(v.isMyTurn).toBe(true)
    expect(v.amDeclarer).toBe(true)
    expect(tableView(g, 'p0').isMyTurn).toBe(false)
    expect(tableView(g, 'stranger').mySeat).toBe(-1)
  })

  it('marks seats with turn, declarer, partner, and emptiness', () => {
    const g = baseGame({
      status: 'playing', current_turn: 1, declarer: 3, partner_seat: 4,
      players: [player(0), null, player(2), player(3), player(4)],
    })
    const v = tableView(g, 'p0')
    expect(v.seats).toHaveLength(5)
    expect(v.seats[1].isEmpty).toBe(true)
    expect(v.seats[3].isDeclarer).toBe(true)
    expect(v.seats[4].isPartner).toBe(true)
    expect(v.partnerRevealed).toBe(true)
  })

  it('sorts my hand and flags playable cards during playing', () => {
    const hand = [c('clubs', '5'), c('spades', 'A'), c('hearts', 'K')] // hearts trump → ♠A mighty
    const g = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
      tricks: [trick()], // trick 1: no trump lead
    })
    const v = tableView(g, 'p0')
    expect(v.hand.map(h => h.card)).toEqual([c('hearts', 'K'), c('spades', 'A'), c('clubs', '5')])
    expect(v.hand.find(h => h.card.rank === 'K')?.playable).toBe(false)
    expect(v.hand.find(h => h.card.suit === 'spades')?.playable).toBe(true)
  })

  it('leaves all cards unplayable outside the playing phase', () => {
    const g = baseGame({
      status: 'bidding',
      players: [player(0, { hand: [c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
    })
    expect(tableView(g, 'p0').hand.every(h => !h.playable)).toBe(true)
  })

  it('exposes the joker-call card only when a call is possible', () => {
    const caller = c('clubs', '3')
    const g = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [caller, c('diamonds', '2')] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(g, 'p0').jokerCallCard).toEqual(caller)
    const trick1 = { ...g, tricks: [trick()] }
    expect(tableView(trick1, 'p0').jokerCallCard).toBeNull()
  })

  it('carries bids, contract, trick, scores, and version through', () => {
    const g = baseGame({
      status: 'finished',
      bids: [bid('p0', 5, 'spades')],
      contract: bid('p0', 5, 'spades'),
      scores: { p0: 12, p1: 3 },
      version: 42,
      tricks: [trick({ cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }], lead_suit: 'clubs', winner: 1 })],
    })
    const v = tableView(g, 'p0')
    expect(v.bids).toHaveLength(1)
    expect(v.contract?.points).toBe(5)
    expect(v.currentTrick).toHaveLength(1)
    expect(v.scores.find(s => s.playerId === 'p0')?.cardPoints).toBe(12)
    expect(v.scores.find(s => s.playerId === 'p2')?.cardPoints).toBe(0)
    expect(v.version).toBe(42)
    expect(v.gameId).toBe('g1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/view.test.ts`
Expected: FAIL — cannot resolve `./view`.

- [ ] **Step 3: Write the implementation**

Create `src/core/view.ts`:

```ts
import type { Bid, Card, Game, Phase, PlayedCard, Suit } from './types'
import { cardKey, jokerCallerCard, sortHand } from './cards'
import { canCallJoker, legalPlays } from './rules'

export interface SeatView {
  seat: number
  name: string | null
  isEmpty: boolean
  isMe: boolean
  isTurn: boolean
  isDeclarer: boolean
  isPartner: boolean
  isConnected: boolean
  cardCount: number
}

export interface HandCard {
  card: Card
  playable: boolean
}

export interface ScoreRow {
  playerId: string
  name: string
  cardPoints: number
}

export interface TableView {
  gameId: string
  phase: Phase
  mySeat: number
  isMyTurn: boolean
  amDeclarer: boolean
  seats: SeatView[]
  hand: HandCard[]
  currentTrick: PlayedCard[]
  bids: Bid[]
  currentBid: Bid | null
  contract: Bid | null
  trump: Suit
  partnerCard: Card | null
  partnerRevealed: boolean
  jokerCallCard: Card | null
  scores: ScoreRow[]
  version: number
}

export function tableView(game: Game, myPlayerId: string): TableView {
  const me = game.players.find(p => p?.id === myPlayerId) ?? null
  const mySeat = me?.seat ?? -1
  const active = game.status === 'bidding' || game.status === 'playing'
  const isMyTurn = mySeat >= 0 && active && game.current_turn === mySeat
  const amDeclarer = mySeat >= 0 && game.declarer === mySeat

  const playable = new Set(
    game.status === 'playing' && mySeat >= 0 ? legalPlays(game, mySeat).map(cardKey) : [],
  )
  const sorted = me?.hand ? sortHand(me.hand, game.trump) : []

  const caller = jokerCallerCard(game.trump)
  const jokerCallCard =
    mySeat >= 0 && playable.has(cardKey(caller)) && canCallJoker(game, mySeat, caller)
      ? caller
      : null

  const tricks = game.tricks ?? []

  return {
    gameId: game.id,
    phase: game.status,
    mySeat,
    isMyTurn,
    amDeclarer,
    seats: game.players.map((p, i) => ({
      seat: i,
      name: p?.name ?? null,
      isEmpty: !p,
      isMe: i === mySeat,
      isTurn: active && i === game.current_turn,
      isDeclarer: i === game.declarer,
      isPartner: i === game.partner_seat,
      isConnected: p?.is_connected ?? false,
      cardCount: p?.hand?.length ?? 0,
    })),
    hand: sorted.map(card => ({ card, playable: playable.has(cardKey(card)) })),
    currentTrick: tricks[tricks.length - 1]?.cards ?? [],
    bids: game.bids ?? [],
    currentBid: game.current_bid,
    contract: game.contract,
    trump: game.trump,
    partnerCard: game.partner_card,
    partnerRevealed: game.partner_seat >= 0,
    jokerCallCard,
    scores: game.players.flatMap(p =>
      p ? [{ playerId: p.id, name: p.name, cardPoints: game.scores?.[p.id] ?? 0 }] : [],
    ),
    version: game.version,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/view.test.ts` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/view.ts src/core/view.test.ts
git commit -m "feat: table view-model derivation"
```

---

### Task 7: REST client and token decoding

**Files:**
- Create: `src/api/http.ts`
- Test: `src/api/http.test.ts`

**Interfaces:**
- Consumes: `Game` from `../core/types`.
- Produces: `ApiError` (with `status: number`), `SignupResult { id: string; username: string; email: string }`, `Http { signup(username, password, email): Promise<SignupResult>; login(username, password): Promise<string>; createGame(token): Promise<Game>; joinGame(token, gameId): Promise<Game>; listGames(): Promise<Game[]>; getGame(gameId): Promise<Game> }`, `createHttp(fetchFn?: typeof fetch, base?: string): Http`, `decodeToken(token: string): { userId: string; username: string }`. The `base` parameter exists for the Node bot harness; browser code uses the default `''` (relative, same-origin).

- [ ] **Step 1: Write the failing test**

Create `src/api/http.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ApiError, createHttp, decodeToken } from './http'

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch
}

describe('createHttp', () => {
  it('logs in and returns the token', async () => {
    const f = fakeFetch(200, { token: 'abc' })
    const http = createHttp(f)
    await expect(http.login('alice', 'pw')).resolves.toBe('abc')
    expect(f).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'alice', password: 'pw' }),
    }))
  })

  it('sends the bearer token on game creation', async () => {
    const f = fakeFetch(200, { id: 'g1' })
    await createHttp(f).createGame('tok')
    const init = (f as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('joins, lists, and gets with the right paths', async () => {
    const f = fakeFetch(200, [])
    const http = createHttp(f)
    await http.listGames()
    expect(f).toHaveBeenCalledWith('/games?status=waiting', undefined)
    const f2 = fakeFetch(200, { id: 'g9' })
    await createHttp(f2).joinGame('tok', 'g9')
    expect(f2).toHaveBeenCalledWith('/games/g9/join', expect.anything())
  })

  it('throws ApiError with status and server text on failure', async () => {
    const http = createHttp(fakeFetch(401, 'invalid credentials\n'))
    const err = await http.login('a', 'b').catch(e => e as ApiError)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
    expect(err.message).toBe('invalid credentials')
  })

  it('prefixes an absolute base when given', async () => {
    const f = fakeFetch(200, [])
    await createHttp(f, 'http://localhost:8080').listGames()
    expect(f).toHaveBeenCalledWith('http://localhost:8080/games?status=waiting', undefined)
  })
})

describe('decodeToken', () => {
  it('extracts user_id and username from the JWT payload', () => {
    const payload = btoa(JSON.stringify({ user_id: 'u-1', username: 'alice' }))
    expect(decodeToken(`head.${payload}.sig`)).toEqual({ userId: 'u-1', username: 'alice' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/http.test.ts`
Expected: FAIL — cannot resolve `./http`.

- [ ] **Step 3: Write the implementation**

Create `src/api/http.ts`:

```ts
import type { Game } from '../core/types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface SignupResult {
  id: string
  username: string
  email: string
}

export interface Http {
  signup(username: string, password: string, email: string): Promise<SignupResult>
  login(username: string, password: string): Promise<string>
  createGame(token: string): Promise<Game>
  joinGame(token: string, gameId: string): Promise<Game>
  listGames(): Promise<Game[]>
  getGame(gameId: string): Promise<Game>
}

export function createHttp(fetchFn: typeof fetch = fetch, base = ''): Http {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchFn(base + path, init)
    if (!res.ok) {
      throw new ApiError(res.status, (await res.text()).trim() || res.statusText)
    }
    return res.json() as Promise<T>
  }

  const post = (body: unknown, token?: string): RequestInit => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  return {
    signup: (username, password, email) => request('/auth/signup', post({ username, password, email })),
    login: async (username, password) =>
      (await request<{ token: string }>('/auth/login', post({ username, password }))).token,
    createGame: token => request('/games', post({}, token)),
    joinGame: (token, gameId) => request(`/games/${gameId}/join`, post({}, token)),
    listGames: () => request('/games?status=waiting', undefined),
    getGame: gameId => request(`/games/${gameId}`, undefined),
  }
}

export function decodeToken(token: string): { userId: string; username: string } {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(b64)) as { user_id: string; username: string }
  return { userId: payload.user_id, username: payload.username }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/http.test.ts` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/api/http.ts src/api/http.test.ts
git commit -m "feat: REST client with injectable fetch and JWT decoding"
```

---

### Task 8: GameSocket — auth handshake, moves, version tagging

**Files:**
- Create: `src/api/ws.ts`
- Test: `src/api/ws.test.ts`

**Interfaces:**
- Consumes: `parseServerMessage`, `Game`, `MoveType` from `../core/types`.
- Produces: `ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'`, `WebSocketLike { send(data: string): void; close(): void; onopen/onmessage/onclose: handler | null }`, `GameSocketCallbacks { onGame(game: Game): void; onError(message: string): void; onStatus(status: ConnectionStatus): void }`, `GameSocketOptions { gameId; token; callbacks; wsFactory?; fetchGame?; maxBackoffMs? }`, `class GameSocket { connect(): void; sendMove(moveType: MoveType, payload: unknown): void; close(): void }`. Task 9 extends this same class with reconnect/resync.

- [ ] **Step 1: Write the failing test**

Create `src/api/ws.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { WebSocketLike } from './ws'
import { GameSocket } from './ws'

class FakeWS implements WebSocketLike {
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  send(data: string) { this.sent.push(data) }
  close() { this.onclose?.() }
  open() { this.onopen?.() }
  receive(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

function makeSocket(overrides: { fetchGame?: (id: string) => Promise<never> } = {}) {
  const ws = new FakeWS()
  const callbacks = { onGame: vi.fn(), onError: vi.fn(), onStatus: vi.fn() }
  const socket = new GameSocket({
    gameId: 'g1',
    token: 'tok',
    callbacks,
    wsFactory: () => ws,
    ...overrides,
  })
  return { ws, callbacks, socket }
}

const gameV = (version: number) => ({ id: 'g1', status: 'bidding', version })

describe('GameSocket', () => {
  it('sends AUTH as the first frame on open', () => {
    const { ws, socket, callbacks } = makeSocket()
    socket.connect()
    expect(callbacks.onStatus).toHaveBeenCalledWith('connecting')
    ws.open()
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'AUTH', token: 'tok' })
    expect(callbacks.onStatus).toHaveBeenCalledWith('open')
  })

  it('emits game broadcasts and error frames to the right callbacks', () => {
    const { ws, socket, callbacks } = makeSocket()
    socket.connect()
    ws.open()
    ws.receive(gameV(5))
    expect(callbacks.onGame).toHaveBeenCalledWith(expect.objectContaining({ version: 5 }))
    ws.receive({ type: 'ERROR', error: 'not your turn' })
    expect(callbacks.onError).toHaveBeenCalledWith('not your turn')
  })

  it('tags moves with the last seen version', () => {
    const { ws, socket } = makeSocket()
    socket.connect()
    ws.open()
    ws.receive(gameV(9))
    socket.sendMove('pass', null)
    const frame = JSON.parse(ws.sent[1])
    expect(frame).toEqual({ type: 'MOVE', move_type: 'pass', payload: null, client_version: 9 })
  })

  it('reports closed when the user closes', () => {
    const { ws, socket, callbacks } = makeSocket()
    socket.connect()
    ws.open()
    socket.close()
    expect(callbacks.onStatus).toHaveBeenLastCalledWith('closed')
    expect(ws.sent.filter(f => JSON.parse(f).type === 'MOVE')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/ws.test.ts`
Expected: FAIL — cannot resolve `./ws`.

- [ ] **Step 3: Write the implementation**

Create `src/api/ws.ts`:

```ts
import type { Game, MoveType } from '../core/types'
import { parseServerMessage } from '../core/types'

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface WebSocketLike {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: (() => void) | null
}

export interface GameSocketCallbacks {
  onGame(game: Game): void
  onError(message: string): void
  onStatus(status: ConnectionStatus): void
}

export interface GameSocketOptions {
  gameId: string
  token: string
  callbacks: GameSocketCallbacks
  wsFactory?: (path: string) => WebSocketLike
  fetchGame?: (gameId: string) => Promise<Game>
  maxBackoffMs?: number
}

function browserWsFactory(path: string): WebSocketLike {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${location.host}${path}`) as unknown as WebSocketLike
}

export class GameSocket {
  private ws: WebSocketLike | null = null
  private lastVersion = 0
  private closed = false

  constructor(private readonly opts: GameSocketOptions) {}

  connect(): void {
    const { gameId, token, callbacks } = this.opts
    callbacks.onStatus('connecting')
    const ws = (this.opts.wsFactory ?? browserWsFactory)(`/games/${gameId}/ws`)
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'AUTH', token }))
      callbacks.onStatus('open')
    }
    ws.onmessage = ev => {
      const msg = parseServerMessage(String(ev.data))
      if (msg.kind === 'error') callbacks.onError(msg.error)
      else this.acceptGame(msg.game)
    }
    ws.onclose = () => {
      callbacks.onStatus('closed')
    }
  }

  sendMove(moveType: MoveType, payload: unknown): void {
    this.ws?.send(
      JSON.stringify({ type: 'MOVE', move_type: moveType, payload, client_version: this.lastVersion }),
    )
  }

  close(): void {
    this.closed = true
    this.ws?.close()
  }

  protected acceptGame(game: Game): void {
    if (game.version < this.lastVersion) return
    this.lastVersion = game.version
    this.opts.callbacks.onGame(game)
  }

  protected get isClosed(): boolean {
    return this.closed
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/ws.test.ts` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/api/ws.ts src/api/ws.test.ts
git commit -m "feat: GameSocket auth handshake and version-tagged moves"
```

---

### Task 9: GameSocket — reconnect with backoff and REST resync

**Files:**
- Modify: `src/api/ws.ts`
- Test: `src/api/ws.test.ts` (append)

**Interfaces:**
- Consumes/Produces: same `GameSocket` class; behavior added — on unexpected close: status `reconnecting`, retry after `min(1000 * 2^retries, maxBackoffMs ?? 10000)` ms; on every open: if `fetchGame` provided, fetch current state and feed it through the same stale-version guard.

- [ ] **Step 1: Write the failing tests**

Append to `src/api/ws.test.ts` (add `beforeEach`/`afterEach` imports from vitest):

```ts
describe('GameSocket reconnect and resync', () => {
  it('reconnects with backoff after an unexpected close', () => {
    vi.useFakeTimers()
    const sockets: FakeWS[] = []
    const callbacks = { onGame: vi.fn(), onError: vi.fn(), onStatus: vi.fn() }
    const socket = new GameSocket({
      gameId: 'g1', token: 'tok', callbacks,
      wsFactory: () => { const w = new FakeWS(); sockets.push(w); return w },
    })
    socket.connect()
    sockets[0].open()
    sockets[0].onclose?.() // dropped, not user-initiated
    expect(callbacks.onStatus).toHaveBeenLastCalledWith('reconnecting')
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(sockets).toHaveLength(2)
    sockets[1].onclose?.()
    vi.advanceTimersByTime(1999)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)
    socket.close()
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(3)
    vi.useRealTimers()
  })

  it('resyncs via fetchGame on open and drops stale states', async () => {
    const ws = new FakeWS()
    const callbacks = { onGame: vi.fn(), onError: vi.fn(), onStatus: vi.fn() }
    const socket = new GameSocket({
      gameId: 'g1', token: 'tok', callbacks,
      wsFactory: () => ws,
      fetchGame: async () => gameV(3) as never,
    })
    socket.connect()
    ws.receive(gameV(7)) // broadcast arrives before...
    ws.open()
    await Promise.resolve() // ...the resync fetch resolves stale
    await Promise.resolve()
    expect(callbacks.onGame).toHaveBeenCalledTimes(1)
    expect(callbacks.onGame).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/api/ws.test.ts`
Expected: the two new tests FAIL (no reconnect, no resync); the earlier ones still pass.

- [ ] **Step 3: Update the implementation**

In `src/api/ws.ts`, add a `retries` field and replace `connect()`; add `resync()`:

```ts
  private retries = 0

  connect(): void {
    const { gameId, token, callbacks } = this.opts
    callbacks.onStatus(this.retries === 0 ? 'connecting' : 'reconnecting')
    const ws = (this.opts.wsFactory ?? browserWsFactory)(`/games/${gameId}/ws`)
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'AUTH', token }))
      callbacks.onStatus('open')
      this.retries = 0
      void this.resync()
    }
    ws.onmessage = ev => {
      const msg = parseServerMessage(String(ev.data))
      if (msg.kind === 'error') callbacks.onError(msg.error)
      else this.acceptGame(msg.game)
    }
    ws.onclose = () => {
      if (this.closed) {
        callbacks.onStatus('closed')
        return
      }
      const delay = Math.min(1000 * 2 ** this.retries, this.opts.maxBackoffMs ?? 10_000)
      this.retries += 1
      callbacks.onStatus('reconnecting')
      setTimeout(() => {
        if (!this.closed) this.connect()
      }, delay)
    }
  }

  private async resync(): Promise<void> {
    if (!this.opts.fetchGame) return
    try {
      this.acceptGame(await this.opts.fetchGame(this.opts.gameId))
    } catch {
      // A failed resync is safe to ignore: the next broadcast carries full state.
    }
  }
```

- [ ] **Step 4: Run all api tests**

Run: `npx vitest run src/api` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/api/ws.ts src/api/ws.test.ts
git commit -m "feat: GameSocket reconnect with backoff and REST resync"
```

---

### Task 10: App store

**Files:**
- Create: `src/store/index.ts`
- Test: `src/store/index.test.ts`

**Interfaces:**
- Consumes: `Http`, `ApiError`, `createHttp`, `decodeToken` from `../api/http`; `GameSocket`, `ConnectionStatus` from `../api/ws`; `Game`, `MoveType` from `../core/types`.
- Produces:

```ts
type AppScreen = { name: 'auth' } | { name: 'lobby' } | { name: 'table'; gameId: string }
interface SocketLike { connect(): void; sendMove(t: MoveType, p: unknown): void; close(): void }
interface Deps {
  http: Http
  makeSocket(gameId: string, token: string, cb: GameSocketCallbacks): SocketLike
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}
interface AppState {
  token: string | null; userId: string | null; username: string | null
  screen: AppScreen; lobbyGames: Game[]; game: Game | null
  connection: ConnectionStatus; lastError: string | null
  signup(u: string, p: string, email: string): Promise<void>
  login(u: string, p: string): Promise<void>
  logout(): void
  refreshLobby(): Promise<void>
  createGame(): Promise<void>
  joinGame(gameId: string): Promise<void>
  sendMove(t: MoveType, payload: unknown): void
  leaveTable(): void
}
function createAppStore(deps: Deps): StoreApi<AppState>   // zustand vanilla store
const appStore: StoreApi<AppState>                        // default deps singleton
function useApp<T>(selector: (s: AppState) => T): T       // React hook over appStore
```

- [ ] **Step 1: Write the failing test**

Create `src/store/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { Game } from '../core/types'
import type { Http } from '../api/http'
import { ApiError } from '../api/http'
import { createAppStore, type Deps, type SocketLike } from './index'
import { baseGame } from '../core/testing/builders'

const TOKEN = `h.${btoa(JSON.stringify({ user_id: 'u1', username: 'alice' }))}.s`

function makeDeps(over: Partial<Http> = {}) {
  const sockets: Array<{ gameId: string; cb: Parameters<Deps['makeSocket']>[2]; socket: SocketLike }> = []
  const http: Http = {
    signup: vi.fn(async () => ({ id: 'u1', username: 'alice', email: 'a@b.c' })),
    login: vi.fn(async () => TOKEN),
    createGame: vi.fn(async () => baseGame({ id: 'g7', status: 'waiting' })),
    joinGame: vi.fn(async (_t, id) => baseGame({ id })),
    listGames: vi.fn(async () => [baseGame({ id: 'gA', status: 'waiting' })] as Game[]),
    getGame: vi.fn(async id => baseGame({ id })),
    ...over,
  }
  const storage = new Map<string, string>()
  const deps: Deps = {
    http,
    makeSocket: (gameId, _token, cb) => {
      const socket: SocketLike = { connect: vi.fn(), sendMove: vi.fn(), close: vi.fn() }
      sockets.push({ gameId, cb, socket })
      return socket
    },
    storage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => void storage.set(k, v),
      removeItem: k => void storage.delete(k),
    },
  }
  return { deps, http, sockets, storage }
}

describe('app store', () => {
  it('starts on auth when no saved token, lobby when one exists', () => {
    const { deps, storage } = makeDeps()
    expect(createAppStore(deps).getState().screen).toEqual({ name: 'auth' })
    storage.set('mighty.token', TOKEN)
    const restored = createAppStore(deps)
    expect(restored.getState().screen).toEqual({ name: 'lobby' })
    expect(restored.getState().userId).toBe('u1')
  })

  it('login stores the session and moves to the lobby', async () => {
    const { deps, storage } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    expect(store.getState()).toMatchObject({ token: TOKEN, userId: 'u1', username: 'alice' })
    expect(store.getState().screen).toEqual({ name: 'lobby' })
    expect(storage.get('mighty.token')).toBe(TOKEN)
  })

  it('signup then auto-login', async () => {
    const { deps, http } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().signup('alice', 'pw', 'a@b.c')
    expect(http.signup).toHaveBeenCalled()
    expect(store.getState().screen).toEqual({ name: 'lobby' })
  })

  it('login failure surfaces the error and stays on auth', async () => {
    const { deps } = makeDeps({ login: vi.fn(async () => { throw new ApiError(401, 'invalid credentials') }) })
    const store = createAppStore(deps)
    await store.getState().login('alice', 'bad')
    expect(store.getState().lastError).toBe('invalid credentials')
    expect(store.getState().screen).toEqual({ name: 'auth' })
  })

  it('createGame opens a socket and routes socket events into state', async () => {
    const { deps, sockets } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().createGame()
    expect(store.getState().screen).toEqual({ name: 'table', gameId: 'g7' })
    expect(sockets).toHaveLength(1)
    expect(sockets[0].socket.connect).toHaveBeenCalled()
    sockets[0].cb.onGame(baseGame({ id: 'g7', version: 12 }))
    expect(store.getState().game?.version).toBe(12)
    sockets[0].cb.onStatus('open')
    expect(store.getState().connection).toBe('open')
    sockets[0].cb.onError('not your turn')
    expect(store.getState().lastError).toBe('not your turn')
  })

  it('sendMove forwards to the socket; leaveTable closes it', async () => {
    const { deps, sockets } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().joinGame('gA')
    store.getState().sendMove('pass', null)
    expect(sockets[0].socket.sendMove).toHaveBeenCalledWith('pass', null)
    store.getState().leaveTable()
    expect(sockets[0].socket.close).toHaveBeenCalled()
    expect(store.getState().screen).toEqual({ name: 'lobby' })
  })

  it('a 401 during lobby actions logs out', async () => {
    const { deps } = makeDeps({ listGames: vi.fn(async () => { throw new ApiError(401, 'token expired') }) })
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().refreshLobby()
    expect(store.getState().screen).toEqual({ name: 'auth' })
    expect(store.getState().token).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the implementation**

Create `src/store/index.ts`:

```ts
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Game, MoveType } from '../core/types'
import { ApiError, createHttp, decodeToken, type Http } from '../api/http'
import { GameSocket, type ConnectionStatus, type GameSocketCallbacks } from '../api/ws'

export type AppScreen = { name: 'auth' } | { name: 'lobby' } | { name: 'table'; gameId: string }

export interface SocketLike {
  connect(): void
  sendMove(t: MoveType, p: unknown): void
  close(): void
}

export interface Deps {
  http: Http
  makeSocket(gameId: string, token: string, cb: GameSocketCallbacks): SocketLike
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

export interface AppState {
  token: string | null
  userId: string | null
  username: string | null
  screen: AppScreen
  lobbyGames: Game[]
  game: Game | null
  connection: ConnectionStatus
  lastError: string | null
  signup(u: string, p: string, email: string): Promise<void>
  login(u: string, p: string): Promise<void>
  logout(): void
  refreshLobby(): Promise<void>
  createGame(): Promise<void>
  joinGame(gameId: string): Promise<void>
  sendMove(t: MoveType, payload: unknown): void
  leaveTable(): void
}

const TOKEN_KEY = 'mighty.token'

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function createAppStore(deps: Deps): StoreApi<AppState> {
  let socket: SocketLike | null = null

  return createStore<AppState>((set, get) => {
    const fail = (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        get().logout()
        return
      }
      set({ lastError: errorMessage(e) })
    }

    const openSocket = (gameId: string) => {
      socket?.close()
      socket = deps.makeSocket(gameId, get().token ?? '', {
        onGame: g => set({ game: g }),
        onError: msg => set({ lastError: msg }),
        onStatus: s => set({ connection: s }),
      })
      socket.connect()
    }

    const enterGame = (g: Game) => {
      set({ game: g, screen: { name: 'table', gameId: g.id }, lastError: null })
      openSocket(g.id)
    }

    const saved = deps.storage.getItem(TOKEN_KEY)
    const session = saved
      ? { token: saved, ...decodeToken(saved) }
      : { token: null, userId: null, username: null }

    return {
      ...session,
      screen: saved ? ({ name: 'lobby' } as const) : ({ name: 'auth' } as const),
      lobbyGames: [],
      game: null,
      connection: 'idle',
      lastError: null,

      async signup(u, p, email) {
        try {
          await deps.http.signup(u, p, email)
          await get().login(u, p)
        } catch (e) {
          set({ lastError: errorMessage(e) })
        }
      },

      async login(u, p) {
        try {
          const token = await deps.http.login(u, p)
          deps.storage.setItem(TOKEN_KEY, token)
          set({ token, ...decodeToken(token), screen: { name: 'lobby' }, lastError: null })
        } catch (e) {
          set({ lastError: errorMessage(e) })
        }
      },

      logout() {
        socket?.close()
        socket = null
        deps.storage.removeItem(TOKEN_KEY)
        set({
          token: null, userId: null, username: null,
          screen: { name: 'auth' }, game: null, connection: 'idle',
        })
      },

      async refreshLobby() {
        try {
          set({ lobbyGames: await deps.http.listGames() })
        } catch (e) {
          fail(e)
        }
      },

      async createGame() {
        try {
          enterGame(await deps.http.createGame(get().token ?? ''))
        } catch (e) {
          fail(e)
        }
      },

      async joinGame(gameId) {
        try {
          enterGame(await deps.http.joinGame(get().token ?? '', gameId))
        } catch (e) {
          fail(e)
        }
      },

      sendMove(t, payload) {
        socket?.sendMove(t, payload)
      },

      leaveTable() {
        socket?.close()
        socket = null
        set({ screen: { name: 'lobby' }, game: null, connection: 'idle' })
      },
    }
  })
}

const defaultHttp = createHttp()

export const appStore = createAppStore({
  http: defaultHttp,
  makeSocket: (gameId, token, callbacks) =>
    new GameSocket({ gameId, token, callbacks, fetchGame: id => defaultHttp.getGame(id) }),
  storage: localStorage,
})

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore, selector)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/index.test.ts` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: app store with injectable http and socket deps"
```

---

### Task 11: AuthScreen and App shell routing

**Files:**
- Create: `src/components/AuthScreen.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`
- Test: `src/components/AuthScreen.test.tsx`

**Interfaces:**
- Consumes: `useApp` from `../store`.
- Produces: `AuthScreen({ error, onLogin, onSignup })` (dumb) and `App` that switches on `store.screen.name`: `auth` → AuthScreen container, `lobby` → placeholder `<p>Lobby</p>` (Task 12 replaces), `table` → placeholder `<p>Table</p>` (Task 18 replaces).

- [ ] **Step 1: Write the failing component test**

Create `src/components/AuthScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen'

describe('AuthScreen', () => {
  it('submits login with username and password', async () => {
    const onLogin = vi.fn()
    render(<AuthScreen error={null} onLogin={onLogin} onSignup={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Username'), 'alice')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(onLogin).toHaveBeenCalledWith('alice', 'pw123')
  })

  it('switches to signup mode and submits with email', async () => {
    const onSignup = vi.fn()
    render(<AuthScreen error={null} onLogin={vi.fn()} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    await userEvent.type(screen.getByLabelText('Username'), 'bob')
    await userEvent.type(screen.getByLabelText('Password'), 'pw123')
    await userEvent.type(screen.getByLabelText('Email'), 'bob@x.io')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(onSignup).toHaveBeenCalledWith('bob', 'pw123', 'bob@x.io')
  })

  it('shows the error as an alert', () => {
    render(<AuthScreen error="invalid credentials" onLogin={vi.fn()} onSignup={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('invalid credentials')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AuthScreen.test.tsx`
Expected: FAIL — cannot resolve `./AuthScreen`.

- [ ] **Step 3: Write the component and wire the App shell**

Create `src/components/AuthScreen.tsx`:

```tsx
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
```

Replace `src/App.tsx`:

```tsx
import { AuthScreen } from './components/AuthScreen'
import { useApp } from './store'

export function App() {
  const screen = useApp(s => s.screen)
  const lastError = useApp(s => s.lastError)
  const login = useApp(s => s.login)
  const signup = useApp(s => s.signup)

  if (screen.name === 'auth') {
    return <AuthScreen error={lastError} onLogin={login} onSignup={signup} />
  }
  if (screen.name === 'lobby') {
    return <p>Lobby</p>
  }
  return <p>Table</p>
}

export default App
```

Update `src/App.test.tsx` (App now renders AuthScreen by default; localStorage is empty in jsdom):

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the auth screen by default', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Mighty' })).toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run all tests**

Run: `npm test` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthScreen.tsx src/components/AuthScreen.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: auth screen and app shell routing"
```

---

### Task 12: LobbyScreen with 3-second polling

**Files:**
- Create: `src/components/LobbyScreen.tsx`
- Modify: `src/App.tsx` (replace the lobby placeholder)
- Test: `src/components/LobbyScreen.test.tsx`

**Interfaces:**
- Consumes: `Game` from `../core/types`; builders for tests; `useApp` in the App wiring.
- Produces: `LobbyScreen({ games, username, onCreate, onJoin, onRefresh, onLogout })` — calls `onRefresh` on mount and every 3000 ms until unmounted.

- [ ] **Step 1: Write the failing test**

Create `src/components/LobbyScreen.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LobbyScreen } from './LobbyScreen'
import { baseGame, player } from '../core/testing/builders'

describe('LobbyScreen', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const games = [
    baseGame({ id: 'g1', status: 'waiting', players: [player(0), player(1), null, null, null] }),
  ]

  it('lists waiting games with player counts and joins on click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onJoin = vi.fn()
    render(
      <LobbyScreen games={games} username="alice" onCreate={vi.fn()} onJoin={onJoin}
        onRefresh={vi.fn()} onLogout={vi.fn()} />,
    )
    expect(screen.getByText('g1')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join' }))
    expect(onJoin).toHaveBeenCalledWith('g1')
  })

  it('refreshes on mount and then every 3 seconds', () => {
    const onRefresh = vi.fn()
    const { unmount } = render(
      <LobbyScreen games={[]} username="alice" onCreate={vi.fn()} onJoin={vi.fn()}
        onRefresh={onRefresh} onLogout={vi.fn()} />,
    )
    expect(onRefresh).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(3000))
    expect(onRefresh).toHaveBeenCalledTimes(2)
    act(() => vi.advanceTimersByTime(6000))
    expect(onRefresh).toHaveBeenCalledTimes(4)
    unmount()
    act(() => vi.advanceTimersByTime(9000))
    expect(onRefresh).toHaveBeenCalledTimes(4)
  })

  it('creates a game', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onCreate = vi.fn()
    render(
      <LobbyScreen games={[]} username="alice" onCreate={onCreate} onJoin={vi.fn()}
        onRefresh={vi.fn()} onLogout={vi.fn()} />,
    )
    await user.click(screen.getByRole('button', { name: 'Create game' }))
    expect(onCreate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LobbyScreen.test.tsx`
Expected: FAIL — cannot resolve `./LobbyScreen`.

- [ ] **Step 3: Write the component and wire it into App**

Create `src/components/LobbyScreen.tsx`:

```tsx
import { useEffect } from 'react'
import type { Game } from '../core/types'

export interface LobbyScreenProps {
  games: Game[]
  username: string
  onCreate(): void
  onJoin(gameId: string): void
  onRefresh(): void
  onLogout(): void
}

export function LobbyScreen({ games, username, onCreate, onJoin, onRefresh, onLogout }: LobbyScreenProps) {
  useEffect(() => {
    onRefresh()
    const timer = setInterval(onRefresh, 3000)
    return () => clearInterval(timer)
  }, [onRefresh])

  return (
    <main className="lobby">
      <header>
        <h1>Lobby</h1>
        <span>{username}</span>
        <button onClick={onLogout}>Log out</button>
      </header>
      <button onClick={onCreate}>Create game</button>
      {games.length === 0 ? (
        <p>No games waiting — create one.</p>
      ) : (
        <ul>
          {games.map(g => (
            <li key={g.id}>
              <span>{g.id}</span>
              <span>{g.players.filter(Boolean).length}/5</span>
              <button onClick={() => onJoin(g.id)}>Join</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

In `src/App.tsx`, replace the lobby placeholder branch:

```tsx
import { LobbyScreen } from './components/LobbyScreen'
```

```tsx
  const username = useApp(s => s.username)
  const lobbyGames = useApp(s => s.lobbyGames)
  const refreshLobby = useApp(s => s.refreshLobby)
  const createGame = useApp(s => s.createGame)
  const joinGame = useApp(s => s.joinGame)
  const logout = useApp(s => s.logout)

  if (screen.name === 'lobby') {
    return (
      <LobbyScreen
        games={lobbyGames}
        username={username ?? ''}
        onCreate={createGame}
        onJoin={joinGame}
        onRefresh={refreshLobby}
        onLogout={logout}
      />
    )
  }
```

(Hook calls go at the top of `App` with the existing ones — hooks must not be conditional.)

- [ ] **Step 4: Run all tests**

Run: `npm test` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/LobbyScreen.tsx src/components/LobbyScreen.test.tsx src/App.tsx
git commit -m "feat: lobby screen with 3s polling"
```

---

### Task 13: Hand component

**Files:**
- Create: `src/components/Hand.tsx`
- Test: `src/components/Hand.test.tsx`

**Interfaces:**
- Consumes: `HandCard` from `../core/view`; `Card` from `../core/types`; `cardLabel`, `sameCard` from `../core/cards`.
- Produces: `Hand({ cards: HandCard[]; mode: 'play' | 'select'; selected?: Card[]; onCard(card: Card): void })`. In `play` mode unplayable cards are disabled; in `select` mode every card is enabled and selected cards get `aria-pressed`. Buttons carry `data-testid="hand-card-{suit}-{rank}"`; the container carries `data-testid="hand"`.

- [ ] **Step 1: Write the failing test**

Create `src/components/Hand.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Hand } from './Hand'
import { c } from '../core/testing/builders'

const cards = [
  { card: c('spades', 'A'), playable: true },
  { card: c('clubs', '5'), playable: false },
]

describe('Hand', () => {
  it('play mode: enables only playable cards and reports clicks', async () => {
    const onCard = vi.fn()
    render(<Hand cards={cards} mode="play" onCard={onCard} />)
    expect(screen.getByTestId('hand-card-clubs-5')).toBeDisabled()
    await userEvent.click(screen.getByTestId('hand-card-spades-A'))
    expect(onCard).toHaveBeenCalledWith(c('spades', 'A'))
  })

  it('select mode: everything enabled, selection marked pressed', async () => {
    const onCard = vi.fn()
    render(<Hand cards={cards} mode="select" selected={[c('clubs', '5')]} onCard={onCard} />)
    expect(screen.getByTestId('hand-card-clubs-5')).toBeEnabled()
    expect(screen.getByTestId('hand-card-clubs-5')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('hand-card-spades-A')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByTestId('hand-card-clubs-5'))
    expect(onCard).toHaveBeenCalledWith(c('clubs', '5'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Hand.test.tsx`
Expected: FAIL — cannot resolve `./Hand`.

- [ ] **Step 3: Write the component**

Create `src/components/Hand.tsx`:

```tsx
import type { Card } from '../core/types'
import type { HandCard } from '../core/view'
import { cardLabel, sameCard } from '../core/cards'

export interface HandProps {
  cards: HandCard[]
  mode: 'play' | 'select'
  selected?: Card[]
  onCard(card: Card): void
}

export function Hand({ cards, mode, selected = [], onCard }: HandProps) {
  const isSelected = (card: Card) => selected.some(s => sameCard(s, card))
  return (
    <div className="hand" data-testid="hand">
      {cards.map(({ card, playable }) => (
        <button
          key={`${card.suit}-${card.rank}`}
          data-testid={`hand-card-${card.suit}-${card.rank}`}
          disabled={mode === 'play' && !playable}
          aria-pressed={mode === 'select' ? isSelected(card) : undefined}
          onClick={() => onCard(card)}
        >
          {cardLabel(card)}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Hand.test.tsx` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/Hand.tsx src/components/Hand.test.tsx
git commit -m "feat: shared hand component"
```

---

### Task 14: BidPanel

**Files:**
- Create: `src/components/BidPanel.tsx`
- Test: `src/components/BidPanel.test.tsx`

**Interfaces:**
- Consumes: `TableView` from `../core/view`; `BidInput`, `isLegalBid` from `../core/rules`; `Suit` from `../core/types`; `tableView` + builders in tests.
- Produces: `BidPanel({ view: TableView; onBid(bid: BidInput): void; onPass(): void })`. Suit buttons named `♣ N`, `♦ N`, `♥ N`, `♠ N`, `NT N`; a `Tricks` select 3–10; a `Pass` button. Buttons disabled when not my turn or the candidate bid is illegal.

- [ ] **Step 1: Write the failing test**

Create `src/components/BidPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BidPanel } from './BidPanel'
import { tableView } from '../core/view'
import { baseGame, bid } from '../core/testing/builders'

const biddingView = (over = {}) =>
  tableView(baseGame({ status: 'bidding', current_turn: 0, ...over }), 'p0')

describe('BidPanel', () => {
  it('sends a suit bid with the chosen points', async () => {
    const onBid = vi.fn()
    render(<BidPanel view={biddingView()} onBid={onBid} onPass={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Tricks'), '5')
    await userEvent.click(screen.getByRole('button', { name: '♠ 5' }))
    expect(onBid).toHaveBeenCalledWith({ points: 5, suit: 'spades', is_no_trump: false })
  })

  it('sends a no-trump bid with suit none', async () => {
    const onBid = vi.fn()
    render(<BidPanel view={biddingView()} onBid={onBid} onPass={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'NT 3' }))
    expect(onBid).toHaveBeenCalledWith({ points: 3, suit: 'none', is_no_trump: true })
  })

  it('disables bids that do not beat the current bid', () => {
    const view = biddingView({ current_bid: bid('p1', 3, 'hearts'), bids: [bid('p1', 3, 'hearts')] })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByRole('button', { name: '♣ 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '♠ 3' })).toBeEnabled()
  })

  it('disables everything when it is not my turn', () => {
    render(<BidPanel view={biddingView({ current_turn: 1 })} onBid={vi.fn()} onPass={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pass' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '♠ 3' })).toBeDisabled()
  })

  it('passes and shows bid history', async () => {
    const onPass = vi.fn()
    const view = biddingView({ bids: [bid('p1', 4, 'clubs')] })
    render(<BidPanel view={view} onBid={vi.fn()} onPass={onPass} />)
    expect(screen.getByTestId('bid-history')).toHaveTextContent('p1: 4 clubs')
    await userEvent.click(screen.getByRole('button', { name: 'Pass' }))
    expect(onPass).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BidPanel.test.tsx`
Expected: FAIL — cannot resolve `./BidPanel`.

- [ ] **Step 3: Write the component**

Create `src/components/BidPanel.tsx`:

```tsx
import { useState } from 'react'
import type { Suit } from '../core/types'
import type { TableView } from '../core/view'
import { isLegalBid, type BidInput } from '../core/rules'

export interface BidPanelProps {
  view: TableView
  onBid(bid: BidInput): void
  onPass(): void
}

const SUIT_OPTIONS: { suit: Suit; label: string }[] = [
  { suit: 'clubs', label: '♣' },
  { suit: 'diamonds', label: '♦' },
  { suit: 'hearts', label: '♥' },
  { suit: 'spades', label: '♠' },
  { suit: 'none', label: 'NT' },
]

export function BidPanel({ view, onBid, onPass }: BidPanelProps) {
  const [points, setPoints] = useState(3)
  const candidate = (suit: Suit): BidInput => ({ points, suit, is_no_trump: suit === 'none' })

  return (
    <section className="bid-panel">
      <h2>Bidding</h2>
      <ol data-testid="bid-history">
        {view.bids.map((b, i) => (
          <li key={i}>{`${b.player_id}: ${b.points} ${b.is_no_trump ? 'no-trump' : b.suit}`}</li>
        ))}
      </ol>
      <label>
        Tricks
        <select value={points} onChange={e => setPoints(Number(e.target.value))}>
          {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      {SUIT_OPTIONS.map(({ suit, label }) => (
        <button
          key={suit}
          disabled={!view.isMyTurn || !isLegalBid(candidate(suit), view.currentBid)}
          onClick={() => onBid(candidate(suit))}
        >
          {`${label} ${points}`}
        </button>
      ))}
      <button disabled={!view.isMyTurn} onClick={onPass}>Pass</button>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BidPanel.test.tsx` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/BidPanel.tsx src/components/BidPanel.test.tsx
git commit -m "feat: bid panel with legality-gated buttons"
```

---

### Task 15: ExchangePanel

**Files:**
- Create: `src/components/ExchangePanel.tsx`
- Test: `src/components/ExchangePanel.test.tsx`

**Interfaces:**
- Consumes: `TableView`, `Hand`, `isValidDiscard`, `Card`, `sameCard`.
- Produces: `ExchangePanel({ view: TableView; onDiscard(cards: Card[]): void })`. Non-declarers see a waiting message. The declarer multi-selects from their 13-card hand; the confirm button (`Discard N/3`) enables only for a valid 3-card selection.

- [ ] **Step 1: Write the failing test**

Create `src/components/ExchangePanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExchangePanel } from './ExchangePanel'
import { tableView } from '../core/view'
import { baseGame, c, player } from '../core/testing/builders'

const hand = [c('clubs', '2'), c('clubs', '3'), c('clubs', '4'), c('hearts', 'A')]
const declarerView = () =>
  tableView(
    baseGame({
      status: 'exchanging', declarer: 0,
      players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
    }),
    'p0',
  )

describe('ExchangePanel', () => {
  it('shows a waiting message to non-declarers', () => {
    const view = tableView(baseGame({ status: 'exchanging', declarer: 0 }), 'p1')
    render(<ExchangePanel view={view} onDiscard={vi.fn()} />)
    expect(screen.getByText(/waiting for the declarer/i)).toBeInTheDocument()
  })

  it('enables confirm only at exactly 3 selected and submits them', async () => {
    const onDiscard = vi.fn()
    render(<ExchangePanel view={declarerView()} onDiscard={onDiscard} />)
    const confirm = () => screen.getByRole('button', { name: /^Discard/ })
    expect(confirm()).toBeDisabled()
    await userEvent.click(screen.getByTestId('hand-card-clubs-2'))
    await userEvent.click(screen.getByTestId('hand-card-clubs-3'))
    expect(confirm()).toBeDisabled()
    await userEvent.click(screen.getByTestId('hand-card-clubs-4'))
    expect(confirm()).toBeEnabled()
    await userEvent.click(confirm())
    expect(onDiscard).toHaveBeenCalledWith([c('clubs', '2'), c('clubs', '3'), c('clubs', '4')])
  })

  it('clicking a selected card deselects it', async () => {
    render(<ExchangePanel view={declarerView()} onDiscard={vi.fn()} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-2'))
    expect(screen.getByTestId('hand-card-clubs-2')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByTestId('hand-card-clubs-2'))
    expect(screen.getByTestId('hand-card-clubs-2')).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ExchangePanel.test.tsx`
Expected: FAIL — cannot resolve `./ExchangePanel`.

- [ ] **Step 3: Write the component**

Create `src/components/ExchangePanel.tsx`:

```tsx
import { useState } from 'react'
import type { Card } from '../core/types'
import type { TableView } from '../core/view'
import { sameCard } from '../core/cards'
import { isValidDiscard } from '../core/rules'
import { Hand } from './Hand'

export interface ExchangePanelProps {
  view: TableView
  onDiscard(cards: Card[]): void
}

export function ExchangePanel({ view, onDiscard }: ExchangePanelProps) {
  const [selected, setSelected] = useState<Card[]>([])

  if (!view.amDeclarer) {
    return <p>Waiting for the declarer to exchange with the kitty…</p>
  }

  const toggle = (card: Card) =>
    setSelected(sel => {
      const without = sel.filter(s => !sameCard(s, card))
      return without.length < sel.length ? without : [...sel, card]
    })

  const handCards = view.hand.map(h => h.card)

  return (
    <section className="exchange">
      <h2>Discard exactly 3 cards</h2>
      <Hand cards={view.hand} mode="select" selected={selected} onCard={toggle} />
      <button
        disabled={!isValidDiscard(handCards, selected)}
        onClick={() => onDiscard(selected)}
      >
        {`Discard ${selected.length}/3`}
      </button>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ExchangePanel.test.tsx` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExchangePanel.tsx src/components/ExchangePanel.test.tsx
git commit -m "feat: kitty exchange panel"
```

---

### Task 16: FriendCallPanel

**Files:**
- Create: `src/components/FriendCallPanel.tsx`
- Test: `src/components/FriendCallPanel.test.tsx`

**Interfaces:**
- Consumes: `TableView`, `Card`, `Suit`, `Rank`.
- Produces: `FriendCallPanel({ view: TableView; onCallPartner(card: Card): void })`. Declarer picks suit + rank selects (defaults hearts/A) and clicks `Call`. Non-declarers see a waiting message. A hint notes that calling a card from your own hand means playing alone.

- [ ] **Step 1: Write the failing test**

Create `src/components/FriendCallPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FriendCallPanel } from './FriendCallPanel'
import { tableView } from '../core/view'
import { baseGame } from '../core/testing/builders'

const callingView = (playerId = 'p0') =>
  tableView(baseGame({ status: 'calling', declarer: 0 }), playerId)

describe('FriendCallPanel', () => {
  it('shows a waiting message to non-declarers', () => {
    render(<FriendCallPanel view={callingView('p1')} onCallPartner={vi.fn()} />)
    expect(screen.getByText(/waiting for the declarer/i)).toBeInTheDocument()
  })

  it('calls the default hearts ace', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} />)
    await userEvent.click(screen.getByRole('button', { name: 'Call' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'hearts', rank: 'A' })
  })

  it('calls a chosen suit and rank', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} />)
    await userEvent.selectOptions(screen.getByLabelText('Suit'), 'diamonds')
    await userEvent.selectOptions(screen.getByLabelText('Rank'), 'K')
    await userEvent.click(screen.getByRole('button', { name: 'Call' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'diamonds', rank: 'K' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/FriendCallPanel.test.tsx`
Expected: FAIL — cannot resolve `./FriendCallPanel`.

- [ ] **Step 3: Write the component**

Create `src/components/FriendCallPanel.tsx`:

```tsx
import { useState } from 'react'
import type { Card, Rank, Suit } from '../core/types'
import type { TableView } from '../core/view'

export interface FriendCallPanelProps {
  view: TableView
  onCallPartner(card: Card): void
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

export function FriendCallPanel({ view, onCallPartner }: FriendCallPanelProps) {
  const [suit, setSuit] = useState<Suit>('hearts')
  const [rank, setRank] = useState<Rank>('A')

  if (!view.amDeclarer) {
    return <p>Waiting for the declarer to call a friend…</p>
  }

  return (
    <section className="friend-call">
      <h2>Call your friend</h2>
      <label>
        Suit
        <select value={suit} onChange={e => setSuit(e.target.value as Suit)}>
          {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>
        Rank
        <select value={rank} onChange={e => setRank(e.target.value as Rank)}>
          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <button onClick={() => onCallPartner({ suit, rank })}>Call</button>
      <p>Calling a card from your own hand means you play alone (no friend, doubled score).</p>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/FriendCallPanel.test.tsx` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/FriendCallPanel.tsx src/components/FriendCallPanel.test.tsx
git commit -m "feat: friend call panel"
```

---

### Task 17: PlayArea with joker-call prompt

**Files:**
- Create: `src/components/PlayArea.tsx`
- Test: `src/components/PlayArea.test.tsx`

**Interfaces:**
- Consumes: `TableView`, `Hand`, `cardLabel`, `sameCard`, `Card`.
- Produces: `PlayArea({ view: TableView; onPlayCard(card: Card, callJoker: boolean): void })`. Renders the 5 seats (testid `seat-{n}`, turn/declarer/partner markers), the current trick (testid `trick-card-{seat}`), and the hand in play mode. Clicking `view.jokerCallCard` opens a dialog with `Call the Joker` / `Play without calling`; any other card plays immediately with `callJoker: false`.

- [ ] **Step 1: Write the failing test**

Create `src/components/PlayArea.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayArea } from './PlayArea'
import { tableView } from '../core/view'
import { baseGame, c, player, trick } from '../core/testing/builders'

const playingGame = (hand: ReturnType<typeof c>[], over = {}) =>
  baseGame({
    status: 'playing', trump: 'hearts', current_turn: 0, declarer: 1,
    players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
    tricks: [trick({ winner: 0 }), trick()],
    ...over,
  })

describe('PlayArea', () => {
  it('renders seats and the current trick', () => {
    const g = playingGame([c('clubs', '5')], {
      tricks: [
        trick({ winner: 2 }),
        trick({ lead_suit: 'diamonds', cards: [{ player_id: 'p2', seat: 2, card: c('diamonds', 'Q') }] }),
      ],
    })
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={vi.fn()} />)
    expect(screen.getByTestId('seat-1')).toHaveTextContent('declarer')
    expect(screen.getByTestId('trick-card-2')).toHaveTextContent('♦Q')
  })

  it('plays an ordinary card immediately without calling the joker', async () => {
    const onPlayCard = vi.fn()
    render(<PlayArea view={tableView(playingGame([c('clubs', '5')]), 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-5'))
    expect(onPlayCard).toHaveBeenCalledWith(c('clubs', '5'), false)
  })

  it('offers the joker call when leading the joker caller', async () => {
    const onPlayCard = vi.fn()
    const g = playingGame([c('clubs', '3'), c('diamonds', '2')])
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-3'))
    expect(onPlayCard).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Call the Joker' }))
    expect(onPlayCard).toHaveBeenCalledWith(c('clubs', '3'), true)
  })

  it('can decline the joker call', async () => {
    const onPlayCard = vi.fn()
    const g = playingGame([c('clubs', '3'), c('diamonds', '2')])
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-3'))
    await userEvent.click(screen.getByRole('button', { name: 'Play without calling' }))
    expect(onPlayCard).toHaveBeenCalledWith(c('clubs', '3'), false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PlayArea.test.tsx`
Expected: FAIL — cannot resolve `./PlayArea`.

- [ ] **Step 3: Write the component**

Create `src/components/PlayArea.tsx`:

```tsx
import { useState } from 'react'
import type { Card } from '../core/types'
import type { TableView } from '../core/view'
import { cardLabel, sameCard } from '../core/cards'
import { Hand } from './Hand'

export interface PlayAreaProps {
  view: TableView
  onPlayCard(card: Card, callJoker: boolean): void
}

export function PlayArea({ view, onPlayCard }: PlayAreaProps) {
  const [pendingCaller, setPendingCaller] = useState<Card | null>(null)
  const played = new Map(view.currentTrick.map(pc => [pc.seat, pc.card]))

  const handleCard = (card: Card) => {
    if (view.jokerCallCard && sameCard(card, view.jokerCallCard)) setPendingCaller(card)
    else onPlayCard(card, false)
  }

  const resolveCall = (callJoker: boolean) => {
    if (pendingCaller) onPlayCard(pendingCaller, callJoker)
    setPendingCaller(null)
  }

  return (
    <section className="play-area">
      <ul className="seats">
        {view.seats.map(s => (
          <li key={s.seat} data-testid={`seat-${s.seat}`} className={s.isTurn ? 'turn' : ''}>
            <span>
              {s.name ?? 'empty'}
              {s.isMe ? ' (you)' : ''}
              {s.isDeclarer ? ' — declarer' : ''}
              {s.isPartner ? ' — partner' : ''}
            </span>
            <span data-testid={`trick-card-${s.seat}`}>
              {played.has(s.seat) ? cardLabel(played.get(s.seat)!) : ''}
            </span>
          </li>
        ))}
      </ul>
      <Hand cards={view.hand} mode="play" onCard={handleCard} />
      {pendingCaller && (
        <div role="dialog" aria-label="Call the Joker?">
          <p>Lead the Joker Caller — force the Joker out?</p>
          <button onClick={() => resolveCall(true)}>Call the Joker</button>
          <button onClick={() => resolveCall(false)}>Play without calling</button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PlayArea.test.tsx` — Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayArea.tsx src/components/PlayArea.test.tsx
git commit -m "feat: play area with trick display and joker-call prompt"
```

---

### Task 18: ScoreBoard, GameTable phase switcher, GameScreen container

**Files:**
- Create: `src/components/ScoreBoard.tsx`, `src/components/GameTable.tsx`, `src/components/GameScreen.tsx`
- Modify: `src/App.tsx` (replace the table placeholder)
- Test: `src/components/GameTable.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 6, 13–17; `useApp`, `tableView`, `sendMove`, `leaveTable` for the container.
- Produces:
  - `ScoreBoard({ view: TableView })` — testid `scoreboard`, shows contract and a per-player points table.
  - `GameTable({ view, connection, error, onBid, onPass, onDiscard, onCallPartner, onPlayCard, onLeave })` — header with testid `game-id` and `phase`, a reconnecting banner when `connection !== 'open'`, alert on `error`, and the phase-appropriate panel. Hand is visible read-only during bidding/calling.
  - `GameScreen()` — container: derives `tableView(game, userId)` from the store and maps callbacks to `sendMove` with the exact WS payloads: bid → `{points, suit, is_no_trump}`; pass → `null`; discard → `Card[]`; call_partner → `Card`; play_card → `{card, call_joker}`.

- [ ] **Step 1: Write the failing test**

Create `src/components/GameTable.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GameTable, type GameTableProps } from './GameTable'
import { tableView } from '../core/view'
import { baseGame, bid, c, player, trick } from '../core/testing/builders'

function renderTable(over: Partial<GameTableProps> = {}, game = baseGame({ status: 'waiting' })) {
  const props: GameTableProps = {
    view: tableView(game, 'p0'),
    connection: 'open',
    error: null,
    onBid: vi.fn(), onPass: vi.fn(), onDiscard: vi.fn(),
    onCallPartner: vi.fn(), onPlayCard: vi.fn(), onLeave: vi.fn(),
    ...over,
  }
  render(<GameTable {...props} />)
  return props
}

describe('GameTable', () => {
  it('shows game id and waiting status', () => {
    renderTable({}, baseGame({ status: 'waiting', players: [player(0), player(1), null, null, null] }))
    expect(screen.getByTestId('game-id')).toHaveTextContent('g1')
    expect(screen.getByText(/waiting for players \(2\/5\)/i)).toBeInTheDocument()
  })

  it('renders the bid panel during bidding', () => {
    renderTable({}, baseGame({ status: 'bidding' }))
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument()
  })

  it('renders the exchange panel during exchanging', () => {
    renderTable({}, baseGame({ status: 'exchanging', declarer: 1 }))
    expect(screen.getByText(/waiting for the declarer to exchange/i)).toBeInTheDocument()
  })

  it('renders the play area during playing', () => {
    renderTable({}, baseGame({ status: 'playing', tricks: [trick()] }))
    expect(screen.getByTestId('seat-0')).toBeInTheDocument()
  })

  it('renders the scoreboard when finished', () => {
    renderTable({}, baseGame({
      status: 'finished',
      contract: bid('p0', 5, 'spades'),
      scores: { p0: 11 },
    }))
    expect(screen.getByTestId('scoreboard')).toBeInTheDocument()
    expect(screen.getByText(/contract: 5 spades/i)).toBeInTheDocument()
  })

  it('shows a reconnecting banner and errors', () => {
    renderTable({ connection: 'reconnecting', error: 'not your turn' }, baseGame({ status: 'bidding' }))
    expect(screen.getByRole('status')).toHaveTextContent(/reconnecting/i)
    expect(screen.getByRole('alert')).toHaveTextContent('not your turn')
  })

  it('shows my hand read-only during bidding', () => {
    const g = baseGame({
      status: 'bidding',
      players: [player(0, { hand: [c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
    })
    renderTable({}, g)
    expect(screen.getByTestId('hand-card-clubs-5')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/GameTable.test.tsx`
Expected: FAIL — cannot resolve `./GameTable`.

- [ ] **Step 3: Write the components**

Create `src/components/ScoreBoard.tsx`:

```tsx
import type { TableView } from '../core/view'

export function ScoreBoard({ view }: { view: TableView }) {
  return (
    <section data-testid="scoreboard">
      <h2>Hand finished</h2>
      {view.contract && (
        <p>
          {`Contract: ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
        </p>
      )}
      <table>
        <thead>
          <tr><th>Player</th><th>Card points</th><th>Role</th></tr>
        </thead>
        <tbody>
          {view.scores.map(row => {
            const seat = view.seats.find(s => s.name === row.name)
            const role = seat?.isDeclarer ? 'declarer' : seat?.isPartner ? 'partner' : ''
            return (
              <tr key={row.playerId}>
                <td>{row.name}</td>
                <td>{row.cardPoints}</td>
                <td>{role}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
```

Create `src/components/GameTable.tsx`:

```tsx
import type { Card } from '../core/types'
import type { TableView } from '../core/view'
import type { ConnectionStatus } from '../api/ws'
import type { BidInput } from '../core/rules'
import { BidPanel } from './BidPanel'
import { ExchangePanel } from './ExchangePanel'
import { FriendCallPanel } from './FriendCallPanel'
import { Hand } from './Hand'
import { PlayArea } from './PlayArea'
import { ScoreBoard } from './ScoreBoard'

export interface GameTableProps {
  view: TableView
  connection: ConnectionStatus
  error: string | null
  onBid(bid: BidInput): void
  onPass(): void
  onDiscard(cards: Card[]): void
  onCallPartner(card: Card): void
  onPlayCard(card: Card, callJoker: boolean): void
  onLeave(): void
}

export function GameTable(props: GameTableProps) {
  const { view, connection, error } = props
  const seated = view.seats.filter(s => !s.isEmpty).length

  return (
    <main className="table">
      <header>
        <span data-testid="game-id">{view.gameId}</span>
        <span data-testid="phase">{view.phase}</span>
        {view.contract && (
          <span>
            {`Contract ${view.contract.points} ${view.contract.is_no_trump ? 'no-trump' : view.contract.suit}`}
          </span>
        )}
        <button onClick={props.onLeave}>Leave</button>
      </header>
      {connection !== 'open' && <p role="status">Reconnecting…</p>}
      {error && <p role="alert">{error}</p>}

      {view.phase === 'waiting' && <p>{`Waiting for players (${seated}/5)…`}</p>}
      {view.phase === 'bidding' && <BidPanel view={view} onBid={props.onBid} onPass={props.onPass} />}
      {view.phase === 'exchanging' && <ExchangePanel view={view} onDiscard={props.onDiscard} />}
      {view.phase === 'calling' && <FriendCallPanel view={view} onCallPartner={props.onCallPartner} />}
      {view.phase === 'playing' && <PlayArea view={view} onPlayCard={props.onPlayCard} />}
      {view.phase === 'finished' && <ScoreBoard view={view} />}

      {(view.phase === 'bidding' || view.phase === 'calling') && view.hand.length > 0 && (
        <Hand cards={view.hand} mode="play" onCard={() => undefined} />
      )}
    </main>
  )
}
```

Create `src/components/GameScreen.tsx`:

```tsx
import { tableView } from '../core/view'
import { useApp } from '../store'
import { GameTable } from './GameTable'

export function GameScreen() {
  const game = useApp(s => s.game)
  const userId = useApp(s => s.userId)
  const connection = useApp(s => s.connection)
  const lastError = useApp(s => s.lastError)
  const sendMove = useApp(s => s.sendMove)
  const leaveTable = useApp(s => s.leaveTable)

  if (!game || !userId) return <p>Loading game…</p>

  return (
    <GameTable
      view={tableView(game, userId)}
      connection={connection}
      error={lastError}
      onBid={b => sendMove('bid', b)}
      onPass={() => sendMove('pass', null)}
      onDiscard={cards => sendMove('discard', cards)}
      onCallPartner={card => sendMove('call_partner', card)}
      onPlayCard={(card, callJoker) => sendMove('play_card', { card, call_joker: callJoker })}
      onLeave={leaveTable}
    />
  )
}
```

In `src/App.tsx`, replace the final `return <p>Table</p>` with:

```tsx
  return <GameScreen />
```

and add `import { GameScreen } from './components/GameScreen'`.

- [ ] **Step 4: Run all tests and typecheck**

Run: `npm test && npx tsc --noEmit` — Expected: all passed, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components src/App.tsx
git commit -m "feat: game table phase switcher, scoreboard, and store wiring"
```

---

### Task 19: Bot harness

**Files:**
- Create: `e2e/bots/bot.ts`, `e2e/bots/spawn.ts`, `e2e/bots/run-bots.ts`
- Modify: `package.json` (scripts + deps)
- Test: manual smoke against the real backend (this module exists to *drive* the real server; its correctness is proven by Tasks 20–21)

**Interfaces:**
- Consumes: `createHttp`, `decodeToken` from `../../src/api/http`; `parseServerMessage` from `../../src/core/types`; `legalPlays` from `../../src/core/rules`.
- Produces:
  - `runBot(opts: { name: string; gameId?: string; opensBidding?: boolean; onRaw?(raw: string): void }): Promise<{ done: Promise<Game>; gameId: string; userId: string; stop(): void }>` — signs up (tolerates 409), logs in, creates or joins the game, then plays: passes unless `opensBidding` and nobody has bid (then bids 3♣); as declarer discards its first 3 cards and calls ♥A; in play, plays the first legal card; on a server ERROR frame retries with the next legal card.
  - `spawnBots(gameId: string, count?: number): Promise<{ stop(): void; allDone: Promise<void> }>` — bot 0 opens bidding.
  - `npm run bots -- <gameId>` dev tool to fill 4 seats against a local server.
- Backend URL: `process.env.MIGHTY_BACKEND_URL ?? 'http://localhost:8080'` (bots talk to the Go server directly; the `ws` package sends no Origin header, which the server allows).

- [ ] **Step 1: Install harness deps**

```bash
npm install -D ws @types/ws tsx
```

Add to `package.json` scripts: `"bots": "tsx e2e/bots/run-bots.ts"`.

- [ ] **Step 2: Write the bot**

Create `e2e/bots/bot.ts`:

```ts
import WebSocket from 'ws'
import { createHttp, decodeToken } from '../../src/api/http'
import { legalPlays } from '../../src/core/rules'
import { parseServerMessage, type Game, type MoveType } from '../../src/core/types'

const BACKEND = process.env.MIGHTY_BACKEND_URL ?? 'http://localhost:8080'

export interface BotOptions {
  name: string
  gameId?: string
  opensBidding?: boolean
  onRaw?(raw: string): void
}

export interface BotHandle {
  done: Promise<Game>
  gameId: string
  userId: string
  stop(): void
}

export async function runBot(opts: BotOptions): Promise<BotHandle> {
  const http = createHttp(fetch, BACKEND)
  try {
    await http.signup(opts.name, 'botpass123', `${opts.name}@bots.local`)
  } catch {
    // 409: bot account already exists — fine, just log in.
  }
  const token = await http.login(opts.name, 'botpass123')
  const { userId } = decodeToken(token)
  const game = opts.gameId ? await http.joinGame(token, opts.gameId) : await http.createGame(token)

  const ws = new WebSocket(`${BACKEND.replace(/^http/, 'ws')}/games/${game.id}/ws`)

  let resolveDone!: (g: Game) => void
  let rejectDone!: (e: Error) => void
  const done = new Promise<Game>((res, rej) => {
    resolveDone = res
    rejectDone = rej
  })

  let lastActed = -1
  let retryOffset = 0
  let current: Game | null = null

  const send = (moveType: MoveType, payload: unknown, version: number) =>
    ws.send(JSON.stringify({ type: 'MOVE', move_type: moveType, payload, client_version: version }))

  const act = (g: Game) => {
    const me = g.players.find(p => p?.id === userId)
    if (!me) return
    if (g.status === 'finished') {
      resolveDone(g)
      ws.close()
      return
    }
    if (g.version === lastActed) return

    if (g.status === 'bidding' && g.current_turn === me.seat) {
      lastActed = g.version
      if (opts.opensBidding && !g.current_bid) {
        send('bid', { points: 3, suit: 'clubs', is_no_trump: false }, g.version)
      } else {
        send('pass', null, g.version)
      }
    } else if (g.status === 'exchanging' && g.declarer === me.seat) {
      lastActed = g.version
      send('discard', (me.hand ?? []).slice(0, 3), g.version)
    } else if (g.status === 'calling' && g.declarer === me.seat) {
      lastActed = g.version
      send('call_partner', { suit: 'hearts', rank: 'A' }, g.version)
    } else if (g.status === 'playing' && g.current_turn === me.seat) {
      lastActed = g.version
      const plays = legalPlays(g, me.seat)
      const card = plays[Math.min(retryOffset, Math.max(plays.length - 1, 0))]
      if (card) send('play_card', { card, call_joker: false }, g.version)
    }
  }

  ws.on('open', () => ws.send(JSON.stringify({ type: 'AUTH', token })))
  ws.on('message', data => {
    const raw = data.toString()
    opts.onRaw?.(raw)
    const msg = parseServerMessage(raw)
    if (msg.kind === 'error') {
      // Rejected move: try the next legal option on the same state.
      retryOffset += 1
      if (current) {
        lastActed = -1
        act(current)
      }
      return
    }
    retryOffset = 0
    current = msg.game
    act(msg.game)
  })
  ws.on('error', e => rejectDone(e instanceof Error ? e : new Error(String(e))))

  return { done, gameId: game.id, userId, stop: () => ws.close() }
}
```

- [ ] **Step 3: Write spawn and the dev tool**

Create `e2e/bots/spawn.ts`:

```ts
import { runBot, type BotHandle } from './bot'

export interface Bots {
  stop(): void
  allDone: Promise<void>
}

export async function spawnBots(gameId: string, count = 4): Promise<Bots> {
  const stamp = Date.now()
  const bots: BotHandle[] = []
  for (let i = 0; i < count; i++) {
    bots.push(await runBot({ name: `bot${i}_${stamp}`, gameId, opensBidding: i === 0 }))
  }
  return {
    stop: () => bots.forEach(b => b.stop()),
    allDone: Promise.all(bots.map(b => b.done)).then(() => undefined),
  }
}
```

Create `e2e/bots/run-bots.ts`:

```ts
import { spawnBots } from './spawn'

const gameId = process.argv[2]
if (!gameId) {
  console.error('usage: npm run bots -- <gameId>')
  process.exit(1)
}

const bots = await spawnBots(gameId, 4)
console.log(`4 bots joined game ${gameId}; playing until finished…`)
await bots.allDone
console.log('game finished')
```

- [ ] **Step 4: Typecheck and smoke-test against the real backend (optional if backend unavailable)**

Run: `npx tsc --noEmit`
Expected: no errors.

With the backend up (see Task 20 Step 1), start `npm run dev`, create a game in the browser, copy the game id, and run `npm run bots -- <gameId>`. Expected: the game leaves `waiting`, bidding completes, and play proceeds.

- [ ] **Step 5: Commit**

```bash
git add e2e/bots package.json package-lock.json
git commit -m "feat: bot harness for filling seats and auto-playing games"
```

---

### Task 20: Fixture capture and replay test

**Files:**
- Create: `scripts/capture-fixtures.ts`, `fixtures/full-game.json` (generated, committed), `src/core/replay.test.ts`
- Modify: `package.json` (script)

**Interfaces:**
- Consumes: `runBot` from `../e2e/bots/bot`; `tableView` from `../src/core/view`.
- Produces: `npm run capture` — plays a scripted 5-bot game against the real server and writes every `Game` broadcast seen by the host bot to `fixtures/full-game.json`. The committed capture is the cross-frontend contract corpus (the Swift client will replay the same file).

**Prerequisite:** running backend:

```bash
cd ../go-mighty
cp -n secrets/postgres_password.txt.example secrets/postgres_password.txt
docker compose up -d --build
# wait until it answers:
until curl -sf http://localhost:8080/games > /dev/null; do sleep 1; done
cd ../mighty-frontend
```

- [ ] **Step 1: Write the capture script**

Create `scripts/capture-fixtures.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { runBot } from '../e2e/bots/bot'

const frames: unknown[] = []
const stamp = Date.now()

const host = await runBot({
  name: `cap0_${stamp}`,
  opensBidding: true,
  onRaw: raw => {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.type !== 'ERROR') frames.push(parsed)
  },
})
await Promise.all(
  [1, 2, 3, 4].map(i => runBot({ name: `cap${i}_${stamp}`, gameId: host.gameId })),
)
await host.done

mkdirSync('fixtures', { recursive: true })
writeFileSync('fixtures/full-game.json', JSON.stringify(frames, null, 1))
console.log(`captured ${frames.length} broadcasts to fixtures/full-game.json`)
```

Add to `package.json` scripts: `"capture": "tsx scripts/capture-fixtures.ts"`.

- [ ] **Step 2: Capture (backend must be running)**

Run: `npm run capture`
Expected: `captured N broadcasts to fixtures/full-game.json` with N ≥ 20 (5 joins + bids + exchange + call + ~50 plays).

- [ ] **Step 3: Write the replay test**

Create `src/core/replay.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Game } from './types'
import { tableView } from './view'

const states = JSON.parse(readFileSync('fixtures/full-game.json', 'utf8')) as Game[]

describe('captured full-game replay (real server contract)', () => {
  it('captured a meaningful number of broadcasts', () => {
    expect(states.length).toBeGreaterThan(20)
  })

  it('reaches every phase of a hand', () => {
    const phases = new Set(states.map(s => s.status))
    for (const phase of ['bidding', 'exchanging', 'calling', 'playing', 'finished']) {
      expect(phases, `missing phase ${phase}`).toContain(phase)
    }
  })

  it('derives a coherent view for every seated player in every state', () => {
    for (const g of states) {
      for (const p of g.players) {
        if (!p) continue
        const v = tableView(g, p.id)
        expect(v.mySeat).toBe(p.seat)
        expect(v.seats).toHaveLength(5)
        if (v.hand.some(h => h.playable)) {
          expect(g.status).toBe('playing')
          expect(g.current_turn).toBe(p.seat)
        }
      }
    }
  })

  it('versions never decrease', () => {
    for (let i = 1; i < states.length; i++) {
      expect(states[i].version).toBeGreaterThanOrEqual(states[i - 1].version)
    }
  })
})
```

- [ ] **Step 4: Run the full unit suite**

Run: `npm test` — Expected: all passed, including the replay suite.

- [ ] **Step 5: Commit (including the captured fixture)**

```bash
git add scripts/capture-fixtures.ts fixtures/full-game.json src/core/replay.test.ts package.json
git commit -m "feat: fixture capture script and real-server replay tests"
```

---

### Task 21: End-to-end full game (Playwright vs real backend)

**Files:**
- Create: `playwright.config.ts`, `e2e/full-game.spec.ts`
- Modify: `package.json` (script), `vite.config.ts` only if the vitest `include` was not already limited to `src/`

**Interfaces:**
- Consumes: `spawnBots` from `./bots/spawn`; the running app (`npm run dev`) and backend (docker compose, as in Task 20).
- Produces: `npm run e2e` — one browser player + 4 bots complete a full hand.

- [ ] **Step 1: Install and configure Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
```

Add to `package.json` scripts: `"e2e": "playwright test"`.

- [ ] **Step 2: Write the E2E spec**

Create `e2e/full-game.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { spawnBots } from './bots/spawn'

test('a browser player and four bots complete a full hand', async ({ page }) => {
  const name = `e2e_${Date.now()}`

  // Sign up and land in the lobby.
  await page.goto('/')
  await page.getByRole('button', { name: 'Need an account? Sign up' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByLabel('Password').fill('secret123')
  await page.getByLabel('Email').fill(`${name}@e2e.local`)
  await page.getByRole('button', { name: 'Sign up' }).click()

  // Create a game and read its id from the table header.
  await page.getByRole('button', { name: 'Create game' }).click()
  await expect(page.getByTestId('game-id')).toBeVisible()
  const gameId = (await page.getByTestId('game-id').textContent())!

  // Fill the remaining 4 seats; bot 0 opens the bidding with 3 clubs.
  const bots = await spawnBots(gameId, 4)

  // Drive the browser: pass in bidding, play the first enabled card, decline
  // joker calls, until the scoreboard appears. Bots handle declarer duties.
  const scoreboard = page.getByTestId('scoreboard')
  const deadline = Date.now() + 210_000
  while (!(await scoreboard.isVisible()) && Date.now() < deadline) {
    const noCall = page.getByRole('button', { name: 'Play without calling' })
    if (await noCall.isVisible().catch(() => false)) {
      await noCall.click().catch(() => undefined)
      continue
    }
    const pass = page.getByRole('button', { name: 'Pass' })
    if (await pass.isEnabled().catch(() => false)) {
      await pass.click().catch(() => undefined)
      continue
    }
    const card = page.locator('[data-testid="hand"] button:enabled').first()
    if ((await card.count()) > 0) {
      await card.click().catch(() => undefined)
    }
    await page.waitForTimeout(300)
  }

  await expect(scoreboard).toBeVisible()
  await expect(page.getByText(/contract: 3 clubs/i)).toBeVisible()
  bots.stop()
})
```

- [ ] **Step 3: Run it against the real stack**

Backend up (Task 20 Step 1 prerequisite), then:

Run: `npm run e2e`
Expected: 1 passed. (The hand takes 1–3 minutes of simulated turns.)

- [ ] **Step 4: Run everything**

Run: `npm test && npm run e2e` — Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/full-game.spec.ts package.json package-lock.json
git commit -m "test: end-to-end full game against the real backend"
```

---

### Task 22: Electron shell and packaged smoke test

**Files:**
- Create: `electron/main.cjs`, `e2e/electron.spec.ts`
- Modify: `package.json` (script + `main` field)

**Interfaces:**
- Consumes: the built/served web app; Playwright's `_electron`.
- Produces: `npm run electron` opens a desktop window loading `MIGHTY_APP_URL` (default `http://localhost:5173`). The shell is deliberately thin: window + lifecycle only, no Node integration, no preload. Deployment note: any static host works as long as it serves the app **same-origin** with a proxy for `/auth` and `/games` (as `vite preview` does).

- [ ] **Step 1: Install Electron and write the main process**

```bash
npm install -D electron
```

Create `electron/main.cjs`:

```js
const { app, BrowserWindow } = require('electron')

const APP_URL = process.env.MIGHTY_APP_URL ?? 'http://localhost:5173'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  win.loadURL(APP_URL)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

Add to `package.json`: `"main": "electron/main.cjs"` and script `"electron": "electron ."`.

- [ ] **Step 2: Write the failing smoke test**

Create `e2e/electron.spec.ts`:

```ts
import { _electron as electron, expect, test } from '@playwright/test'

test('electron shell boots to the auth screen', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, MIGHTY_APP_URL: 'http://localhost:5173' },
  })
  const window = await app.firstWindow()
  await expect(window.getByRole('heading', { name: 'Mighty' })).toBeVisible()
  await expect(window.getByLabelText?.('Username') ?? window.getByLabel('Username')).toBeVisible()
  await app.close()
})
```

(Use `window.getByLabel('Username')` — the line above shows the fallback only because some Playwright versions differ; keep the simple `getByLabel` form.)

Final form:

```ts
import { _electron as electron, expect, test } from '@playwright/test'

test('electron shell boots to the auth screen', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, MIGHTY_APP_URL: 'http://localhost:5173' },
  })
  const window = await app.firstWindow()
  await expect(window.getByRole('heading', { name: 'Mighty' })).toBeVisible()
  await expect(window.getByLabel('Username')).toBeVisible()
  await app.close()
})
```

- [ ] **Step 3: Run the smoke test**

Run: `npm run e2e -- electron.spec.ts`
Expected: 1 passed (the Playwright webServer starts the dev server automatically).

- [ ] **Step 4: Run the complete suite one last time**

Run: `npm test && npm run e2e && npx tsc --noEmit`
Expected: everything green.

- [ ] **Step 5: Commit**

```bash
git add electron package.json package-lock.json e2e/electron.spec.ts
git commit -m "feat: thin electron shell with boot smoke test"
```

---

## Milestone map (spec §9 → tasks)

- **M1 Core & contract**: Tasks 1–6
- **M2 API layer**: Tasks 7–10
- **M3 Screens**: Tasks 11–18
- **M4 E2E**: Tasks 19–21 (bot harness, fixture capture, Playwright)
- **M5 Electron**: Task 22

## Out of scope (per spec §10)

Animations/sounds, spectator mode, mobile layouts, multi-hand sessions, backend changes (including per-player broadcast filtering — the client renders only its own private data regardless).
