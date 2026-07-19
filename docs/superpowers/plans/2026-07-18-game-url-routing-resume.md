# Game URL Routing & Mid-Game Refresh Resume — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the active game in the URL (`/games/:id`) and resume it on load, so a mid-game refresh rejoins the hand instead of booting the player to the lobby.

**Architecture:** Introduce `react-router` (data-router API) as the single source of truth for which screen shows. The store's `screen` field is removed; navigation moves into thin route components. A new idempotent `resumeGame(id)` store action fetches state, validates the player, and reopens the websocket (which re-AUTHs and resyncs — the existing reconnect path). A `useBlocker` confirms before abandoning an in-progress game.

**Tech Stack:** React 19, Zustand 5 (vanilla store), react-router 8, Vitest + React Testing Library (jsdom).

## Global Constraints

- New dependency: `react-router@^8.2.0` (package name `react-router`). No other new runtime dependencies.
- The store stays framework-agnostic (vanilla zustand). Store actions never navigate; only route components call `useNavigate`.
- The URL is the single source of truth for the active screen. After this work there is no `screen` field in the store.
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit.
- Exact user-facing copy (do not paraphrase):
  - Leave confirmation: `Leave game?`
  - Finished game on resume: `Game has ended`
  - Unavailable game on resume (404 / not-a-participant / bad id): `That game is no longer available`
- Token storage key stays `mighty.token`.
- Run the full suite with `npm test`; run a single file with `npm test -- src/path/to/file.test.tsx`.
- react-router imports (v8) all come from the `react-router` package: `createBrowserRouter`, `createMemoryRouter`, `RouterProvider`, `Navigate`, `useNavigate`, `useParams`, `useLocation`, `useBlocker`, and the `RouteObject` type.

---

## File Structure

**New files:**
- `src/store/context.tsx` — React context: `StoreProvider` + `useApp` hook (reads the store from context; falls back to the singleton).
- `src/core/testing/deps.ts` — shared `makeTestDeps()` + `TEST_TOKEN` for router/context tests.
- `src/routes/routes.tsx` — `makeRoutes(): RouteObject[]`, shared by `App` (browser router) and tests (memory router).
- `src/routes/RequireAuth.tsx` — auth guard; redirects to `/login` with `state.from`.
- `src/routes/AuthRedirect.tsx` — index/fallback redirect based on token.
- `src/routes/LoginRoute.tsx` — wraps `AuthScreen`; redirects if already authed; navigates on success.
- `src/routes/LobbyRoute.tsx` — wraps `LobbyScreen`; navigates to `/games/:id` on create/join.
- `src/routes/GameRoute.tsx` — resume-on-mount + leave-guard; renders `GameScreen`.
- `src/routes/test-utils.tsx` — `renderApp(deps, initialEntries)` helper.
- Test files alongside: `src/store/context.test.tsx`, `src/routes/routes.test.tsx`, `src/routes/GameRoute.test.tsx`.

**Modified files:**
- `src/store/index.ts` — remove `screen`; add return values to actions; add `resumeGame`.
- `src/store/index.test.ts` — drop `screen` assertions; add return-value + `resumeGame` tests.
- `src/App.tsx` — becomes `StoreProvider` + `RouterProvider`.
- `src/components/GameScreen.tsx` — `onLeave` navigates to `/lobby` instead of calling `leaveTable`.
- `package.json` — add `react-router`.

---

## Task 1: Add react-router + store context provider

**Files:**
- Modify: `package.json`
- Create: `src/store/context.tsx`
- Modify: `src/store/index.ts` (move `useApp` to context, re-export)
- Create: `src/core/testing/deps.ts`
- Test: `src/store/context.test.tsx`

**Interfaces:**
- Produces: `StoreProvider({ store?, children })`, `useApp<T>(selector)` (from `src/store/context.tsx`, re-exported by `src/store`). `makeTestDeps(over?)` returning `{ deps, http, sockets, storage }` and `TEST_TOKEN` (from `src/core/testing/deps.ts`).
- Consumes: `createAppStore`, `appStore`, `AppState`, `Deps`, `SocketLike` from `src/store`.

- [ ] **Step 1: Install react-router**

