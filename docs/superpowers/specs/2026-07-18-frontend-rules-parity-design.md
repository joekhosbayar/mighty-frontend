# Frontend Rules Parity with Backend Engine

**Date:** 2026-07-18
**Status:** Approved
**Scope:** `mighty-frontend` only. No backend or API changes.

## Problem

Two gameplay bugs were reported against spades contracts:

1. The mighty does not appear to convert from ♠A to ♦A.
2. A lead-suit card can appear to beat a trump card.

Investigation showed the backend engine (`go-mighty/internal/game/rules.go`, as of
commit `0962377`, PR #41) is correct on both counts: mighty converts to ♦A when
spades is trump, and trump power (100 + rank) always beats lead-suit power
(10 + rank). The running container's binary contains this code and all 51 backend
unit tests pass.

Both symptoms are produced by the frontend, which still implements pre-#41 rules:

- `src/core/cards.ts:11` — `mightyCard('spades')` returns ♣A; the backend uses ♦A.
- `src/components/PhysicalCard.tsx:17` — the mighty highlight is hardcoded to ♠A
  regardless of trump, so it never converts visually.
- With a spades contract, the UI treats ♦A as an ordinary diamond. When ♦A follows
  a diamond lead and wins the trick over a trump (correct backend behavior — it is
  the mighty), the UI's frame of reference makes it look like "lead suit beat trump."

## Full delta list (frontend vs backend)

| # | Rule | Backend (authoritative) | Frontend today |
|---|------|------------------------|----------------|
| 1 | Mighty when spades is trump | ♦A | ♣A |
| 2 | Joker on first trick | Cannot lead or play at all | Always playable, even leadable |
| 3 | Mighty on first trick | Cannot lead; may follow only if it is the player's only card of the led suit | Allowed as lead; allowed whenever void in lead suit |
| 4 | Late-game special-card forcing | 3 cards left holding both mighty and joker → must play one; 2 cards left holding either → must play it | Missing |
| 5 | First-trick trump lead | Blocked unless hand has no non-trump cards excluding mighty/joker | Joker (suit `none`) wrongly counts as non-trump |
| 6 | Bid raising | Strictly higher points only | Same points allowed with higher suit or no-trump |

Decision (confirmed with owner): the backend is the source of truth for all six,
including #6 — strictly-higher-points bidding stands (see go-mighty spec
`2026-07-18-strict-bidding-design.md`); the frontend's suit tie-break is removed.

## Design

### `src/core/cards.ts`

`mightyCard('spades')` returns `{ suit: 'diamonds', rank: 'A' }`. Everything that
derives from `isMighty` inherits the fix. `jokerCallerCard` already matches the
backend (♣3; ♠3 when clubs is trump) and is unchanged.

### `src/core/rules.ts` — `legalPlays`

Restructure as one predicate per card, applying the backend `validatePlayCard`
checks in the same order:

1. **Late-game forcing (new):** let `cardsLeft = hand.length`. If
   `cardsLeft === 3` and the hand holds both mighty and joker, or
   `cardsLeft === 2` and the hand holds either, only mighty/joker are legal.
2. **Joker called (unchanged):** if the current trick has `joker_called` and the
   hand holds the joker, only joker or mighty are legal.
3. **Leading, first trick:** joker and mighty are excluded from legal leads.
   Trump leads are excluded when the hand contains at least one non-trump card
   that is neither mighty nor joker (`hasNonTrumpMightyJoker` mirror).
4. **Following, first trick (new):** joker is illegal; mighty is legal only when
   the led suit equals the mighty's own suit and it is the player's only card of
   that suit.
5. **Following, general (unchanged):** must follow the led suit when possible;
   mighty and joker are exempt.

### `src/core/rules.ts` — `isLegalBid`

Remove the equal-points branch entirely: a raise is legal only with strictly
higher points. The 3–10 range check and the suit/no-trump shape checks stay.
`SUIT_RANK` remains in `cards.ts` for hand sorting only.

### `src/components/PhysicalCard.tsx`

Replace the hardcoded ♠A check with `isMighty(card, trump)`. `trump` is threaded
in as a prop from the rendering components (`Hand`, `PlayArea`), which already
receive the `TableView` containing `trump`.

### Error handling

Unchanged by design. The server remains authoritative: any residual wrong
prediction results in a server rejection surfaced through the existing WebSocket
error path.

## Testing

- Vitest cases mirroring the backend's #41 scenarios:
  - Mighty identity per trump suit, including spades → ♦A and no-trump → ♠A.
  - First-trick restrictions: no joker lead/follow, no mighty lead, mighty follow
    only as the sole card of its led suit, trump-lead exception ignoring
    mighty/joker.
  - Late-game forcing at 3 cards (both specials) and 2 cards (either special).
  - Bidding: same-points higher-suit and same-points no-trump raises are illegal.
- Update existing tests that assert the old behavior (♣A mighty, mighty leadable
  on trick 1, suit tie-break bids).
- Verification: `npm test` in `mighty-frontend`; `go test ./...` in `go-mighty`
  stays green (untouched); manual spades-contract game against the running stack
  to confirm both reported symptoms are gone.

## Out of scope

- Backend/API changes of any kind.
- Shared cross-language rule fixtures (considered as Option B, deferred).
- Server-provided `legal_moves` (considered as Option C, rejected).
