# Backend Contract Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the web client to the corrected go-mighty contract: joker-lead suit picker (breaking fix), no-friend call, corrected scoreboard semantics, busy retry, updated bots, and re-captured fixtures.

**Architecture:** Unchanged thin-client design — server state authoritative, pure `core/` under dumb components. Changes are additive: two new payload types, two new `TableView` fields, one new dialog, one new button, one store-level retry, bot/fixture refresh.

**Tech Stack:** React 18 + TS strict + Vite, zustand, Vitest + RTL, Playwright, existing bot harness (`tsx` + `ws`).

**Spec:** `docs/superpowers/specs/2026-07-17-contract-adaptation-design.md`

## Global Constraints

- Working directory: `/Users/joekhosbayar/mighty/mighty-frontend`. Dev server port **5199**; backend at `http://localhost:8080` must run the contract branch (`cd ../go-mighty && docker compose up -d --build` — already deployed as of plan writing).
- Wire field names verbatim: `called_suit`, `call_joker`, `no_friend`, `player_id`, `client_version`. `called_suit` is sent **only** when leading the Joker (a lead = current trick has zero cards); the server rejects it on any other play.
- The client stops sending the legacy bare-card `call_partner` payload; it sends `{"card": {...}}` or `{"no_friend": true}`.
- Busy retry: exactly one automatic resend of the most recent move, 300 ms after a WS error whose text is exactly `game busy`; any error on the retry surfaces normally.
- `scores` map = round scores (declarer full, partner half, others 0); card points = length of `player.points`.
- TDD per task: failing test → verify RED → implement → verify GREEN. All tests colocated `src/**/*.test.ts(x)`; unit/component tests never need a backend. Tasks 5–6 need the docker backend.
- Commit after every green cycle, conventional messages.

## File Structure

```
src/core/types.ts            # + PlayCardPayload, CallPartnerPayload
src/core/view.ts             # + jokerLeadCard; ScoreRow -> roundScore + cardPoints
src/components/PlayArea.tsx  # + joker-lead suit dialog; onPlayCard 3rd arg
src/components/FriendCallPanel.tsx  # + Play alone button (onNoFriend)
src/components/ScoreBoard.tsx       # Round score + Card points columns
src/components/GameTable.tsx        # prop plumbing (onPlayCard sig, onNoFriend)
src/components/GameScreen.tsx       # payload mapping
src/store/index.ts           # busy retry
e2e/bots/bot.ts              # joker-lead called_suit; typed call_partner
src/core/replay.test.ts      # + partner-reveal consistency assertion
fixtures/full-game.json      # re-captured
e2e/full-game.spec.ts        # loop handles the suit dialog
```

---

### Task 1: Payload types and view-model fields

**Files:**
- Modify: `src/core/types.ts` (append), `src/core/view.ts`
- Test: `src/core/view.test.ts` (append + amend one existing test)

**Interfaces:**
- Produces: `PlayCardPayload { card: Card; call_joker: boolean; called_suit?: Suit }`, `CallPartnerPayload = { card: Card } | { no_friend: true }` (exported from `types.ts`); `TableView.jokerLeadCard: Card | null`; `ScoreRow { playerId: string; name: string; roundScore: number; cardPoints: number }`. Tasks 2–4 consume these exact names.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/view.test.ts`:

```ts
describe('jokerLeadCard', () => {
  const joker = c('none', 'Joker')

  it('exposes the joker when leading with it playable', () => {
    const g = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [joker, c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(g, 'p0').jokerLeadCard).toEqual(joker)
  })

  it('is null when following, when not my turn, and when not holding the joker', () => {
    const following = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [joker] }), player(1), player(2), player(3), player(4)],
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    expect(tableView(following, 'p0').jokerLeadCard).toBeNull()

    const notMyTurn = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 2,
      players: [player(0, { hand: [joker] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(notMyTurn, 'p0').jokerLeadCard).toBeNull()

    const noJoker = baseGame({
      status: 'playing', trump: 'hearts', current_turn: 0,
      players: [player(0, { hand: [c('clubs', '5')] }), player(1), player(2), player(3), player(4)],
      tricks: [trick({ winner: 0 }), trick()],
    })
    expect(tableView(noJoker, 'p0').jokerLeadCard).toBeNull()
  })
})