Run:
```bash
npm install react-router@^8.2.0
```
Expected: `package.json` `dependencies` now includes `"react-router": "^8.2.0"`; install succeeds.

- [ ] **Step 2: Create the shared test deps helper**

Create `src/core/testing/deps.ts`:
```ts
import { vi } from 'vitest'
import type { Http } from '../../api/http'
import type { Deps, SocketLike } from '../../store'
import { baseGame, player } from './builders'

export const TEST_TOKEN = `h.${btoa(JSON.stringify({ user_id: 'u1', username: 'alice' }))}.s`

/** Builds injectable store deps with vitest mocks and a captured socket list. */
export function makeTestDeps(over: Partial<Http> = {}) {
  const sockets: Array<{ gameId: string; cb: Parameters<Deps['makeSocket']>[2]; socket: SocketLike }> = []
  const http: Http = {
    signup: vi.fn(async () => ({ id: 'u1', username: 'alice', email: 'a@b.c' })),
    login: vi.fn(async () => TEST_TOKEN),
    createGame: vi.fn(async () => baseGame({ id: 'g7', status: 'waiting' })),
    joinGame: vi.fn(async (_t, id) => baseGame({ id })),
    listGames: vi.fn(async () => [baseGame({ id: 'gA', status: 'waiting' })]),
    getGame: vi.fn(async id => baseGame({ id })),
    ...over,
  }
  const store = new Map<string, string>()
  const deps: Deps = {
    http,
    makeSocket: (gameId, _token, cb) => {
      const socket: SocketLike = { connect: vi.fn(), sendMove: vi.fn(), close: vi.fn() }
      sockets.push({ gameId, cb, socket })
      return socket
    },
    storage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: k => void store.delete(k),
    },
  }
  return { deps, http, sockets, storage: store }
}

/** A game whose player list includes the TEST_TOKEN user (u1) at seat 0. */
export function myGame(over = {}) {
  return baseGame({
    players: [player(0, { id: 'u1' }), player(1), player(2), player(3), player(4)],
    ...over,
  })
}
```

- [ ] **Step 3: Create the store context**

Create `src/store/context.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { appStore, type AppState } from './index'

const StoreContext = createContext<StoreApi<AppState> | null>(null)

export function StoreProvider({ store, children }: { store?: StoreApi<AppState>; children: ReactNode }) {
  return <StoreContext.Provider value={store ?? appStore()}>{children}</StoreContext.Provider>
}

export function useApp<T>(selector: (s: AppState) => T): T {
  const store = useContext(StoreContext) ?? appStore()
  return useStore(store, selector)
}
```

- [ ] **Step 4: Move `useApp` out of `src/store/index.ts` and re-export**

In `src/store/index.ts`, delete the existing `useApp` export at the bottom:
```ts
export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore(), selector)
}
```
Also remove the now-unused `import { useStore } from 'zustand'` line at the top. Then add this re-export at the very bottom of the file (after `appStore`):
```ts
export { StoreProvider, useApp } from './context'
```

- [ ] **Step 5: Write the failing test**

Create `src/store/context.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createAppStore } from './index'
import { StoreProvider, useApp } from './context'
import { makeTestDeps, TEST_TOKEN } from '../core/testing/deps'

function UserProbe() {
  const userId = useApp(s => s.userId)
  return <span>{userId ?? 'anon'}</span>
}

describe('store context', () => {
  it('useApp reads the store provided by StoreProvider', () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    render(
      <StoreProvider store={createAppStore(deps)}>
        <UserProbe />
      </StoreProvider>,
    )
    expect(screen.getByText('u1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/store/context.test.tsx`
