# Frontend Rules Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the `mighty-frontend` rules engine and card rendering into exact parity with the authoritative Go backend (`go-mighty/internal/game/rules.go`, PR #41), fixing the reported spades-contract bugs.

**Architecture:** The frontend keeps its own rules engine for optimistic UX; the server stays authoritative. This plan edits three pure-logic functions (`mightyCard`, `legalPlays`, `isLegalBid`) plus the `PhysicalCard`/`Hand` render path so the mighty highlight tracks the trump suit. Each change is TDD: mirror the backend's behavior in a Vitest case, watch it fail, then implement.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, oxlint. Run from `/Users/joekhosbayar/mighty/mighty-frontend`.

## Global Constraints

- Backend is the single source of truth for every rule. Behavior must match `go-mighty/internal/game/rules.go` at commit `0962377`.
- No backend or API changes. Frontend only.
- Mighty = ♠A normally, ♦A when spades is trump. No-trump keeps ♠A.
- Joker caller = ♣3 normally, ♠3 when clubs is trump (already correct — do not touch).
- Bidding raises require strictly higher points (no equal-points suit tie-break).
- Test command: `npm test` (runs `vitest run`). Single file: `npx vitest run <path>`. Lint: `npm run lint`.
- All commands run from `/Users/joekhosbayar/mighty/mighty-frontend`.

---

### Task 1: Mighty converts to ♦A under a spades contract

**Files:**
- Modify: `src/core/cards.ts:10-11` (`mightyCard`)
- Test: `src/core/cards.test.ts:15-19` (existing spades-trump case)

**Interfaces:**
- Consumes: nothing new.
- Produces: `mightyCard(trump: Suit): Card` — returns `{ suit: 'diamonds', rank: 'A' }` when `trump === 'spades'`, otherwise `{ suit: 'spades', rank: 'A' }`. `isMighty(c: Card, trump: Suit): boolean` inherits this unchanged.

- [ ] **Step 1: Update the failing test**

Replace the existing block at `src/core/cards.test.ts:15-19`:

```ts
  it('mighty shifts to the diamond ace when spades are trump', () => {
    expect(mightyCard('spades')).toEqual(c('diamonds', 'A'))
    expect(isMighty(c('spades', 'A'), 'spades')).toBe(false)
    expect(isMighty(c('diamonds', 'A'), 'spades')).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/cards.test.ts`
Expected: FAIL — `mightyCard('spades')` returns `{ suit: 'clubs', rank: 'A' }`, not diamonds.

- [ ] **Step 3: Implement the fix**

In `src/core/cards.ts`, change `mightyCard` (lines 10-11) to:

```ts
export const mightyCard = (trump: Suit): Card =>
  trump === 'spades' ? { suit: 'diamonds', rank: 'A' } : { suit: 'spades', rank: 'A' }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/cards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/cards.ts src/core/cards.test.ts
git commit -m "fix(cards): mighty is the diamond ace when spades is trump"
```

---

### Task 2: `legalPlays` mirrors the backend `validatePlayCard`

**Files:**
- Modify: `src/core/rules.ts:26-55` (`legalPlays`)
- Test: `src/core/rules-play.test.ts` (rewrite one case, add five)

**Interfaces:**
- Consumes: `isMighty(card, trump)` from Task 1; `isJoker` from `./cards`; builders `baseGame`, `c`, `player`, `trick` from `./testing/builders`.
- Produces: `legalPlays(game: Game, seat: number): Card[]` — the subset of the seat's hand that the backend would accept, in hand order.

Backend rules being mirrored (in this precedence):
1. Late-game forcing: 3 cards left holding both mighty and joker → only those two are legal; 2 cards left holding either → only mighty/joker legal.
2. Joker called and you hold the joker → only joker or mighty legal.
3. Leading trick 1: cannot lead joker or mighty; cannot lead trump if the hand holds any plain (non-trump, non-mighty, non-joker) card.
4. Leading a later trick: anything.
5. Following trick 1: joker illegal; mighty legal only if the led suit is the mighty's own suit and it is your only card of that suit.
6. Following generally: must follow the led suit when able; mighty and joker are exempt.

