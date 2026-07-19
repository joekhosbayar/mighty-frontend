# Game URL Routing & Mid-Game Refresh Resume

**Date:** 2026-07-18
**Status:** Approved — ready for implementation planning
**Scope:** `mighty-frontend`

## Problem

A mid-game refresh boots the player back to the open-tables page. On reload the
websocket and in-memory game store die, the app boots fresh, and — because the
active game is never encoded in the URL and never restored — it defaults to the
lobby. For a card game, an accidental refresh mid-hand abandons the game. This
is a launch blocker.

This is client-side state restoration, not hosting. Amplify's SPA URL-rewrite
only prevents 404s on deep links; it does not restore application state.

## Goal

Refreshing (or deep-linking) `/games/:id` drops the player straight back into
their in-progress hand: rejoin on load — fetch game state from the backend (hot
state already lives in Redis), reopen the websocket, re-AUTH, resubscribe —
instead of redirecting to the lobby.

## Decisions

| Decision | Choice |
| --- | --- |
| Routing scope | **Full URL routing** — every screen gets a real URL |
| Router mechanism | **react-router**, data-router API (`createBrowserRouter` + `RouterProvider`) |
| Back button during active game | **Confirm before leaving** (`useBlocker`) |
| Failed resume | **Redirect + explain** via the existing `lastError` channel |

The data-router API is required because `useBlocker` (the confirm-before-leaving
mechanism) is only available on a data router, not on `<BrowserRouter>`.

react-router is the first runtime dependency beyond react + zustand. This is a
deliberate, approved departure from the dependency-light posture, justified by
the choice of full routing plus a navigation-blocking confirmation.

## Existing primitives reused

The rejoin machinery mostly exists already and is reused rather than rebuilt:

- `openSocket(gameId)` in `src/store/index.ts` already closes any prior socket,
  opens a new one, sends `AUTH`, and wires callbacks.
- `GameSocket` (`src/api/ws.ts`) already re-AUTHs on open, calls `resync()`
  (HTTP `getGame`), and reconnects with backoff on close.
- `http.getGame(id)` (`src/api/http.ts`) already exists.
- Session is already restored from `localStorage` on boot (`TOKEN_KEY`).

The only genuinely missing pieces are the two the prerequisite names: **URL
encoding of the active game** and **boot-time resume**.

## Architecture

### Routing shell

`App.tsx` becomes a `RouterProvider` over a `createBrowserRouter` tree:

```
/            → redirect: authed ? /lobby : /login
/login       → <LoginRoute>      (if already authed → redirect to intended-or /lobby)
/lobby       → <RequireAuth><LobbyRoute>
/games/:id   → <RequireAuth><GameRoute>
*            → redirect: authed ? /lobby : /login
```

**Key shift:** the store's `screen` field is **removed**. The URL becomes the
single source of truth for which screen shows. The store keeps only
data/connection concerns (`token`, `userId`, `username`, `game`, `connection`,
`lobbyGames`, `lastError`). Navigation moves into thin route components via
`useNavigate`; store actions no longer call `set({ screen })`.

`RequireAuth` redirects to `/login` with `state={{ from: location }}` when there
is no token, so login can return the user to the game URL they deep-linked.

HTML5 history mode works in production because Amplify's SPA rewrite already
serves `index.html` for deep links.

### Store changes (data layer)

Action signatures change so route components can navigate on the result. The
store stays framework-agnostic (vanilla zustand); it exposes data + returns,
and never navigates.

- `login` / `signup` — set session, resolve on success (no `screen`). Component
  navigates to `from ?? '/lobby'`.
- `createGame` — create, set `game`, open socket, **return the new game id**.
  Component navigates to `/games/:id`.
- `joinGame(id)` — join, set `game`, open socket. Component navigates to
  `/games/:id`.
- **`resumeGame(id)` — new, idempotent.** The heart of the fix:
  - If already connected to `id`, no-op → `{ ok: true }`.
  - Otherwise `await http.getGame(id)` to validate, then check:
    - **participant** — `game.players` includes the current `userId`;
    - **not finished** — game status is not a terminal state.
  - On success → set `game`, `openSocket(id)` (AUTH delivers authoritative
    per-player state), return `{ ok: true }`.
  - On failure → return `{ ok: false, reason }` where `reason` distinguishes
    `finished` from `unavailable` (404 / not-a-participant / bad id).
- `leaveTable` — close socket, clear `game`. Called from `GameRoute` cleanup;
  component navigates to `/lobby`.
- `logout` — close socket, clear session; component navigates to `/login`.

### GameRoute: resume + leave-guard

`GameRoute` owns the game's lifecycle:

1. **On mount / `id` change:** `const r = await resumeGame(id)`. While pending,
   render the existing `"Loading game…"` state (`GameScreen` already shows this
   when `game` is null). On `!r.ok`, set `lastError`
   (`'Game has ended'` for `reason === 'finished'`,
   `'That game is no longer available'` otherwise) and `navigate('/lobby')`.
2. **Leave-guard:** `useBlocker` blocks navigation away while the game is **in
   progress** (`bidding` / `playing`). When blocked, show a confirm
   ("Leave game?"). Cancel → `blocker.reset()` (stay; URL restored).
   Confirm → `blocker.proceed()`. This guards **all** exits uniformly — the Back
   button and the existing Leave button both trigger a single confirmation.
3. **On unmount** (after a confirmed leave): cleanup effect calls `leaveTable`
   → socket closed, `game` cleared.

**Refresh is now safe and needs no `beforeunload` prompt** — reloading
`/games/:id` re-runs `resumeGame` and drops the player back into the hand.

## Resume-failure behavior (summary)

| Situation | Lands on | Message |
| --- | --- | --- |
| No token | `/login` → (after login) `/games/:id` | — |
| Game finished | `/lobby` | `Game has ended` |
| Not a participant | `/lobby` | `That game is no longer available` |
| Bad id / 404 | `/lobby` | `That game is no longer available` |

## Backend assumption (out of scope)

The reopened socket's `AUTH` restores the player's private hand, exactly as the
current in-session reconnect path already does. No backend change is assumed by
this spec; hot game state already lives in Redis and is served by the existing
`GET /games/:id` and websocket endpoints.

## Testing

Using react-router's `createMemoryRouter` with the existing injected-deps store
harness:

- Refresh/boot at `/games/:id` (valid + authed) → socket opens, table renders.
- Boot at `/games/:id` unauthed → `/login`, then post-login return to
  `/games/:id`.
- Resume failures (404 / not-participant / finished) → `/lobby` with the correct
  message.
- Leave-guard: Back and Leave during an active game → confirm; cancel stays,
  confirm tears down the socket.
- `createGame` / `joinGame` → land on `/games/:id`.
- Update existing `App.test`, `store.test`, and `LobbyScreen` usages for the
  removed `screen` field.

## Out of scope

- Backend / hosting changes (Amplify SPA rewrite is already in place).
- `beforeunload` warnings (refresh is now safe).
- Any change to game rules, gameplay, or the socket wire protocol.
