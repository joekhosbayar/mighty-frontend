# Mighty Web Frontend — Design Spec

**Date**: 2026-07-17
**Status**: Approved
**Scope**: Playable end-to-end MVP web client for the go-mighty backend. Electron packaging is a thin final step. The iOS/Swift client (`mighty-swift`) follows in a separate spec after this MVP proves the API contract.

## 1. Context

`go-mighty` is an authoritative Go server for Mighty, a 5-player trick-taking card game with bidding, a kitty exchange, a hidden-partner ("friend") mechanic, and special cards (Mighty ♠A, Joker, Joker-Caller ♣3). Client-facing surface:

- **Auth (REST)**: `POST /auth/signup`, `POST /auth/login` → JWT.
- **Lobby (REST)**: `POST /games` (create + auto-seat at seat 0), `POST /games/{id}/join`, `GET /games?status=waiting`, `GET /games/{id}`. Game auto-starts when the 5th player joins.
- **Gameplay (WebSocket)**: `GET /games/{id}/ws`; client must send `{"type":"AUTH","token":...}` within 5 seconds of connecting. Client sends `MOVE` messages (`bid | pass | discard | call_partner | play_card`) carrying `client_version`; server broadcasts the full `Game` JSON to all clients on every state change. Optimistic concurrency via `Game.version`.

The server is the single rules enforcer. The client renders state and composes moves; client-side rule knowledge exists only for UX affordances (enabling/disabling actions).

**Known backend concern (out of scope here)**: no per-player filtering was found in the broadcast path, so the full `Game` object (other hands, kitty) may reach every client. To be verified/fixed on the backend; the frontend renders only the local player's private data regardless.

## 2. Goals & Success Criteria

- A user can sign up, log in, create or join a game from a lobby, and play a complete hand of Mighty (bidding → kitty exchange → friend call → 10 tricks → scoring) in the browser against 4 other connected clients.
- All client logic is developed test-first. The pure core has near-total unit coverage; a Playwright E2E suite plays a full game against the real Go server.
- Functional-but-plain UI. No animations, sounds, spectator mode, or mobile layouts in this milestone.

## 3. Architecture

Thin client with a framework-free pure core. One-directional data flow; server state is the single source of truth. The client never mutates game state locally.

```
React components (dumb)
   │ callbacks                 ▲ view-models
   ▼                           │
store (zustand) ◀── setGame ── core/ (pure TS)
   ▲
   │ writes only from:
api/http.ts (auth, lobby)   api/ws.ts (AUTH, MOVE, broadcasts, reconnect)
   │                           │
   └────────── go-mighty ──────┘
```

### Module layout

```
src/
  core/          # pure TS, zero deps — most unit tests live here
    types.ts     # Game, Player, Card, Bid, Trick, Move — mirrors Go JSON
    rules.ts     # legalMoves(game, mySeat): Move[] and per-action predicates
    view.ts      # tableView(game, myPlayerId) → render-ready view-models
  api/
    http.ts      # signup/login/lobby/getGame; injectable fetch
    ws.ts        # connect → AUTH within 5s → 'game' events; send MOVE with
                 # client_version; reconnect w/ backoff + REST resync
  store/
    index.ts     # { session, lobbyGames, game, connection } — zustand
  components/    # Auth, Lobby, GameTable (+ BidPanel, KittyExchange,
                 # FriendCall, TrickArea, Hand, ScoreBoard)
  e2e/           # Playwright specs + bot harness
fixtures/        # Game JSON captured from real server broadcasts
```

### Unit responsibilities

- **`core/types.ts`** — TypeScript mirrors of the Go JSON contract. No logic.
- **`core/rules.ts`** — pure functions answering "what may I do now?": bid legality (3–10, must outrank current bid, suit ordering, no-trump precedence), follow-suit, first-trick restrictions (no trump lead unless all trumps; no Mighty unless void in lead suit), joker-call availability when leading the Joker-Caller, discard selection (exactly 3), partner-card call. UX affordances only — the server remains authoritative.
- **`core/view.ts`** — derives everything components render: seat arrangement relative to the local player, whose turn, sorted hand with per-card playability flags, current trick with play order, bid history, contract/trump/declarer summary, score breakdown with multipliers (No-Trump ×2, No-Friend ×2, 10-bid ×2, 800 cap).
- **`api/ws.ts`** — owns the socket lifecycle: sends AUTH immediately on `open`; emits typed `game` events; tags outgoing `MOVE`s with the latest seen `Game.version`; on drop, reconnects with exponential backoff and resyncs via `GET /games/{id}` after reopening.
- **`store/`** — one store; components subscribe, only `api/` layers write. Connection status: `idle | connecting | open | reconnecting`.