Expected: PASS. Then run `npm test` to confirm the full suite (including existing `App.test.tsx`, which still uses the singleton `useApp` via re-export) stays green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/store/context.tsx src/store/index.ts src/core/testing/deps.ts src/store/context.test.tsx
git commit -m "feat: add react-router dep and store context provider"
```

---

## Task 2: Store return values + resumeGame

**Files:**
- Modify: `src/store/index.ts`
- Test: `src/store/index.test.ts`

**Interfaces:**
- Produces (on `AppState`):
  - `login(u, p): Promise<boolean>` — `true` on success.
  - `signup(u, p, email): Promise<boolean>` — `true` when signup + auto-login succeed.
  - `createGame(): Promise<string | null>` — new game id, or `null` on failure.
  - `joinGame(gameId): Promise<boolean>` — `true` on success.
  - `resumeGame(gameId): Promise<ResumeResult>` where `export type ResumeResult = { ok: true } | { ok: false; reason: 'finished' | 'unavailable' }`.
- Consumes: `deps.http.getGame`, `openSocket`, `ApiError`, `get().userId` (existing).

_Note: this task keeps the `screen` field intact so existing tests stay green; Task 5 removes it._

- [ ] **Step 1: Write the failing tests**

Add to `src/store/index.test.ts` inside the `describe('app store', ...)` block. First add these imports at the top if missing: `import { baseGame, player } from '../core/testing/builders'` (already imports `baseGame`; add `player`).

```ts
it('login/createGame/joinGame report success to the caller', async () => {
  const { deps } = makeDeps()
  const store = createAppStore(deps)
  expect(await store.getState().login('alice', 'pw')).toBe(true)
  expect(await store.getState().createGame()).toBe('g7')
  expect(await store.getState().joinGame('gA')).toBe(true)
})

it('resumeGame connects when the caller is a participant', async () => {
  const { deps, sockets } = makeDeps({
    getGame: vi.fn(async id => baseGame({ id, players: [player(0, { id: 'u1' }), player(1), player(2), player(3), player(4)] })),
  })
  const store = createAppStore(deps)
  await store.getState().login('alice', 'pw')
  expect(await store.getState().resumeGame('g1')).toEqual({ ok: true })
  expect(store.getState().game?.id).toBe('g1')
  expect(sockets).toHaveLength(1)
  expect(sockets[0].socket.connect).toHaveBeenCalled()
})

it('resumeGame rejects a non-participant as unavailable', async () => {
  const { deps } = makeDeps() // default getGame players are p0..p4, not u1
  const store = createAppStore(deps)
  await store.getState().login('alice', 'pw')
  expect(await store.getState().resumeGame('g1')).toEqual({ ok: false, reason: 'unavailable' })
  expect(store.getState().lastError).toBe('That game is no longer available')
  expect(store.getState().game).toBeNull()
})

it('resumeGame rejects a finished game with the ended message', async () => {
  const { deps } = makeDeps({
    getGame: vi.fn(async id => baseGame({ id, status: 'finished', players: [player(0, { id: 'u1' }), player(1), player(2), player(3), player(4)] })),
  })
  const store = createAppStore(deps)
  await store.getState().login('alice', 'pw')
  expect(await store.getState().resumeGame('g1')).toEqual({ ok: false, reason: 'finished' })
  expect(store.getState().lastError).toBe('Game has ended')
})

