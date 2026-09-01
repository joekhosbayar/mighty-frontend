# mighty-frontend

Web and Electron client for **Mighty**, a 5-player point-trick card game with bidding and a
hidden "friend" (partner) mechanic. This is the frontend module of the Mighty workspace; the
authoritative game server lives in [`../go-mighty`](../go-mighty).

The client is deliberately thin. The server owns all game state and validates every move;
the frontend renders the state it receives, derives UI affordances from it (which cards are
playable, whose turn it is), and sends moves over a WebSocket. There is no client-side game
simulation and no optimistic state.

**Stack:** React 19 · TypeScript · Vite 8 · react-router 8 · Zustand 5 · AWS Amplify (Cognito)
**Testing:** Vitest + Testing Library · Playwright · scripted WebSocket bots

For the full architecture write-up (layering rationale, state management design, message
contracts), see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Getting started

Requires Node `^20.19.0 || >=22.12.0` (Vite 8) and a running backend on
`http://localhost:8080` (see `../go-mighty`).

```bash
npm install
npm run dev        # http://localhost:5199
```

Create `.env.local` with your Cognito app client details:

```
VITE_COGNITO_POOL_ID=<user pool id>
VITE_COGNITO_CLIENT_ID=<app client id>
# VITE_API_URL=https://api.example.com   # optional; omit to use the dev proxy
```

The dev server proxies `/auth`, `/games`, and `/lobby` (including WebSocket upgrades) to
`localhost:8080`, so leaving `VITE_API_URL` unset is the normal local setup. The proxy
strips the `Origin` header on upgrades because the Go backend rejects cross-origin WS
upgrades but accepts requests with no Origin.

### Environment variables

