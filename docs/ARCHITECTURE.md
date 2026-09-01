# Mighty Frontend — Architecture

Web (and Electron-wrapped) client for the Korean trick-taking card game **Mighty**. The
client is a thin, mostly-stateless view over an authoritative Go backend: the server owns
game state, the client renders it, derives UI affordances from it, and sends moves.

- **Stack:** React 19 + TypeScript, Vite 8, react-router 8, Zustand 5, AWS Amplify (Cognito auth)
- **Testing:** Vitest + Testing Library (unit/component), Playwright (e2e), scripted WebSocket bots
- **Desktop:** Electron shell that loads the dev/preview URL

---

## 1. Project structure

```
mighty-frontend/
├── index.html                 Vite entry
├── vite.config.ts             dev server (:5199), backend proxy, vitest config
├── playwright.config.ts       e2e config, boots `npm run dev`
├── tsconfig.{json,app,node}   project references (app code vs. node scripts)
├── electron/main.cjs          Electron main process (loads MIGHTY_APP_URL or :5199)
├── src/                       application code (see §2)
├── e2e/
│   ├── full-game.spec.ts      Playwright: full hand through the UI
│   ├── electron.spec.ts       Playwright: Electron shell smoke test
│   └── bots/                  headless WS clients that play a game (bot.ts, spawn.ts, run-bots.ts)
├── scripts/capture-fixtures.ts  runs 5 bots, records every broadcast to fixtures/
├── fixtures/full-game.json    recorded real-server game states (contract regression data)
├── docs/superpowers/          historical design specs + implementation plans per feature
└── public/                    favicon.svg, icons.svg
```

### npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on `:5199`, proxying to backend on `:8080` |
| `npm run build` | `tsc -b` then `vite build` |
| `npm test` / `test:watch` | Vitest (jsdom) over `src/**/*.test.{ts,tsx}` |
| `npm run e2e` | Playwright suite in `e2e/` |
| `npm run bots -- <gameId>` | Spawn 4 bot players into an existing game |
| `npm run capture` | Regenerate `fixtures/full-game.json` from a real backend |
| `npm run lint` | oxlint |
| `npm run electron` | Launch the Electron shell |

### Dev proxy

`vite.config.ts` proxies `/auth`, `/games`, and `/lobby` to `http://localhost:8080`, with
`ws: true` on the two WebSocket paths. The proxy strips the `Origin` header on WS upgrades
because the Go backend rejects cross-origin upgrades but permits requests with no Origin.
The `/games` proxy also bypasses to `/index.html` for `text/html` requests so that deep
links like `/games/:id` still serve the SPA.

### Environment variables

| Var | Used by | Effect |
| --- | --- | --- |
| `VITE_API_URL` | `api/http.ts`, `api/ws.ts`, `useLobbyWebSocket` | Absolute backend base; when unset, requests are relative and rely on the dev proxy |
| `VITE_COGNITO_POOL_ID` | `core/auth.ts` | Cognito user pool |
| `VITE_COGNITO_CLIENT_ID` | `core/auth.ts` | Cognito app client |
| `MIGHTY_APP_URL` | `electron/main.cjs` | URL the desktop window loads |
| `MIGHTY_BACKEND_URL` | `e2e/bots/bot.ts` | Backend for bots (default `http://localhost:8080`) |

---

## 2. Code structure

`src/` is organized in layers, roughly bottom-up. Dependencies flow one way:
`core` ← `api` ← `store` ← `routes`/`hooks` ← `components`.

```
src/
├── main.tsx            configureAuth(), initSession(), React root
├── App.tsx             StoreProvider + createBrowserRouter(makeRoutes())
├── core/               pure domain logic — no React, no I/O
│   ├── types.ts        wire types (Game, Player, Trick, Bid, Card, MoveType…) + parseServerMessage
│   ├── cards.ts        card identity/label/sort, mighty & joker-caller derivation
│   ├── rules.ts        isLegalBid, legalPlays, canCallJoker, isValidDiscard
│   ├── view.ts         tableView(game, myPlayerId) → TableView (the UI projection)
│   ├── names.ts        deterministic table name from game id (djb2 hash)
│   ├── auth.ts         Amplify.configure() for Cognito
│   └── testing/        builders.ts (game/player factories), deps.ts (mock store deps)
├── api/
│   ├── http.ts         Http interface + createHttp(fetch, base), ApiError
│   └── ws.ts           GameSocket (per-game WS with auth, resync, backoff, version guard)
├── store/
│   ├── index.ts        createAppStore(deps) — the whole app state machine
│   └── context.tsx     StoreProvider, useApp(selector), useAppStore()
├── hooks/
│   └── useLobbyWebSocket.ts   lobby-wide event feed
├── routes/
│   ├── routes.tsx      route table
│   ├── RequireAuth.tsx redirect to `/` when no token
│   ├── LoginRoute.tsx  wires AuthScreen to store auth actions
│   ├── LobbyRoute.tsx  wires LobbyScreen to lobby actions + navigation
│   └── GameRoute.tsx   resume-by-URL, socket teardown, leave-game confirmation
├── components/         presentational, prop-driven (see below)
└── styles.css          design tokens (CSS custom properties) + global styles
```

