# Mighty Web Frontend — Backend Contract Adaptation

**Date**: 2026-07-17
**Status**: Approved
**Scope**: Adapt the web client to the go-mighty *Correctness & Concurrency* changes (backend branch `feature/correctness-concurrency`, spec `go-mighty/docs/superpowers/specs/2026-07-17-correctness-concurrency-design.md`). Full contract adoption.

## 1. Backend changes that affect this client

| Backend change | Client impact |
|---|---|
| Joker leads require `called_suit` (one of the four real suits); forbidden on any other play | **Breaking**: `legalPlays` offers the Joker when leading; clicking it today sends no `called_suit` and the server rejects the move |
| `call_partner` payload is `{"card": {...}}` XOR `{"no_friend": true}` (legacy bare card still accepted) | Non-breaking, but "play alone" is impossible from the UI; client should send the typed shape |
| `scores` = final round scores (declarer full, revealed partner half, others 0); card points live in `player.points` | `ScoreBoard` mislabels round scores as "Card points" |
| Partner revealed (`partner_seat`) when called card is played; all-pass redeals into fresh `bidding` | Flows through existing rendering automatically; must be proven by re-captured fixtures |
| HTTP 409 / WS ERROR `game busy` on lock contention (transient, retryable) | New error string surfaces as a toast today; deserves one automatic retry |
| `stale version` semantics unchanged | No change |

## 2. Contract types (`src/core/types.ts`)

No `Game` shape changes. New exported payload types; the client stops sending the legacy bare-card call:

```ts
export interface PlayCardPayload {
  card: Card
  call_joker: boolean
  called_suit?: Suit // required when leading the Joker; omitted otherwise
}

export type CallPartnerPayload = { card: Card } | { no_friend: true }
```

## 3. Core view-model (`src/core/view.ts`)

- `TableView.jokerLeadCard: Card | null` — the Joker, when it is my turn, I am leading the current trick, and the Joker is in my playable set. Mirrors the existing `jokerCallCard` mechanism.
- `ScoreRow` becomes `{ playerId, name, roundScore, cardPoints }`:
  - `roundScore` = `game.scores[playerId] ?? 0` (declarer full, partner half, others 0).
  - `cardPoints` = number of point cards (A/K/Q/J/10) in `player.points`.
- No client-side `called_suit` legality rules beyond surfacing the picker — the server stays authoritative.

## 4. Components

- **PlayArea**: clicking the Joker while leading opens a suit dialog (`role="dialog"`, label "Lead the Joker") with four suit buttons (♣ ♦ ♥ ♠) and Cancel; choosing a suit calls `onPlayCard(card, false, suit)`. Coexists with the joker-caller dialog (a card can never be both the Joker and the Joker-Caller).
- **FriendCallPanel**: adds a "Play alone (no friend, 2× score)" button calling a new `onNoFriend()` callback.
- **ScoreBoard**: columns Player / Round score / Card points / Role.
- **GameScreen** payload mapping: `call_partner` → `{ card }` or `{ no_friend: true }`; `play_card` → `{ card, call_joker, called_suit? }` (field omitted unless picking a Joker-lead suit).

## 5. Busy retry (`src/store`)

On a WS error exactly equal to `"game busy"`, the store resends the most recent move once after 300 ms instead of surfacing it; if the retry also errors (any message), the error surfaces as usual. All other errors surface immediately. The store remembers only the single last `sendMove` call.

## 6. Bots, fixtures, tests

- **Bot harness** (`e2e/bots/bot.ts`): when leading with the Joker, include `called_suit: "hearts"`; `call_partner` sends `{ card: { suit: "hearts", rank: "A" } }` (typed shape).
- **Fixtures**: re-run `npm run capture` against the updated backend (docker stack on the contract branch); commit the fresh `fixtures/full-game.json`.
- **Replay suite**: add an assertion that whenever `partner_seat >= 0` in a captured state, some earlier-or-equal state shows the called card played by that seat.
- **Component/unit tests**: TDD for the suit dialog, no-friend button, ScoreBoard columns, view-model fields, busy retry.
- **E2E**: existing Playwright full-game spec re-run as the final gate (bots updated as above).

## 7. Out of scope

Redeal UI notification (state re-render suffices), hand redaction, structured error codes, reconnection UX changes — all wait for the backend's Contract & Security spec.