describe('score rows', () => {
  it('separates round scores from card points', () => {
    const g = baseGame({
      status: 'finished',
      players: [
        player(0, { points: [c('hearts', 'A'), c('clubs', '10'), c('spades', 'K')] }),
        player(1, { points: [c('diamonds', 'J')] }),
        player(2), player(3), player(4),
      ],
      scores: { p0: 140, p1: 70 },
    })
    const rows = tableView(g, 'p0').scores
    expect(rows.find(r => r.playerId === 'p0')).toMatchObject({ roundScore: 140, cardPoints: 3 })
    expect(rows.find(r => r.playerId === 'p1')).toMatchObject({ roundScore: 70, cardPoints: 1 })
    expect(rows.find(r => r.playerId === 'p2')).toMatchObject({ roundScore: 0, cardPoints: 0 })
  })
})
```

Amend the existing test `carries bids, contract, trick, scores, and version through` — replace its two score assertions:

```ts
    expect(v.scores.find(s => s.playerId === 'p0')?.roundScore).toBe(12)
    expect(v.scores.find(s => s.playerId === 'p2')?.roundScore).toBe(0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/view.test.ts`
Expected: FAIL — `jokerLeadCard`/`roundScore` do not exist (type errors surface as test failures under Vite transform, or assertion failures on `undefined`).

- [ ] **Step 3: Implement**

Append to `src/core/types.ts`:

```ts
export interface PlayCardPayload {
  card: Card
  call_joker: boolean
  called_suit?: Suit // required when leading the Joker; omitted otherwise
}

export type CallPartnerPayload = { card: Card } | { no_friend: true }
```

In `src/core/view.ts`:

1. `ScoreRow` becomes:

```ts
export interface ScoreRow {
  playerId: string
  name: string
  roundScore: number
  cardPoints: number
}
```

2. `TableView` gains `jokerLeadCard: Card | null` (next to `jokerCallCard`).

3. In `tableView`, after the `jokerCallCard` computation add:

```ts
  const jokerCard: Card = { suit: 'none', rank: 'Joker' }
  const leading = (tricks[tricks.length - 1]?.cards.length ?? -1) === 0
  const jokerLeadCard =
    mySeat >= 0 && leading && playable.has(cardKey(jokerCard)) ? jokerCard : null
```

(`tricks` is already defined; move its declaration above this block if needed.)

4. Include `jokerLeadCard` in the returned object, and change the scores mapping to:

```ts
    scores: game.players.flatMap(p =>
      p
        ? [{
            playerId: p.id,
            name: p.name,
            roundScore: game.scores?.[p.id] ?? 0,
            cardPoints: p.points?.length ?? 0,
          }]
        : [],
    ),
```

5. `src/components/ScoreBoard.tsx` still reads `row.cardPoints` — it keeps compiling; its column update happens in Task 3.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core && npx tsc -b`
Expected: all core tests pass (replay suite included — it doesn't touch ScoreRow fields); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/core src/components/ScoreBoard.tsx
git commit -m "feat: payload types, joker-lead flag, and round-score view fields"
```

---

### Task 2: Joker-lead suit dialog in PlayArea

**Files:**
- Modify: `src/components/PlayArea.tsx`, `src/components/GameTable.tsx`, `src/components/GameScreen.tsx`
- Test: `src/components/PlayArea.test.tsx` (append)

**Interfaces:**
- Consumes: `TableView.jokerLeadCard` (Task 1), `PlayCardPayload` (Task 1).
- Produces: `onPlayCard(card: Card, callJoker: boolean, calledSuit?: Suit)` on both `PlayAreaProps` and `GameTableProps`. Non-joker plays call it with two args (keeps existing tests exact-match green). `GameScreen` sends `{ card, call_joker, called_suit? }` omitting `called_suit` unless provided.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/PlayArea.test.tsx`:

```tsx
describe('joker lead', () => {
  const joker = c('none', 'Joker')
  const jokerLeadGame = () =>
    playingGame([joker, c('diamonds', '2')])

  it('opens the suit dialog instead of playing immediately', async () => {
    const onPlayCard = vi.fn()
    render(<PlayArea view={tableView(jokerLeadGame(), 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-none-Joker'))
    expect(onPlayCard).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Lead the Joker' })).toBeInTheDocument()
  })

  it('plays the joker with the chosen suit', async () => {
    const onPlayCard = vi.fn()
    render(<PlayArea view={tableView(jokerLeadGame(), 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-none-Joker'))
    await userEvent.click(screen.getByRole('button', { name: '♥' }))
    expect(onPlayCard).toHaveBeenCalledWith(joker, false, 'hearts')
  })

  it('cancel closes the dialog without playing', async () => {
    const onPlayCard = vi.fn()
    render(<PlayArea view={tableView(jokerLeadGame(), 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-none-Joker'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onPlayCard).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Lead the Joker' })).not.toBeInTheDocument()
  })

  it('plays the joker immediately when following (no dialog)', async () => {
    const onPlayCard = vi.fn()
    const g = playingGame([joker, c('clubs', '4')], {
      tricks: [
        trick({ winner: 1 }),
        trick({ lead_suit: 'clubs', cards: [{ player_id: 'p1', seat: 1, card: c('clubs', '9') }] }),
      ],
    })
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-none-Joker'))
    expect(onPlayCard).toHaveBeenCalledWith(joker, false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/PlayArea.test.tsx`
Expected: the four new tests FAIL (joker plays immediately, no dialog); existing tests still pass.

- [ ] **Step 3: Implement**

In `src/components/PlayArea.tsx`:

```tsx
import { useState } from 'react'
import type { Card, Suit } from '../core/types'
import type { TableView } from '../core/view'
import { cardLabel, sameCard } from '../core/cards'
import { Hand } from './Hand'

export interface PlayAreaProps {
  view: TableView
  onPlayCard(card: Card, callJoker: boolean, calledSuit?: Suit): void
}

const LEAD_SUITS: { suit: Suit; label: string }[] = [
  { suit: 'clubs', label: '♣' },
  { suit: 'diamonds', label: '♦' },
  { suit: 'hearts', label: '♥' },
  { suit: 'spades', label: '♠' },
]

export function PlayArea({ view, onPlayCard }: PlayAreaProps) {
  const [pendingCaller, setPendingCaller] = useState<Card | null>(null)
  const [pendingJoker, setPendingJoker] = useState<Card | null>(null)
  const played = new Map(view.currentTrick.map(pc => [pc.seat, pc.card]))

  const handleCard = (card: Card) => {
    if (view.jokerLeadCard && sameCard(card, view.jokerLeadCard)) setPendingJoker(card)
    else if (view.jokerCallCard && sameCard(card, view.jokerCallCard)) setPendingCaller(card)
    else onPlayCard(card, false)
  }

  const resolveCall = (callJoker: boolean) => {
    if (pendingCaller) onPlayCard(pendingCaller, callJoker)
    setPendingCaller(null)
  }

  const resolveJokerLead = (suit: Suit) => {
    if (pendingJoker) onPlayCard(pendingJoker, false, suit)
    setPendingJoker(null)
  }

  return (
    <section className="play-area">
      <ul className="seats">
        {view.seats.map(s => {
          const trickCard = played.get(s.seat)
          return (
            <li key={s.seat} data-testid={`seat-${s.seat}`} className={s.isTurn ? 'turn' : ''}>
              <span>
                {s.name ?? 'empty'}
                {s.isMe ? ' (you)' : ''}
                {s.isDeclarer ? ' — declarer' : ''}
                {s.isPartner ? ' — partner' : ''}
              </span>
              <span data-testid={`trick-card-${s.seat}`}>
                {trickCard ? cardLabel(trickCard) : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <Hand cards={view.hand} mode="play" onCard={handleCard} />
      {pendingCaller && (
        <div role="dialog" aria-label="Call the Joker?">
          <p>Lead the Joker Caller — force the Joker out?</p>
          <button onClick={() => resolveCall(true)}>Call the Joker</button>
          <button onClick={() => resolveCall(false)}>Play without calling</button>
        </div>
      )}
      {pendingJoker && (
        <div role="dialog" aria-label="Lead the Joker">
          <p>Call a suit for the trick:</p>
          {LEAD_SUITS.map(({ suit, label }) => (
            <button key={suit} onClick={() => resolveJokerLead(suit)}>{label}</button>
          ))}
          <button onClick={() => setPendingJoker(null)}>Cancel</button>
        </div>
      )}
    </section>
  )
}
```

In `src/components/GameTable.tsx`, change the prop type only:

```ts
  onPlayCard(card: Card, callJoker: boolean, calledSuit?: Suit): void
```

(add `Suit` to the type import from `../core/types`).

In `src/components/GameScreen.tsx`, replace the play mapping:

```tsx
      onPlayCard={(card, callJoker, calledSuit) =>
        sendMove('play_card', {
          card,
          call_joker: callJoker,
          ...(calledSuit ? { called_suit: calledSuit } : {}),
        } satisfies PlayCardPayload)
      }
```

(add `import type { PlayCardPayload } from '../core/types'`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components && npx tsc -b`
Expected: all component tests pass (old PlayArea assertions still exact-match because non-joker plays use two args); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: joker-lead suit dialog and called_suit payload"
```

---

### Task 3: No-friend button and scoreboard columns

**Files:**
- Modify: `src/components/FriendCallPanel.tsx`, `src/components/ScoreBoard.tsx`, `src/components/GameTable.tsx`, `src/components/GameScreen.tsx`, `src/components/GameTable.test.tsx` (prop plumbing)
- Test: `src/components/FriendCallPanel.test.tsx` (append), `src/components/ScoreBoard.test.tsx` (create)

**Interfaces:**
- Consumes: `ScoreRow { roundScore, cardPoints }` (Task 1), `CallPartnerPayload` (Task 1).
- Produces: `FriendCallPanelProps.onNoFriend(): void`; `GameTableProps.onNoFriend(): void`; `GameScreen` sends `{ card }` / `{ no_friend: true }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/FriendCallPanel.test.tsx` (add `onNoFriend={vi.fn()}` to the two existing renders so they compile):

```tsx
  it('declares no friend', async () => {
    const onNoFriend = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={vi.fn()} onNoFriend={onNoFriend} />)
    await userEvent.click(screen.getByRole('button', { name: /play alone/i }))
    expect(onNoFriend).toHaveBeenCalled()
  })
```

Create `src/components/ScoreBoard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreBoard } from './ScoreBoard'
import { tableView } from '../core/view'
import { baseGame, bid, c, player } from '../core/testing/builders'

describe('ScoreBoard', () => {
  it('shows round scores and card points per player', () => {
    const g = baseGame({
      status: 'finished',
      declarer: 0,
      partner_seat: 1,
      contract: bid('p0', 5, 'spades'),
      players: [
        player(0, { points: [c('hearts', 'A'), c('clubs', '10')] }),
        player(1, { points: [c('diamonds', 'J')] }),
        player(2), player(3), player(4),
      ],
      scores: { p0: 50, p1: 25 },
    })
    render(<ScoreBoard view={tableView(g, 'p0')} />)
    const row0 = screen.getByTestId('score-row-p0')
    expect(row0).toHaveTextContent('50')
    expect(row0).toHaveTextContent('2')
    expect(row0).toHaveTextContent('declarer')
    const row1 = screen.getByTestId('score-row-p1')
    expect(row1).toHaveTextContent('25')
    expect(row1).toHaveTextContent('partner')
    expect(screen.getByText('Round score')).toBeInTheDocument()
    expect(screen.getByText('Card points')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/FriendCallPanel.test.tsx src/components/ScoreBoard.test.tsx`
Expected: FAIL — no `onNoFriend` prop / no "Play alone" button; no `score-row-*` testids or new columns.

- [ ] **Step 3: Implement**

`src/components/FriendCallPanel.tsx` — add to props and render (replacing the hint paragraph):

```tsx
export interface FriendCallPanelProps {
  view: TableView
  onCallPartner(card: Card): void
  onNoFriend(): void
}
```

```tsx
      <button onClick={() => onCallPartner({ suit, rank })}>Call</button>
      <button onClick={onNoFriend}>Play alone (no friend, 2× score)</button>
      <p>Calling a card from your own hand means you play alone (no friend, doubled score).</p>
```

`src/components/ScoreBoard.tsx` — replace the table:

```tsx
      <table>
        <thead>
          <tr><th>Player</th><th>Round score</th><th>Card points</th><th>Role</th></tr>
        </thead>
        <tbody>
          {view.scores.map(row => {
            const seat = view.seats.find(s => s.name === row.name)
            const role = seat?.isDeclarer ? 'declarer' : seat?.isPartner ? 'partner' : ''
            return (
              <tr key={row.playerId} data-testid={`score-row-${row.playerId}`}>
                <td>{row.name}</td>
                <td>{row.roundScore}</td>
                <td>{row.cardPoints}</td>
                <td>{role}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
```

`src/components/GameTable.tsx` — add `onNoFriend(): void` to `GameTableProps`, pass `onNoFriend={props.onNoFriend}` to `<FriendCallPanel>`.

`src/components/GameTable.test.tsx` — add `onNoFriend: vi.fn(),` to the `renderTable` default props object.

`src/components/GameScreen.tsx` — replace the call mapping and add the new prop:

```tsx
      onCallPartner={card => sendMove('call_partner', { card } satisfies CallPartnerPayload)}
      onNoFriend={() => sendMove('call_partner', { no_friend: true } satisfies CallPartnerPayload)}
```

(add `CallPartnerPayload` to the type import.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components && npx tsc -b`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: no-friend call and round-score scoreboard"
```

---

### Task 4: Busy retry in the store

**Files:**
- Modify: `src/store/index.ts`
- Test: `src/store/index.test.ts` (append)

**Interfaces:**
- Consumes: existing `Deps`/`SocketLike` test seams.
- Produces: behavior only — WS error `game busy` triggers one silent resend of the last move after 300 ms; a second consecutive busy (or any other error) surfaces via `lastError`.

- [ ] **Step 1: Write the failing tests**

Append to `src/store/index.test.ts`:

```ts
describe('busy retry', () => {
  it('silently resends the last move once after 300ms on game busy', async () => {
    vi.useFakeTimers()
    try {
      const { deps, sockets } = makeDeps()
      const store = createAppStore(deps)
      await store.getState().login('alice', 'pw')
      await store.getState().joinGame('gA')
      store.getState().sendMove('pass', null)
      sockets[0].cb.onError('game busy')
      expect(store.getState().lastError).toBeNull()
      expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(300)
      expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(2)
      expect(sockets[0].socket.sendMove).toHaveBeenLastCalledWith('pass', null)
      // Second busy on the retry surfaces.
      sockets[0].cb.onError('game busy')
      expect(store.getState().lastError).toBe('game busy')
    } finally {
      vi.useRealTimers()
    }
  })

  it('surfaces other errors immediately without retrying', async () => {
    const { deps, sockets } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().joinGame('gA')
    store.getState().sendMove('pass', null)
    sockets[0].cb.onError('not your turn')
    expect(store.getState().lastError).toBe('not your turn')
    expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(1)
  })

  it('a fresh move re-arms the single retry', async () => {
    vi.useFakeTimers()
    try {
      const { deps, sockets } = makeDeps()
      const store = createAppStore(deps)
      await store.getState().login('alice', 'pw')
      await store.getState().joinGame('gA')
      store.getState().sendMove('pass', null)
      sockets[0].cb.onError('game busy')
      vi.advanceTimersByTime(300)
      store.getState().sendMove('bid', { points: 3, suit: 'clubs', is_no_trump: false })
      sockets[0].cb.onError('game busy')
      expect(store.getState().lastError).toBeNull()
      vi.advanceTimersByTime(300)
      expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store`
Expected: the three new tests FAIL (`lastError` becomes 'game busy' immediately, no resend); existing tests pass.

- [ ] **Step 3: Implement**

In `src/store/index.ts` inside `createAppStore`, alongside the `socket` variable:

```ts
  let socket: SocketLike | null = null
  let lastMove: { t: MoveType; payload: unknown } | null = null
  let busyRetried = false
```

In `openSocket`, replace the `onError` callback:

```ts
        onError: msg => {
          if (msg === 'game busy' && lastMove && !busyRetried) {
            busyRetried = true
            const move = lastMove
            setTimeout(() => socket?.sendMove(move.t, move.payload), 300)
            return
          }
          set({ lastError: msg })
        },
```

Replace the `sendMove` action:

```ts
      sendMove(t, payload) {
        lastMove = { t, payload }
        busyRetried = false
        socket?.sendMove(t, payload)
      },
```

Reset both in `leaveTable` and `logout` (`lastMove = null; busyRetried = false` next to `socket = null`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store && npx vitest run && npx tsc -b`
Expected: full unit suite green, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: single silent retry for game-busy move rejections"
```

---

### Task 5: Bots, fixture re-capture, replay assertion

**Files:**
- Modify: `e2e/bots/bot.ts`, `src/core/replay.test.ts` (append), `fixtures/full-game.json` (regenerated)

**Interfaces:**
- Consumes: running contract-branch backend at `http://localhost:8080`.
- Produces: fresh committed fixture capture proving partner reveal; bots that never trip `called_suit` validation.

**Prerequisite:** backend up — `curl -sf http://localhost:8080/games` answers (if not: `cd ../go-mighty && docker compose up -d --build`).

- [ ] **Step 1: Update the bots**

In `e2e/bots/bot.ts`:

Replace the `call_partner` branch payload:

```ts
      send('call_partner', { card: { suit: 'hearts', rank: 'A' } }, g.version)
```

Replace the `play_card` send in the playing branch:

```ts
      const plays = legalPlays(g, me.seat)
      const card = plays[Math.min(retryOffset, Math.max(plays.length - 1, 0))]
      if (card) {
        const tricks = g.tricks ?? []
        const leading = (tricks[tricks.length - 1]?.cards.length ?? -1) === 0
        const payload: Record<string, unknown> = { card, call_joker: false }
        if (leading && card.rank === 'Joker') payload.called_suit = 'hearts'
        send('play_card', payload, g.version)
      }
```

- [ ] **Step 2: Re-capture fixtures**

Run: `npm run capture`
Expected: `captured N broadcasts to fixtures/full-game.json` with N > 20. If the run hangs >3 minutes, a bot is stuck — inspect the last states in the partial fixture and report rather than force-committing.

- [ ] **Step 3: Write the partner-reveal replay test (verify against fresh capture)**

Append to `src/core/replay.test.ts`:

```ts
  // The capture may legitimately contain zero reveals (called card left in
  // the kitty); the invariant is asserted for every state that has one.
  it('reveals the partner as the seat that played the called card', () => {
    for (const g of states) {
      if (g.partner_seat >= 0 && g.partner_card) {
        const playedBy = (g.tricks ?? [])
          .flatMap(t => t.cards)
          .find(
            pc => pc.card.suit === g.partner_card!.suit && pc.card.rank === g.partner_card!.rank,
          )?.seat
        expect(playedBy).toBe(g.partner_seat)
      }
    }
  })
```

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run`
Expected: all green, including the replay suite over the fresh fixture. If `reaches every phase of a hand` fails, the capture was incomplete — re-run Step 2.

- [ ] **Step 5: Commit**

```bash
git add e2e/bots/bot.ts src/core/replay.test.ts fixtures/full-game.json
git commit -m "feat: contract-aware bots and re-captured fixtures with reveal assertion"
```

---

### Task 6: E2E loop handles the suit dialog; full verification

**Files:**
- Modify: `e2e/full-game.spec.ts`

**Interfaces:**
- Consumes: everything above; dev server (Playwright starts it) + backend.

- [ ] **Step 1: Teach the browser loop the new dialog**

In `e2e/full-game.spec.ts`, inside the while loop, add before the joker-caller (`Play without calling`) branch:

```ts
    const leadSuit = page
      .getByRole('dialog', { name: 'Lead the Joker' })
      .getByRole('button', { name: '♥' })
    if (await leadSuit.isVisible().catch(() => false)) {
      console.log('[loop] leading the joker in hearts')
      await leadSuit.click({ timeout: 2000 }).catch(() => undefined)
      continue
    }
```

- [ ] **Step 2: Run the E2E suite**

Run: `npm run e2e`
Expected: `2 passed` (full game + electron smoke). The hand completes in seconds; if the loop stalls, check the `[state]` diagnostics lines for a phase/alert clue.

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npx tsc -b && npm run e2e`
Expected: everything green.

- [ ] **Step 4: Commit**

```bash
git add e2e/full-game.spec.ts
git commit -m "test: e2e loop handles joker-lead suit dialog"
```

---

## Spec coverage map

- §2 payload types → Task 1; §3 view-model (`jokerLeadCard`, `roundScore`/`cardPoints`) → Task 1.
- §4 PlayArea dialog + GameScreen play mapping → Task 2; FriendCallPanel/ScoreBoard/call mapping → Task 3.
- §5 busy retry → Task 4.
- §6 bots + fixtures + replay assertion → Task 5; E2E gate → Task 6.
- §7 out-of-scope items: none planned (correct).