## 4. Screens

Minimal router with three screens:

1. **Auth** — login/signup; JWT kept in memory and `localStorage`.
2. **Lobby** — lists `GET /games?status=waiting` (polled every 3 seconds while the screen is visible), Create Game, Join; navigates to the table on success.
3. **Game Table** — single screen switching on `Game.status`:
   - `bidding`: bid panel (suit, points 3–10, no-trump toggle, pass), bid history.
   - `exchanging` (declarer only; others see a waiting state): hand + kitty, select exactly 3 discards.
   - `calling` (declarer only): partner-card picker or "No Friend".
   - `playing`: 5 seats around a table, current trick center, my hand with illegal cards disabled, joker-call prompt when leading the Joker-Caller, revealed partner indicator once the called card is played.
   - `done`: score breakdown (contract, overtricks, multipliers, per-player totals).

Components are presentational: props are view-models from `core/view.ts` plus callbacks. No component computes legality or scores itself.

## 5. Error Handling

- **WS drop**: "reconnecting…" banner; exponential backoff; REST resync on reopen; move inputs disabled while connection ≠ `open`.
- **Rejected move / version conflict**: toast with the server's reason; no local rollback needed — the next broadcast is truth.
- **401 / token expiry**: redirect to Auth, preserving the intended route.
- **AUTH deadline**: AUTH is sent synchronously in the socket `open` handler, well inside the 5-second window.

## 6. TDD Strategy

Outside-in, red-green-refactor per feature. Test pyramid:

| Layer | Share | Tool | Scope | Backend |
|---|---|---|---|---|
| Unit | ~70% | Vitest | `core/` rules + view-models; `api/ws.ts` protocol (AUTH timing, version tagging, reconnect/resync) against a mock WebSocket | mock |
| Component | ~20% | Vitest + React Testing Library | each screen rendered from fixture `Game` objects; interactions call the right callbacks with the right payloads | mock |
| E2E | ~10% | Playwright | full game start-to-finish: 1 browser player + 4 scripted bots vs the real go-mighty server (docker compose) | **real** |

Contract-safety mechanisms:

- **Fixture capture**: a script plays a deterministic scripted game against the real server and records every broadcast to `fixtures/*.json`. Unit and component tests consume these captures, so mocks cannot drift silently from the Go contract. Fixtures are re-captured whenever the backend changes.
- **Bot harness** (`e2e/bots/`): a Node module that signs up, joins, and plays simple legal moves over WebSocket. Used by Playwright to fill 4 seats, and exposed as `npm run dev:bots` so a developer can play manually against a local server.

These same captured fixtures later become the shared contract corpus for the Swift client.

## 7. Electron Packaging (final step)

The app is built and tested as a pure browser app. At the end of the milestone, wrap it with electron-vite: main process = window creation + app lifecycle only; no Node integration in the renderer; server URL configurable. One smoke test verifies the packaged app boots and reaches the Auth screen.

## 8. iOS Client (mighty-swift) — direction only, separate spec later

Same architecture translated: `MightyCore` Swift package (Codable types, `legalMoves`, view-models; XCTest, no UI), `MightyAPI` (URLSession + `URLSessionWebSocketTask` with the same AUTH/version/reconnect behavior), SwiftUI screens observing an `@Observable` store. Porting checklist = the TS core test suite: every core test gets a Swift twin, driven by the same captured JSON fixtures. Designed after the web MVP validates the contract.

## 9. Milestones

1. **M1 — Core & contract**: project scaffold, `core/types.ts` + fixture capture script, `core/rules.ts`, `core/view.ts` (all test-first).
2. **M2 — API layer**: `http.ts`, `ws.ts` with mock-WS protocol tests.
3. **M3 — Screens**: Auth → Lobby → Game Table phase by phase (bidding, exchange, friend call, play, scoring), component-tested from fixtures.
4. **M4 — E2E**: bot harness, docker-compose test target, full-game Playwright spec.
5. **M5 — Electron shell** + packaged smoke test.

## 10. Out of Scope (this milestone)

Animations/sounds, spectator mode, mobile-web layout, reconnection UX beyond the banner/resync, multi-hand sessions & running scoreboards across hands (server tracks one hand per game object today), backend changes (including broadcast filtering).