it('resumeGame is a no-op when already connected to that game', async () => {
  const { deps, sockets, http } = makeDeps()
  const store = createAppStore(deps)
  await store.getState().login('alice', 'pw')
  await store.getState().createGame() // sets game g7, opens one socket
  expect(await store.getState().resumeGame('g7')).toEqual({ ok: true })
  expect(sockets).toHaveLength(1) // no second socket
  expect(http.getGame).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/store/index.test.ts`
Expected: FAIL — `resumeGame` is not a function; `login`/`createGame`/`joinGame` return `undefined`.

- [ ] **Step 3: Add the `ResumeResult` type and update the `AppState` interface**

In `src/store/index.ts`, add above the `AppState` interface:
```ts
export type ResumeResult = { ok: true } | { ok: false; reason: 'finished' | 'unavailable' }
```
Change the action signatures inside `interface AppState`:
```ts
  signup(u: string, p: string, email: string): Promise<boolean>
  login(u: string, p: string): Promise<boolean>
  logout(): void
  refreshLobby(): Promise<void>
  createGame(): Promise<string | null>
  joinGame(gameId: string): Promise<boolean>
  resumeGame(gameId: string): Promise<ResumeResult>
  sendMove(t: MoveType, payload: unknown): void
  leaveTable(): void
```

- [ ] **Step 4: Update the action implementations and add `resumeGame`**

In `src/store/index.ts`, replace the `signup`, `login`, `createGame`, `joinGame` implementations and add `resumeGame` (leave `screen`-setting in place for now):
```ts
      async signup(u, p, email) {
        try {
          await deps.http.signup(u, p, email)
          return await get().login(u, p)
        } catch (e) {
          set({ lastError: errorMessage(e) })
          return false
        }
      },

      async login(u, p) {
        try {
          const token = await deps.http.login(u, p)
          deps.storage.setItem(TOKEN_KEY, token)
          set({ token, ...decodeToken(token), screen: { name: 'lobby' }, lastError: null })
          return true
        } catch (e) {
          set({ lastError: errorMessage(e) })
          return false
        }
      },
```
```ts
      async createGame() {
        try {
          const g = await deps.http.createGame(get().token ?? '')
          enterGame(g)
          return g.id
        } catch (e) {
          fail(e)
          return null
        }
      },

      async joinGame(gameId) {
        try {
          enterGame(await deps.http.joinGame(get().token ?? '', gameId))
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      async resumeGame(gameId) {
        if (get().game?.id === gameId) return { ok: true }
        try {
          const g = await deps.http.getGame(gameId)
          if (g.status === 'finished') {
            set({ lastError: 'Game has ended' })
            return { ok: false, reason: 'finished' }
          }
          if (!g.players.some(p => p?.id === get().userId)) {
            set({ lastError: 'That game is no longer available' })
            return { ok: false, reason: 'unavailable' }
          }
          set({ game: g, lastError: null })
          openSocket(gameId)
          return { ok: true }
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) get().logout()
          set({ lastError: 'That game is no longer available' })
          return { ok: false, reason: 'unavailable' }
        }
      },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/store/index.test.ts`
Expected: PASS (new tests plus all existing `screen`-based tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts src/store/index.test.ts
git commit -m "feat: add resumeGame and action return values to store"
```

---

## Task 3: Route components — guard, login, lobby, and route table

**Files:**
- Create: `src/routes/AuthRedirect.tsx`, `src/routes/RequireAuth.tsx`, `src/routes/LoginRoute.tsx`, `src/routes/LobbyRoute.tsx`, `src/routes/routes.tsx`, `src/routes/test-utils.tsx`
- Test: `src/routes/routes.test.tsx`

**Interfaces:**
- Consumes: `useApp` (`src/store/context`), store actions (Task 2), presentational `AuthScreen`/`LobbyScreen`.
- Produces: `makeRoutes(): RouteObject[]` (`src/routes/routes.tsx`); `renderApp(deps, initialEntries?)` returning `{ store, router, ...RTL }` (`src/routes/test-utils.tsx`). `makeRoutes` includes `/games/:id → <RequireAuth><GameRoute/></RequireAuth>`; **`GameRoute` is created in Task 4** — this task adds a temporary stub so the route table compiles, replaced in Task 4.

- [ ] **Step 1: Create AuthRedirect and RequireAuth**

Create `src/routes/AuthRedirect.tsx`:
```tsx
import { Navigate } from 'react-router'
import { useApp } from '../store/context'

export function AuthRedirect() {
  const token = useApp(s => s.token)
  return <Navigate to={token ? '/lobby' : '/login'} replace />
}
```
Create `src/routes/RequireAuth.tsx`:
```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useApp } from '../store/context'

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useApp(s => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}
```

- [ ] **Step 2: Create LoginRoute and LobbyRoute**

Create `src/routes/LoginRoute.tsx`:
```tsx
import { Navigate, useLocation, useNavigate } from 'react-router'
import { AuthScreen } from '../components/AuthScreen'
import { useApp } from '../store/context'

export function LoginRoute() {
  const token = useApp(s => s.token)
  const lastError = useApp(s => s.lastError)
  const login = useApp(s => s.login)
  const signup = useApp(s => s.signup)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/lobby'

  if (token) return <Navigate to={from} replace />

  return (
    <AuthScreen
      error={lastError}
      onLogin={async (u, p) => {
        if (await login(u, p)) navigate(from, { replace: true })
      }}
      onSignup={async (u, p, e) => {
        if (await signup(u, p, e)) navigate(from, { replace: true })
      }}
    />
  )
}
```
Create `src/routes/LobbyRoute.tsx`:
```tsx
import { useNavigate } from 'react-router'
import { LobbyScreen } from '../components/LobbyScreen'
import { useApp } from '../store/context'

export function LobbyRoute() {
  const games = useApp(s => s.lobbyGames)
  const username = useApp(s => s.username)
  const refreshLobby = useApp(s => s.refreshLobby)
  const createGame = useApp(s => s.createGame)
  const joinGame = useApp(s => s.joinGame)
  const logout = useApp(s => s.logout)
  const navigate = useNavigate()

  return (
    <LobbyScreen
      games={games}
      username={username ?? ''}
      onRefresh={refreshLobby}
      onCreate={async () => {
        const id = await createGame()
        if (id) navigate(`/games/${id}`)
      }}
      onJoin={async id => {
        if (await joinGame(id)) navigate(`/games/${id}`)
      }}
      onLogout={logout}
    />
  )
}
```

- [ ] **Step 3: Create the route table (with a temporary GameRoute stub) and the test helper**

Create `src/routes/routes.tsx`:
```tsx
import { Navigate, type RouteObject } from 'react-router'
import { AuthRedirect } from './AuthRedirect'
import { RequireAuth } from './RequireAuth'
import { LoginRoute } from './LoginRoute'
import { LobbyRoute } from './LobbyRoute'
import { GameRoute } from './GameRoute'

export function makeRoutes(): RouteObject[] {
  return [
    { path: '/', element: <AuthRedirect /> },
    { path: '/login', element: <LoginRoute /> },
    { path: '/lobby', element: <RequireAuth><LobbyRoute /></RequireAuth> },
    { path: '/games/:id', element: <RequireAuth><GameRoute /></RequireAuth> },
    { path: '*', element: <AuthRedirect /> },
  ]
}
```
Create a **temporary** `src/routes/GameRoute.tsx` stub (replaced in Task 4) so this compiles:
```tsx
import { useApp } from '../store/context'

export function GameRoute() {
  const gameId = useApp(s => s.game?.id) ?? 'none'
  return <p>game {gameId}</p>
}
```
Create `src/routes/test-utils.tsx`:
```tsx
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { createAppStore, type Deps } from '../store'
import { StoreProvider } from '../store/context'
import { makeRoutes } from './routes'

export function renderApp(deps: Deps, initialEntries: string[] = ['/']) {
  const store = createAppStore(deps)
  const router = createMemoryRouter(makeRoutes(), { initialEntries })
  const view = render(
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>,
  )
  return { store, router, ...view }
}
```

- [ ] **Step 4: Write the failing tests**

Create `src/routes/routes.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './test-utils'
import { makeTestDeps, TEST_TOKEN } from '../core/testing/deps'

describe('routing shell', () => {
  it('redirects an unauthenticated deep link to /login', async () => {
    const { deps } = makeTestDeps()
    renderApp(deps, ['/lobby'])
    expect(await screen.findByRole('heading', { name: 'Mighty' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('redirects an authenticated user away from /login to the lobby', async () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    renderApp(deps, ['/login'])
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
  })

  it('creating a table navigates to its game URL', async () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    const { router } = renderApp(deps, ['/lobby'])
    await userEvent.click(await screen.findByRole('button', { name: 'Create Table' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/games/g7'))
  })

  it('joining a table navigates to its game URL', async () => {
    const { deps, storage } = makeTestDeps()
    storage.set('mighty.token', TEST_TOKEN)
    const { router } = renderApp(deps, ['/lobby'])
    await userEvent.click(await screen.findByRole('button', { name: 'Join Table' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/games/gA'))
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail, then pass**

Run: `npm test -- src/routes/routes.test.tsx`
Expected: the tests should PASS once the files above are in place. (If a red-first cycle is desired, temporarily rename `makeRoutes`'s `/login` element to `<AuthRedirect />` to watch the first test fail, then restore.) The create/join tests rely on `createGame`/`joinGame` pre-setting `store.game`, so the stub `GameRoute` renders without a resume redirect.

- [ ] **Step 6: Commit**

```bash
git add src/routes/
git commit -m "feat: add route components, route table, and test harness"
```

---

## Task 4: GameRoute — resume on load + leave-guard

**Files:**
- Modify (replace stub): `src/routes/GameRoute.tsx`
- Modify: `src/components/GameScreen.tsx`
- Test: `src/routes/GameRoute.test.tsx`

**Interfaces:**
- Consumes: `resumeGame`, `leaveTable`, `game.status` from the store; `useParams`, `useNavigate`, `useBlocker` from react-router.
- Produces: `<GameRoute />` mounted at `/games/:id`. On successful resume it renders `<GameScreen />`; on failure it redirects to `/lobby`.

- [ ] **Step 1: Point GameScreen's leave action at the router**

In `src/components/GameScreen.tsx`, add the import and use `useNavigate` for leaving, replacing the `leaveTable` store action:
```tsx
import { useNavigate } from 'react-router'
```
Remove the line `const leaveTable = useApp(s => s.leaveTable)`, add `const navigate = useNavigate()`, and change the prop to:
```tsx
      onLeave={() => navigate('/lobby')}
```

- [ ] **Step 2: Write the failing tests**

Create `src/routes/GameRoute.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from './test-utils'
import { makeTestDeps, myGame, TEST_TOKEN } from '../core/testing/deps'

function authedDeps(getGameImpl: Parameters<typeof makeTestDeps>[0]['getGame']) {
  const built = makeTestDeps({ getGame: getGameImpl })
  built.storage.set('mighty.token', TEST_TOKEN)
  return built
}

afterEach(() => vi.restoreAllMocks())

describe('GameRoute resume', () => {
  it('resumes a participant deep link and opens the socket', async () => {
    const { deps, sockets } = authedDeps(vi.fn(async id => myGame({ id, status: 'playing' })))
    const { router } = renderApp(deps, ['/games/g1'])
    await waitFor(() => expect(sockets).toHaveLength(1))
    expect(router.state.location.pathname).toBe('/games/g1')
  })

  it('redirects a non-participant to the lobby with a message', async () => {
    const { deps } = authedDeps(vi.fn(async id => makeTestDeps().deps.http.getGame(id))) // default players p0..p4
    const { store } = renderApp(deps, ['/games/g1'])
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
    expect(store.getState().lastError).toBe('That game is no longer available')
  })

  it('redirects a finished game to the lobby with the ended message', async () => {
    const { deps } = authedDeps(vi.fn(async id => myGame({ id, status: 'finished' })))
    const { store } = renderApp(deps, ['/games/g1'])
    expect(await screen.findByText('Open Tables')).toBeInTheDocument()
    expect(store.getState().lastError).toBe('Game has ended')
  })
})

describe('GameRoute leave-guard', () => {
  it('stays in the game when the leave confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { deps, sockets } = authedDeps(vi.fn(async id => myGame({ id, status: 'playing' })))
    const { router } = renderApp(deps, ['/games/g1'])
    await waitFor(() => expect(sockets).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Leave Table' }))
    expect(router.state.location.pathname).toBe('/games/g1')
    expect(sockets[0].socket.close).not.toHaveBeenCalled()
  })

  it('leaves and tears down the socket when the leave is confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { deps, sockets } = authedDeps(vi.fn(async id => myGame({ id, status: 'playing' })))
    const { router } = renderApp(deps, ['/games/g1'])
    await waitFor(() => expect(sockets).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Leave Table' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/lobby'))
    expect(sockets[0].socket.close).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/routes/GameRoute.test.tsx`
Expected: FAIL — the stub `GameRoute` neither resumes, redirects, nor guards leaving.

- [ ] **Step 4: Implement GameRoute**

Replace `src/routes/GameRoute.tsx` with:
```tsx
import { useEffect } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router'
import { useApp } from '../store/context'
import { GameScreen } from '../components/GameScreen'

export function GameRoute() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const resumeGame = useApp(s => s.resumeGame)
  const leaveTable = useApp(s => s.leaveTable)
  const status = useApp(s => s.game?.status)

  // Resume (or confirm we are already connected) whenever the game id changes.
  useEffect(() => {
    let cancelled = false
    void resumeGame(id).then(r => {
      if (!cancelled && !r.ok) navigate('/lobby', { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [id, resumeGame, navigate])

  // Tear the socket down when we actually leave the game route.
  useEffect(() => () => leaveTable(), [leaveTable])

  // Confirm before abandoning a game that is in progress.
  const active = status === 'bidding' || status === 'playing'
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Leave game?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  return <GameScreen />
}
```
_Note on React StrictMode: in the dev server the mount/unmount/mount cycle will call `leaveTable` then re-run `resumeGame`; because `resumeGame` is idempotent this self-heals and does not affect production builds or tests (RTL does not wrap in StrictMode)._

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/routes/GameRoute.test.tsx`
Expected: PASS (all five tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/GameRoute.tsx src/components/GameScreen.tsx src/routes/GameRoute.test.tsx
git commit -m "feat: resume game on load and confirm before leaving"
```

---

## Task 5: Switch App to the router and remove `screen`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/store/index.ts` (remove `screen` / `AppScreen`)
- Modify: `src/store/index.test.ts` (drop `screen` assertions)
- Modify: `src/App.test.tsx` (confirm/adjust)

**Interfaces:**
- Consumes: `makeRoutes`, `StoreProvider`.
- Produces: `App` renders `<StoreProvider><RouterProvider router={createBrowserRouter(makeRoutes())} /></StoreProvider>`. Store no longer has a `screen` field.

- [ ] **Step 1: Replace App with the router shell**

Replace the entire contents of `src/App.tsx` with:
```tsx
import { RouterProvider, createBrowserRouter } from 'react-router'
import { StoreProvider } from './store/context'
import { makeRoutes } from './routes/routes'

const router = createBrowserRouter(makeRoutes())

export function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  )
}

export default App
```

- [ ] **Step 2: Remove `screen` and `AppScreen` from the store**

In `src/store/index.ts`:
- Delete the type: `export type AppScreen = { name: 'auth' } | { name: 'lobby' } | { name: 'table'; gameId: string }`.
- Delete `screen: AppScreen` from the `AppState` interface.
- In the returned initial state object, delete the line `screen: saved ? ({ name: 'lobby' } as const) : ({ name: 'auth' } as const),`.
- In `login`, change the success `set` to drop `screen`:
  ```ts
  set({ token, ...decodeToken(token), lastError: null })
  ```
- In `enterGame`, drop `screen`:
  ```ts
  const enterGame = (g: Game) => {
    set({ game: g, lastError: null })
    openSocket(g.id)
  }
  ```
- In `logout`, change the `set` to drop `screen`:
  ```ts
  set({ token: null, userId: null, username: null, game: null, connection: 'idle' })
  ```
- In `leaveTable`, change the `set` to drop `screen`:
  ```ts
  set({ game: null, connection: 'idle' })
  ```

- [ ] **Step 3: Remove `screen` assertions from the store tests**

In `src/store/index.test.ts`, apply these edits:
- Replace the first test body:
  ```ts
  it('restores the session from a saved token', () => {
    const { deps, storage } = makeDeps()
    expect(createAppStore(deps).getState().token).toBeNull()
    storage.set('mighty.token', TOKEN)
    const restored = createAppStore(deps)
    expect(restored.getState().token).toBe(TOKEN)
    expect(restored.getState().userId).toBe('u1')
  })
  ```
- In `login stores the session and moves to the lobby`, rename to `login stores the session` and delete the line `expect(store.getState().screen).toEqual({ name: 'lobby' })`.
- In `signup then auto-login`, delete the line `expect(store.getState().screen).toEqual({ name: 'lobby' })` and add `expect(await store.getState().signup('alice', 'pw', 'a@b.c')).toBe(true)` in place of the bare `await store.getState().signup(...)` call.
- In `login failure surfaces the error and stays on auth`, rename to `login failure surfaces the error` and replace `expect(store.getState().screen).toEqual({ name: 'auth' })` with `expect(await store.getState().login('alice', 'bad')).toBe(false)` (move the call into the assertion; remove the standalone `await` call).
- In `createGame opens a socket and routes socket events into state`, delete the line `expect(store.getState().screen).toEqual({ name: 'table', gameId: 'g7' })`.
- In `sendMove forwards to the socket; leaveTable closes it`, replace `expect(store.getState().screen).toEqual({ name: 'lobby' })` with `expect(store.getState().game).toBeNull()`.
- In `a 401 during lobby actions logs out`, replace `expect(store.getState().screen).toEqual({ name: 'auth' })` with `expect(store.getState().token).toBeNull()` (if that assertion is already present, simply delete the `screen` line).

- [ ] **Step 4: Confirm the App test still describes reality**

`src/App.test.tsx` renders `<App />` with the default (singleton) store and no saved token, so `/` redirects through `AuthRedirect` to `/login`, rendering `AuthScreen`. The existing assertions (`heading 'Mighty'`, `label 'Username'`) still hold. Update the test name to `renders the login screen by default` and, because the redirect renders through the router, make the query async:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the login screen by default', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Mighty' })).toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS across all files. Then verify the production build/types:
```bash
npm run build
```
Expected: `tsc -b` reports no errors (confirms no dangling `screen`/`AppScreen` references), and the Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/store/index.ts src/store/index.test.ts src/App.test.tsx
git commit -m "feat: drive screens from the URL and remove the screen field"
```

---

## Task 6: Manual verification of the resume flow

**Files:** none (manual QA against the running app).

- [ ] **Step 1: Run the dev server with the backend**

Run: `npm run dev` (with the Go backend on `:8080`). Log in, create a table, and get a game to the `playing` phase (use `npm run bots` if helpful to fill seats).

- [ ] **Step 2: Verify refresh resumes**

With the URL at `/games/:id` mid-hand, reload the browser. Expected: the app returns to the same table (not the lobby), the websocket reconnects, and your hand is restored.

- [ ] **Step 3: Verify the leave-guard**

Press the browser Back button during an active hand. Expected: a `Leave game?` confirmation. Cancel → stay in the game. Confirm → land on `/lobby`.

- [ ] **Step 4: Verify failure redirects**

Manually visit `/games/does-not-exist` while logged in. Expected: redirect to `/lobby` showing `That game is no longer available`. Visit `/games/:id` while logged out. Expected: redirect to `/login`, and after logging in you land back on that game URL.

- [ ] **Step 5: Commit any doc/tweak follow-ups (if needed)**

Only if Step 1-4 surfaced a fix. Otherwise no commit.

---

## Self-Review

**Spec coverage:**
- Full URL routing (`/login`, `/lobby`, `/games/:id`) → Task 3 (`makeRoutes`) + Task 5 (App).
- react-router data router (`createBrowserRouter` + `RouterProvider`) → Task 1 (dep) + Task 5 (App); memory router for tests → Task 3 (`test-utils`).
- `screen` removed; URL is source of truth → Task 5.
- Store returns for navigation (`login`/`signup`/`createGame`/`joinGame`) → Task 2.
- `resumeGame` idempotent, participant + finished checks → Task 2; wired on mount → Task 4.
- Resume-failure copy (`Game has ended`, `That game is no longer available`) → Task 2 (source) + Task 4 (redirect).
- Unauthed deep link → `/login` with `from`, return after login → Task 3 (`RequireAuth`/`LoginRoute`) + Task 6 Step 4 (manual).
- Confirm-before-leaving via `useBlocker` covering Back and Leave → Task 4.
- Socket teardown on leave; refresh needs no `beforeunload` → Task 4.
- Tests: refresh/resume, unauth redirect, failure redirects, create/join nav, leave-guard, updated `App.test`/`store.test` → Tasks 3-5.

**Placeholder scan:** No TBD/TODO. The only intentional temporary is the `GameRoute` stub in Task 3, explicitly replaced in Task 4.

**Type consistency:** `ResumeResult` shape is used identically in Task 2 (definition), Task 4 (`r.ok`). Action names (`resumeGame`, `leaveTable`, `createGame`, `joinGame`, `login`, `signup`) match across store, route components, and tests. `makeTestDeps`/`TEST_TOKEN`/`myGame` names match between `deps.ts` and the route tests. `useApp`/`StoreProvider` import path (`../store/context`) is consistent.