- [ ] **Step 1: Rewrite the one existing test that assumes the old lead rule**

In `src/core/rules-play.test.ts`, replace the case currently named `'when leading trick 1, forbids leading trump unless mighty or all-trump'` (hand `[c('hearts', 'K'), c('clubs', '5'), c('spades', 'A')]`) with:

```ts
  it('when leading trick 1, forbids leading trump, mighty, and joker', () => {
    const hand = [c('hearts', 'K'), c('clubs', '5'), c('spades', 'A')] // hearts trump, ♠A mighty
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5')])
  })
```

- [ ] **Step 2: Add the new backend-parity tests**

Append inside the `describe('legalPlays', ...)` block in `src/core/rules-play.test.ts`:

```ts
  it('cannot lead the joker on trick 1', () => {
    // 3-card hand so the joker does not trip size-based late-game forcing.
    const hand = [c('clubs', '5'), c('diamonds', '7'), c('none', 'Joker')]
    const g = playingGame(hand, { tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('clubs', '5'), c('diamonds', '7')])
  })

  it('uses the diamond ace as mighty when spades is trump', () => {
    // spades trump → ♦A is the mighty and cannot be led on trick 1, even though
    // it is a diamond. If it were an ordinary diamond it would be a legal lead.
    const hand = [c('hearts', '5'), c('diamonds', 'A'), c('clubs', '7')]
    const g = playingGame(hand, { trump: 'spades', tricks: [trick()] })
    expect(legalPlays(g, 0)).toEqual([c('hearts', '5'), c('clubs', '7')])
  })

  it('on trick 1, mighty may follow only as your sole card of the led suit', () => {
    // hearts trump, ♠A mighty. Lead spades, ♠A is the only spade → legal follow.
    // 3 cards so the mighty does not trip size-based late-game forcing.
    const soleSpade = playingGame([c('spades', 'A'), c('clubs', '5'), c('hearts', '7')], {
      tricks: [trick({ lead_suit: 'spades', cards: [{ player_id: 'p4', seat: 4, card: c('spades', '9') }] })],
    })
    expect(legalPlays(soleSpade, 0)).toEqual([c('spades', 'A')])

    // Holding another spade, mighty cannot escape following with the plain spade.
    const twoSpades = playingGame([c('spades', 'A'), c('spades', '2'), c('clubs', '5')], {
      tricks: [trick({ lead_suit: 'spades', cards: [{ player_id: 'p4', seat: 4, card: c('spades', '9') }] })],
    })
    expect(legalPlays(twoSpades, 0)).toEqual([c('spades', '2')])
  })

  it('with 3 cards left holding both mighty and joker, forces one of them', () => {
    const hand = [c('clubs', '5'), c('spades', 'A'), c('none', 'Joker')] // hearts trump
    const g = playingGame(hand, {
      tricks: [...Array.from({ length: 7 }, () => trick({ winner: 0 })), trick({ winner: 0 })],
    })
    expect(legalPlays(g, 0)).toEqual([c('spades', 'A'), c('none', 'Joker')])
  })

  it('with 2 cards left holding either mighty or joker, forces it', () => {
    const hand = [c('clubs', '5'), c('spades', 'A')] // hearts trump
    const g = playingGame(hand, {
      tricks: [...Array.from({ length: 8 }, () => trick({ winner: 0 })), trick({ winner: 0 })],
    })
    expect(legalPlays(g, 0)).toEqual([c('spades', 'A')])
  })
```

- [ ] **Step 2b: Correct pre-existing tests that the new behavior invalidates**

Three existing tests assumed pre-rewrite behavior and must be updated:

1. `src/core/rules-play.test.ts` — `'on trick 1, mighty cannot escape following suit when able to follow'`: the old 2-card hand `[c('clubs', '5'), c('spades', 'A')]` now trips size-based late-game forcing (2 cards holding the mighty). Give it a third card, `c('diamonds', '7')`, so only the first-trick follow rule governs; the expectation stays `[c('clubs', '5')]`.
2. `src/core/rules-play.test.ts` — `'when the joker is called and you hold it, only joker or mighty are playable'`: enlarge the hand to 4 cards (add `c('diamonds', '8')`) so the joker-called rule, not late-game forcing, governs; expectation stays `[c('none', 'Joker'), c('spades', 'A')]`.
3. `src/core/view.test.ts` — `'sorts my hand and flags playable cards during playing'`: the mighty (`♠A`, hearts trump) is no longer a legal trick-1 lead. Change the spades assertion to `playable: false` and add `expect(v.hand.find(h => h.card.suit === 'clubs')?.playable).toBe(true)` (the plain non-trump ♣5 is the only legal lead).

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/core/rules-play.test.ts`
Expected: FAIL — old `legalPlays` still allows leading mighty/joker on trick 1 and has no late-game forcing.

- [ ] **Step 4: Rewrite `legalPlays`**

Replace `legalPlays` in `src/core/rules.ts` (lines 26-55) with:

```ts
export function legalPlays(game: Game, seat: number): Card[] {
  const p = game.players[seat]
  if (!p?.hand || game.status !== 'playing' || game.current_turn !== seat) return []
  const tricks = game.tricks ?? []
  const t = tricks[tricks.length - 1]
  if (!t) return []
  const hand = p.hand
  const trump = game.trump
  const isFirstTrick = tricks.length === 1
  const leading = t.cards.length === 0

  const mighty = (card: Card): boolean => isMighty(card, trump)
  const special = (card: Card): boolean => mighty(card) || isJoker(card)

  // Late-game forcing: the mighty and joker cannot be hoarded for the final tricks.
  const hasMighty = hand.some(mighty)
  const hasJoker = hand.some(isJoker)
  if (hand.length === 3 && hasMighty && hasJoker) return hand.filter(special)
  if (hand.length === 2 && (hasMighty || hasJoker)) return hand.filter(special)

  // Joker called: its holder must surrender the joker (the mighty is the only out).
  if (t.joker_called && hasJoker) return hand.filter(special)

  if (leading) {
    if (!isFirstTrick) return [...hand]
    const hasPlainNonTrump = hand.some(card => card.suit !== trump && !special(card))
    return hand.filter(card => {
      if (special(card)) return false
      if (card.suit === trump && hasPlainNonTrump) return false
      return true
    })
  }

  const lead = t.lead_suit
  const canFollow = hand.some(card => card.suit === lead)
  const leadCount = hand.filter(card => card.suit === lead).length
  return hand.filter(card => {
    if (isFirstTrick && isJoker(card)) return false
    if (isFirstTrick && mighty(card)) return card.suit === lead && leadCount === 1
    if (card.suit === lead) return true
    if (special(card)) return true
    return !canFollow
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/core/rules-play.test.ts`
Expected: PASS (all `legalPlays`, `canCallJoker`, `isValidDiscard` cases).

- [ ] **Step 6: Commit**

```bash
git add src/core/rules.ts src/core/rules-play.test.ts
git commit -m "fix(rules): mirror backend play validation (first-trick, late-game forcing)"
```

---

### Task 3: `isLegalBid` requires strictly higher points

**Files:**
- Modify: `src/core/rules.ts:10-24` (`isLegalBid`)
- Test: `src/core/rules.test.ts:24-38` (replace two equal-points cases)

**Interfaces:**
- Consumes: `SUIT_RANK` from `./cards` (still used for the suit-shape check).
- Produces: `isLegalBid(bid: BidInput, currentBid: Bid | null): boolean` — a raise is legal only when `bid.points > currentBid.points`; the 3–10 range and no-trump/suit shape checks are unchanged.

- [ ] **Step 1: Replace the equal-points tests**

In `src/core/rules.test.ts`, delete the two cases `'at equal points, requires a strictly higher suit'` and `'at equal points, no-trump beats any suit but nothing beats no-trump'` (lines 24-38) and replace with:

```ts
  it('at equal points, any raise is illegal regardless of suit', () => {
    expect(isLegalBid({ points: 5, suit: 'diamonds', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'spades', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 5, suit: 'none', is_no_trump: true }, bid(5, 'spades'))).toBe(false)
  })

  it('a raise must strictly exceed the current bid points', () => {
    expect(isLegalBid({ points: 6, suit: 'clubs', is_no_trump: false }, bid(5, 'spades'))).toBe(true)
    expect(isLegalBid({ points: 5, suit: 'clubs', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
    expect(isLegalBid({ points: 4, suit: 'clubs', is_no_trump: false }, bid(5, 'clubs'))).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/rules.test.ts`
Expected: FAIL — current code returns `true` for `points: 5, diamonds` over `bid(5, 'clubs')`.

- [ ] **Step 3: Simplify `isLegalBid`**

Replace `isLegalBid` in `src/core/rules.ts` (lines 10-24) with:

```ts
export function isLegalBid(bid: BidInput, currentBid: Bid | null): boolean {
  if (bid.points < 3 || bid.points > 10) return false
  if (bid.is_no_trump) {
    if (bid.suit !== 'none') return false
  } else if (!(bid.suit in SUIT_RANK)) {
    return false
  }
  if (!currentBid) return true
  if (bid.points <= currentBid.points) return false
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/rules.ts src/core/rules.test.ts
git commit -m "fix(rules): bidding raises require strictly higher points"
```

---

### Task 4: Mighty highlight tracks the trump suit

**Files:**
- Modify: `src/components/PhysicalCard.tsx` (add `trump` prop, use `isMighty`)
- Modify: `src/components/Hand.tsx` (add `trump` prop, forward it)
- Modify: `src/components/PlayArea.tsx:68,75` (pass `view.trump`)
- Modify: `src/components/GameTable.tsx:92` (pass `view.trump`)
- Modify: `src/components/ExchangePanel.tsx:31` (pass `view.trump`)
- Modify: `src/components/Hand.test.tsx:15,23` (pass `trump` in renders)
- Test: `src/components/PhysicalCard.test.tsx` (new)

**Interfaces:**
- Consumes: `isMighty(card, trump)` from `../core/cards`; `Suit` from `../core/types`.
- Produces: `PhysicalCard({ card, trump }: { card: Card; trump: Suit })` and `Hand({ cards, mode, trump, selected?, onCard })` — `trump` is required on both.

- [ ] **Step 1: Write the failing test for the trump-aware highlight**

Create `src/components/PhysicalCard.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhysicalCard } from './PhysicalCard'

const hasAccentBorder = (el: HTMLElement | null) =>
  !!el && el.style.border === '2px solid var(--color-accent)'

describe('PhysicalCard mighty highlight', () => {
  it('highlights the spade ace when spades is not trump', () => {
    const { container } = render(<PhysicalCard card={{ suit: 'spades', rank: 'A' }} trump="hearts" />)
    expect(hasAccentBorder(container.querySelector('.card-physical'))).toBe(true)
  })

  it('highlights the diamond ace and not the spade ace when spades is trump', () => {
    const spade = render(<PhysicalCard card={{ suit: 'spades', rank: 'A' }} trump="spades" />)
    expect(hasAccentBorder(spade.container.querySelector('.card-physical'))).toBe(false)

    const diamond = render(<PhysicalCard card={{ suit: 'diamonds', rank: 'A' }} trump="spades" />)
    expect(hasAccentBorder(diamond.container.querySelector('.card-physical'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PhysicalCard.test.tsx`
Expected: FAIL — `PhysicalCard` does not accept a `trump` prop and hardcodes ♠A.

- [ ] **Step 3: Add `trump` to `PhysicalCard`**

In `src/components/PhysicalCard.tsx`, replace the imports, props interface, and the `isMighty` line:

```tsx
import type { Card, Suit } from '../core/types'
import { isMighty } from '../core/cards'

export interface PhysicalCardProps {
  card: Card
  trump: Suit
}
```

```tsx
export function PhysicalCard({ card, trump }: PhysicalCardProps) {
  const isJoker = card.rank === 'Joker'
  const isMightyCard = isMighty(card, trump)
```

Then update the `<div>`'s style to use `isMightyCard`:

```tsx
    <div className={`card-physical ${suitClass}`} style={isMightyCard || isJoker ? { border: '2px solid var(--color-accent)' } : undefined}>
```

- [ ] **Step 4: Add `trump` to `Hand` and forward it**

In `src/components/Hand.tsx`, add `Suit` to the type import, extend props, and pass `trump` to `PhysicalCard`:

```tsx
import type { Card, Suit } from '../core/types'
```

```tsx
export interface HandProps {
  cards: HandCard[]
  mode: 'play' | 'select'
  trump: Suit
  selected?: Card[]
  onCard(card: Card): void
}

export function Hand({ cards, mode, trump, selected = [], onCard }: HandProps) {
```

```tsx
            <PhysicalCard card={card} trump={trump} />
```

- [ ] **Step 5: Pass `view.trump` from every consumer**

`src/components/PlayArea.tsx` line 68 (trick card) and line 75 (hand):

```tsx
                <PhysicalCard card={trickCard} trump={view.trump} />
```

```tsx
      <Hand cards={view.hand} mode="play" trump={view.trump} onCard={handleCard} />
```

`src/components/GameTable.tsx` line 92:

```tsx
          <Hand cards={view.hand} mode="play" trump={view.trump} onCard={() => undefined} />
```

`src/components/ExchangePanel.tsx` line 31:

```tsx
      <Hand cards={view.hand} mode="select" trump={view.trump} selected={selected} onCard={toggle} />
```

- [ ] **Step 6: Update the direct `Hand` renders in its test**

`src/components/Hand.test.tsx` lines 15 and 23 — add `trump="hearts"`:

```tsx
    render(<Hand cards={cards} mode="play" trump="hearts" onCard={onCard} />)
```

```tsx
    render(<Hand cards={cards} mode="select" trump="hearts" selected={[c('clubs', '5')]} onCard={onCard} />)
```

- [ ] **Step 7: Run the component tests to verify they pass**

Run: `npx vitest run src/components/PhysicalCard.test.tsx src/components/Hand.test.tsx src/components/PlayArea.test.tsx src/components/GameTable.test.tsx src/components/ExchangePanel.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/PhysicalCard.tsx src/components/PhysicalCard.test.tsx src/components/Hand.tsx src/components/Hand.test.tsx src/components/PlayArea.tsx src/components/GameTable.tsx src/components/ExchangePanel.tsx
git commit -m "fix(ui): highlight the mighty according to the trump suit"
```

---

### Task 5: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the entire frontend suite**

Run: `npm test`
Expected: PASS, no failures.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (no new warnings from the touched files).

- [ ] **Step 3: Confirm the backend is untouched and still green**

Run: `cd ../go-mighty && go test ./... && cd ../mighty-frontend`
Expected: PASS (this plan changed no Go files).

- [ ] **Step 4: Manual smoke test**

Against the running stack, play a spades-contract hand and confirm: (a) ♦A is shown highlighted as the mighty and ♠A is not; (b) a trump card beats a higher lead-suit card in the trick display; (c) the ♦A mighty wins its trick. No commit.

---

## Self-Review

**Spec coverage:**
- Delta #1 (mighty ♦A) → Task 1 (engine) + Task 4 (highlight). ✓
- Delta #2 (joker first trick) → Task 2, leading filter excludes joker + following filter rejects joker on trick 1. ✓
- Delta #3 (mighty first trick) → Task 2, leading excludes mighty; following allows only as sole led-suit card. ✓
- Delta #4 (late-game forcing) → Task 2, `hand.length === 3/2` branches. ✓
- Delta #5 (first-trick trump lead ignoring joker) → Task 2, `hasPlainNonTrump` excludes specials. ✓
- Delta #6 (strictly higher points) → Task 3. ✓
- Testing section (mirrored #41 scenarios, updated old tests, npm/go verification) → Tasks 2, 3, 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `mightyCard`/`isMighty` signatures unchanged; `legalPlays(game, seat)` and `isLegalBid(bid, currentBid)` signatures unchanged; `PhysicalCard`/`Hand` gain a required `trump: Suit` prop, threaded from `view.trump` at all five call sites and both direct test renders. ✓