| Variable | Used by | Effect |
| --- | --- | --- |
| `VITE_COGNITO_POOL_ID` | `src/core/auth.ts` | Cognito user pool |
| `VITE_COGNITO_CLIENT_ID` | `src/core/auth.ts` | Cognito app client |
| `VITE_API_URL` | `src/api/http.ts`, `src/api/ws.ts`, `useLobbyWebSocket` | Absolute backend base; when unset, requests are relative and go through the dev proxy |
| `MIGHTY_APP_URL` | `electron/main.cjs` | URL the desktop window loads (default `http://localhost:5199`) |
| `MIGHTY_BACKEND_URL` | `e2e/bots/bot.ts` | Backend for bot clients (default `http://localhost:8080`) |

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on `:5199` with backend proxy |
| `npm run build` | `tsc -b` then `vite build` |
| `npm run preview` | Serve the production build (same proxy) |
| `npm test` | Vitest over `src/**/*.test.{ts,tsx}` (jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | oxlint |
| `npm run e2e` | Playwright suite in `e2e/` (boots the dev server itself) |
| `npm run electron` | Launch the Electron shell against `MIGHTY_APP_URL` |
| `npm run bots -- <gameId>` | Spawn 4 headless bot players into an existing game |
| `npm run capture` | Re-record `fixtures/full-game.json` from a live backend |

Before finishing a change, run `npm test` and `npm run build`.

---

## Project structure

```
mighty-frontend/
├── src/
│   ├── main.tsx              configure Amplify, restore session, mount React
│   ├── App.tsx               StoreProvider + router
│   ├── core/                 pure domain logic — no React, no I/O
│   │   ├── types.ts          wire types + parseServerMessage (normalizes server frames)
│   │   ├── cards.ts          card identity, labels, sorting, mighty/joker-caller derivation
│   │   ├── rules.ts          isLegalBid, legalPlays, canCallJoker, isValidDiscard
│   │   ├── view.ts           tableView(game, myId) → TableView, the single UI projection
│   │   ├── names.ts          deterministic table name from game id
│   │   ├── auth.ts           Amplify/Cognito configuration
│   │   └── testing/          game builders and mock store dependencies
│   ├── api/
│   │   ├── http.ts           REST client (createHttp) + ApiError
│   │   └── ws.ts             GameSocket: per-table WS with auth, resync, backoff
│   ├── store/
│   │   ├── index.ts          the Zustand store — all shared state and socket lifecycle
│   │   └── context.tsx       StoreProvider, useApp(selector), useAppStore()
│   ├── hooks/
│   │   └── useLobbyWebSocket.ts   lobby-wide event feed
│   ├── routes/               route table, auth guard, and one wiring component per screen
│   ├── components/           presentational UI, one panel per game phase
│   └── styles.css            design tokens + global styles
├── electron/main.cjs         Electron main process
├── e2e/                      Playwright specs and the bot harness (e2e/bots/)
├── scripts/capture-fixtures.ts   drives 5 bots and records every broadcast
├── fixtures/full-game.json   recorded real-server states, replayed in core/replay.test.ts
├── docs/
│   ├── ARCHITECTURE.md       structure, state management, and API reference
│   └── superpowers/          per-feature design specs and implementation plans
└── vite.config.ts            dev server, backend proxy, Vitest config
```

### How the layers fit together

Dependencies flow one way: `core` ← `api` ← `store` ← `routes`/`hooks` ← `components`.

- **`core/`** is pure and side-effect free, so it is testable without a DOM or network.
  Its centerpiece is `tableView(game, myPlayerId)`, which turns the raw server `Game` into a
  `TableView` holding everything the UI needs: seats with turn/declarer/partner/connection
  flags, the viewer's sorted hand with a `playable` flag per card, current and previous
  trick, bids, contract, trump, score rows, and special affordances like the joker call.
- **`api/`** holds the two transports, both injectable so tests never touch the network.
- **`store/`** is one Zustand store that owns shared state and the socket lifecycle.
- **`routes/`** selects store actions, handles navigation, and renders a screen.
- **`components/`** are prop-driven. Only `GameScreen` (the store→`TableView` adapter) and
  `LobbyScreen` (which subscribes to the lobby socket) read from the store.

Component panels map one-to-one onto game phases: `BidPanel` (`bidding`), `ExchangePanel`
(`exchanging`), `FriendCallPanel` (`calling`), `PlayArea` (`playing`), `ScoreBoard`
(`finished`), with `GameTable` routing between them.

### Tests

Unit and component tests live beside their subjects as `*.test.ts[x]`.
`core/replay.test.ts` replays `fixtures/full-game.json` — real broadcasts captured from a
live server — through `tableView` for every seat in every state, pinning the client to the
actual server contract instead of hand-written mocks.

---

## State management

A single Zustand **vanilla** store, created by `createAppStore(deps)` in `src/store/index.ts`
and exposed through React context. Components read slices with `useApp(selector)` so they
re-render only on what they select; `useAppStore()` gives an imperative handle for use
outside render.

Dependencies are injected rather than imported, which is what makes the store testable:

```ts
export interface Deps {
  http: Http
  makeSocket(gameId: string, cb: GameSocketCallbacks): SocketLike
}
```

| State | Meaning |
| --- | --- |
| `token`, `userId`, `username` | Derived from the Cognito session; `token` gates `RequireAuth` |
| `lobbyGames` | Waiting tables from the last `listGames()` |
| `game` | Raw authoritative state of the table you are at |
| `connection` | `idle \| connecting \| open \| reconnecting \| closed` |
| `lastError` | Last API/socket/auth error, surfaced in the UI |

Actions: `signup`, `login`, `loginWithPasskey`, `logout`, `initSession`, `refreshLobby`,
`createGame`, `joinGame`, `resumeGame`, `sendMove`, `leaveTable`.

Four conventions matter when working in here:

1. **The stored `Game` is never mutated.** Everything the UI shows is recomputed by
   `tableView` on render, so there is no derived state to invalidate.
2. **Non-reactive internals live in the store closure**, not in state: the active socket,
   the last move (for retry), and the retry flag. No component should re-render on these.
3. **Snapshots are version-guarded.** `GameSocket` drops any `Game` with a `version` lower
   than the last accepted one, so a slow REST resync cannot overwrite a newer broadcast.
4. **401 means log out.** All other failures set `lastError`; `resumeGame` returns a typed
   `ResumeResult` so the route can redirect instead of parsing error strings.

Everything not shared across screens stays in component `useState`: bid drafts, discard
selection, toasts, and the lobby's locally patched game list.

---

## API calls

Base URL is `VITE_API_URL` when set, otherwise relative (dev proxy). Every REST request
attaches `Authorization: Bearer <Cognito access token>`, fetched per call via
`fetchAuthSession()` so Amplify handles refresh. Non-2xx responses throw
`ApiError(status, message)`.

### REST — `src/api/http.ts`

| Method | Request | Called from |
| --- | --- | --- |
| `createGame(config?)` | `POST /games` with `GameConfig` JSON | `store.createGame` ← lobby "Create Table" |
| `joinGame(gameId)` | `POST /games/{id}/join` | `store.joinGame` ← lobby "Join Table" |
| `listGames()` | `GET /games?status=waiting` | `store.refreshLobby` ← lobby mount/refresh |
| `getGame(gameId)` | `GET /games/{id}` | `store.resumeGame` (URL resume) and `GameSocket.resync()` |

All four return a `Game`.

### Game WebSocket — `src/api/ws.ts`

One socket per table at `/games/{gameId}/ws` (`wss` when the base is `https`).

Client → server:

| Message | When |
| --- | --- |
| `{ type: 'AUTH', token }` | First frame after open |
| `{ type: 'MOVE', move_type, payload, client_version }` | Every player action |

| `move_type` | Payload |
| --- | --- |
| `bid` | `{ points, suit, is_no_trump }` |
| `pass` | `null` |
| `discard` | `Card[]` (exactly 3) |
| `call_partner` | `{ card }` or `{ no_friend: true }` |
| `play_card` | `{ card, call_joker, called_suit? }` (`called_suit` only when leading the Joker) |
| `play_again` | `null` |
| `change_config` | `{ num_players }` |

Server → client, normalized by `parseServerMessage` into three kinds:

| Wire shape | Handling |
| --- | --- |
| `{ type: 'ERROR', error }` | Sets `lastError`; `'game busy'` triggers one retry of the last move after 300ms |
| `{ type: ..., game_state: {...} }` or a bare game object | Version-guarded update of `state.game` |
| `{ type: ... }` with no `game_state` (e.g. `player_joined`) | Triggers a `GET /games/{id}` resync |

On close the socket reconnects with exponential backoff (`min(1000 · 2^retries, 10s)`)
unless it was closed deliberately, and resyncs on every successful open.

### Lobby WebSocket — `src/hooks/useLobbyWebSocket.ts`

Open for the lifetime of `LobbyScreen` at `/lobby/ws`, authenticated with the same
`AUTH` frame. It handles `game_created` (prepend the table) and `game_joined` (update the
seated count, or drop the table once full). Unlike the game socket, an `ERROR` frame is
treated as an auth failure and stops reconnecting.

### Authentication — Amplify / Cognito

Auth is not a custom REST surface; it goes through `aws-amplify/auth` directly.

| Call | Where | Purpose |
| --- | --- | --- |
| `signUp` | `store.signup` | Register (email as username, `preferred_username` as display name); requires email confirmation, so no auto-login |
| `signIn` (`USER_AUTH`, `PASSWORD_SRP`) | `store.login` | Password login in one round-trip; returns the raw `SignInOutput` when MFA is required |
| `signIn` (`USER_AUTH`, `WEB_AUTHN`) | `store.loginWithPasskey` | Passkey login |
| `fetchAuthSession` | store, `http.ts`, `ws.ts`, lobby hook | Access token for state, requests, and sockets |
| `fetchUserAttributes` | store | `sub` → `userId`, `preferred_username` → `username` |
| `signOut` | `store.logout` | End the session |
| `associateWebAuthnCredential`, `listWebAuthnCredentials` | `LobbyScreen` | Register a passkey; hide the button when one exists |

---

## Known issue: the bot harness is stale

`e2e/bots/bot.ts` still calls `http.signup`, `http.login`, and `decodeToken`, none of which
exist on the `Http` interface after auth moved to Amplify-managed Cognito. `npm run bots`,
`npm run capture`, and the Playwright specs that depend on bots therefore need the harness
updated to obtain tokens through Cognito. The already-recorded `fixtures/full-game.json`
remains valid and is still exercised by `core/replay.test.ts`.