### Layer responsibilities

**`core/` — pure domain.** Fully deterministic and independently testable. The key idea is
`tableView(game, myPlayerId)`: it takes the raw server `Game` plus the viewer's id and
produces a `TableView` containing everything the UI needs — seat list with turn/declarer/
partner/connection flags, the viewer's sorted hand with a `playable` flag per card, current
and previous trick, bids, contract, trump, score rows, and special affordances
(`jokerCallCard`, `jokerLeadCard`). Legality is computed client-side via `rules.legalPlays`
purely to gray out illegal cards; the server re-validates every move.

Hand redaction is a server concern: `Player.hand` is present only for the viewer's own
seat, and other seats expose `hand_count`. `view.ts` falls back to `hand.length` so the
frontend works against a backend deployed before redaction landed.

**`api/` — transport.** Two clients, both dependency-injectable for tests:
`createHttp(fetchFn, base)` returns an `Http` object of four methods, and `GameSocket`
wraps one WebSocket with an injectable `wsFactory`.

**`store/` — orchestration.** A single Zustand vanilla store holds all cross-screen state
and owns the socket lifecycle (see §3).

**`routes/` — glue.** Each route selects the actions it needs from the store, handles
navigation, and renders a presentational screen. `GameRoute` also owns two lifecycle
concerns: calling `resumeGame(id)` whenever the URL id changes (with an `AbortController`
so a stale response can't clobber a newer navigation), and a `useBlocker` confirmation
prompt when leaving a game in `bidding` or `playing`.

**`components/` — presentational.** Components receive a `TableView` and callbacks; they
do not read the store, with two exceptions: `GameScreen` (the store→`TableView`→`GameTable`
adapter) and `LobbyScreen` (which subscribes to the lobby socket directly).

| Component | Role |
| --- | --- |
| `LandingScreen` | Marketing/entry page at `/` |
| `AuthScreen` | Login / signup / passkey / MFA-challenge form |
| `LobbyScreen` | Open-table list, table config (players, fail rule, joker partner), passkey registration |
| `GameScreen` | Store adapter: builds `TableView`, maps UI callbacks to `sendMove` |
| `GameTable` | Phase router + header (contract, friend card, timer) + bid toasts |
| `BidPanel` / `ExchangePanel` / `FriendCallPanel` / `PlayArea` / `ScoreBoard` | One per phase: `bidding`, `exchanging`, `calling`, `playing`, `finished` |
| `Hand`, `PhysicalCard`, `PlayArea` | Card rendering and interaction |
| `ScoreGraph`, `SlotWheel`, `TurnTimer` | Score history chart, animated picker, turn countdown from `updated_at` |

`GameTable` keeps a `delayedPhase` that lags the real phase by 2.5s on the
`playing → finished` transition, so the last trick stays visible before the scoreboard
replaces it.

### Testing layout

Tests sit beside their subjects (`*.test.ts[x]`), configured in `vite.config.ts` under
`test` with `jsdom` and `src/test-setup.ts`. `core/testing/deps.ts` supplies a mocked
`Deps` (vitest-mocked `Http`, plus a list of captured fake sockets) so store behavior can
be asserted without network. `core/replay.test.ts` replays `fixtures/full-game.json` —
real broadcasts recorded from the live server — through `tableView` for every seat in every
state, which pins the client to the actual server contract rather than to hand-written
mocks.

---

## 3. State management

### The store

One Zustand **vanilla** store created by `createAppStore(deps: Deps)` in `src/store/index.ts`.
Creating it with `createStore` rather than `create` keeps it framework-free and makes
dependency injection explicit: `Deps` carries `http` and `makeSocket`, so tests substitute
fakes without module mocking.

```ts
export interface Deps {
  http: Http
  makeSocket(gameId: string, cb: GameSocketCallbacks): SocketLike
}
```

`appStore()` is a lazy singleton that wires the real `createHttp(fetch, VITE_API_URL)` and
a real `GameSocket`. `StoreProvider` puts a store (injected or the singleton) on React
context; `useApp(selector)` reads slices via `zustand`'s `useStore` so components re-render
only on the slices they select. `useAppStore()` returns the imperative handle for reading
or calling state outside render (used by `LoginRoute` for the MFA completion path).

### State shape

| Field | Meaning |
| --- | --- |
| `token`, `userId`, `username` | Derived from the Cognito session; `token` doubles as the "logged in" gate for `RequireAuth` |
| `lobbyGames: Game[]` | Waiting tables from the last `listGames()` |
| `game: Game \| null` | Raw authoritative state of the table you are at |
| `connection: ConnectionStatus` | `idle \| connecting \| open \| reconnecting \| closed` |
| `lastError: string \| null` | Last API/socket/auth error, surfaced in the UI |

Actions: `signup`, `login`, `loginWithPasskey`, `logout`, `initSession`, `refreshLobby`,
`createGame`, `joinGame`, `resumeGame`, `sendMove`, `leaveTable`.

### Design principles

**Server-authoritative, single source of truth.** The store keeps the raw `Game` exactly as
received. No optimistic mutation and no client-side game simulation; every UI value is
recomputed by `tableView` on render. There is no cache invalidation problem because there
is no derived state to invalidate.

**Closure-held, non-reactive internals.** Three pieces of mutable state live in the
`createAppStore` closure rather than in the store, because no component should re-render
on them: the active `socket`, the `lastMove` (for retry), and the `busyRetried` flag.

**Monotonic version guard.** `GameSocket.acceptGame` drops any snapshot whose `version` is
lower than the last accepted one, so a late REST resync can't overwrite a newer broadcast.

**Uniform error handling.** `fail(e)` writes `lastError`, except for `ApiError` with status
401, which triggers `logout()`. `resumeGame` maps failures to a `ResumeResult`
(`{ ok: false, reason: 'finished' | 'unavailable' }`) so `GameRoute` can redirect rather
than parse strings.

**One `game busy` retry.** If the socket reports `game busy`, the store re-sends the last
move once after 300ms; `busyRetried` prevents a retry loop.

### Local component state

Anything that is not shared lives in `useState` inside the component: bid draft, discard
selection, called-suit choice, toasts and bid bubbles, passkey registration status, and
`LobbyScreen`'s `liveGames` (seeded from the `games` prop, then patched by lobby WS events).

### Lifecycles

- **Boot:** `main.tsx` calls `configureAuth()` then `appStore().getState().initSession()`, which restores `token`/`userId`/`username` from an existing Cognito session before first render.
- **Enter a table:** `createGame` / `joinGame` → `enterGame(g)` sets `game` and opens a socket. `resumeGame(id)` (URL-driven) fetches the game, rejects finished games and games you are not seated in, then opens the socket.
- **Leave:** `leaveTable()` (called by `GameRoute` cleanup) closes the socket and clears `game`, `connection`, and the retry bookkeeping. `logout()` does the same plus Amplify `signOut()` and clearing identity.

### State flow

```
Cognito (Amplify) ──token──┐
                           ▼
  REST  /games/*  ──▶  Zustand store  ──tableView()──▶  TableView ──▶ components
  WS    /games/:id/ws ─▲     │
  WS    /lobby/ws ─────┘     └──sendMove()──▶ WS MOVE envelope ──▶ server
        (LobbyScreen)
```

---

## 4. API calls

Base URL is `VITE_API_URL` when set, otherwise relative (dev proxy). Every REST call
attaches `Authorization: Bearer <Cognito access token>`, fetched per request via
`fetchAuthSession()` so Amplify handles refresh. Non-2xx responses throw
`ApiError(status, body-text || statusText)`.

### REST (`src/api/http.ts`)

| Method | Request | Called from |
| --- | --- | --- |
| `createGame(config?)` | `POST /games` with JSON `GameConfig` (`{}` if omitted) | `store.createGame` ← `LobbyScreen` "Create Table" |
| `joinGame(gameId)` | `POST /games/{id}/join` with `{}` | `store.joinGame` ← lobby "Join Table" |
| `listGames()` | `GET /games?status=waiting` | `store.refreshLobby` ← lobby mount / refresh |
| `getGame(gameId)` | `GET /games/{id}` | `store.resumeGame` (URL resume) and `GameSocket.resync()` |

All four return a `Game`.

### Game WebSocket (`src/api/ws.ts`)

One socket per table at `/games/{gameId}/ws`, scheme derived from `VITE_API_URL` (or
`location`): `https`→`wss`, otherwise `ws`.

Client → server:

| Message | When |
| --- | --- |
| `{ type: 'AUTH', token }` | First frame after `onopen`; token from `fetchAuthSession()` |
| `{ type: 'MOVE', move_type, payload, client_version }` | Every player action; `client_version` is the last accepted `game.version` |

Move types and payloads (`MoveType` in `core/types.ts`, emitted by `GameScreen`):

| `move_type` | Payload |
| --- | --- |
| `bid` | `BidInput` — `{ points, suit, is_no_trump }` |
| `pass` | `null` |
| `discard` | `Card[]` (exactly 3) |
| `call_partner` | `{ card }` or `{ no_friend: true }` |
| `play_card` | `{ card, call_joker, called_suit? }` (`called_suit` only when leading the Joker) |
| `play_again` | `null` |
| `change_config` | `{ num_players }` |

Server → client, normalized by `parseServerMessage` into three kinds:

| Wire shape | Parsed kind | Handling |
| --- | --- | --- |
| `{ type: 'ERROR', error }` | `error` | `onError` → `lastError`, or one retry when `error === 'game busy'` |
| `{ type: ..., game_state: {...} }` | `game` | `acceptGame` (version-guarded) → `state.game` |
| `{ type: ... }` with no `game_state` (e.g. `player_joined`) | `event` | Triggers `resync()`: `GET /games/{id}` to pull full state |
| Bare game object | `game` | Same as above |

Connection management: status transitions are pushed through `onStatus`; a resync runs on
every successful open; `onclose` reconnects with exponential backoff
(`min(1000 * 2^retries, maxBackoffMs ?? 10_000)`) unless `close()` was called explicitly.
A failed resync is deliberately swallowed — the next broadcast carries full state.

### Lobby WebSocket (`src/hooks/useLobbyWebSocket.ts`)

`/lobby/ws`, opened for the lifetime of `LobbyScreen`. Sends the same
`{ type: 'AUTH', token }` first frame, then handles two `LobbyEvent`s:

- `game_created` → prepend the new game to the list
- `game_joined` (`game_id`, `players_seated`, `max_players`) → update the seated count, or drop the table once it is full

Backoff mirrors the game socket, with one difference: an `ERROR` frame is treated as an
auth failure and stops reconnecting entirely.

### Authentication (Amplify / Cognito)

`core/auth.ts` configures the Cognito user pool. Auth is not a custom REST surface; it goes
through `aws-amplify/auth` directly from the store and `LobbyScreen`:

| Amplify call | Used in | Purpose |
| --- | --- | --- |
| `signUp` | `store.signup` | Register with `email` as username and `preferred_username` as display name; no auto-login (email confirmation required) |
| `signIn` (`USER_AUTH`, `preferredChallenge: 'PASSWORD_SRP'`) | `store.login` | Password login; returns `DONE` in one round-trip for non-MFA users. Returns the raw `SignInOutput` when a further step (MFA) is needed |
| `signIn` (`USER_AUTH`, `preferredChallenge: 'WEB_AUTHN'`) | `store.loginWithPasskey` | Passkey login |
| `fetchAuthSession` | store, `http.ts`, `ws.ts`, `useLobbyWebSocket` | Access token for state and for every request/socket |
| `fetchUserAttributes` | store | `sub` → `userId`, `preferred_username` → `username` |
| `signOut` | `store.logout` | End the Cognito session |
| `associateWebAuthnCredential`, `listWebAuthnCredentials` | `LobbyScreen` | Register a passkey and show the button only when none exists |

### Bots (out-of-band client)

`e2e/bots/bot.ts` is a Node WebSocket client that drives games headlessly for e2e and
fixture capture. It reuses the production `core/rules.legalPlays` and
`core/types.parseServerMessage`, connecting to `MIGHTY_BACKEND_URL` directly (no proxy).

> Note: `bot.ts` still calls `http.signup` / `http.login` / `decodeToken`, which no longer
> exist on the `Http` interface after the move to Amplify-managed auth. The bot harness
> needs updating before `npm run bots` or `npm run capture` will run again; the recorded
> `fixtures/full-game.json` it produced is still valid and in use by `replay.test.ts`.
