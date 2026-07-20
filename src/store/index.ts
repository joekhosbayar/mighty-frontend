import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Game, GameConfig, MoveType } from '../core/types'
import { ApiError, createHttp, type Http } from '../api/http'
import { GameSocket, type ConnectionStatus, type GameSocketCallbacks } from '../api/ws'
import { signIn, signUp, signOut, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'


export interface SocketLike {
  connect(): void
  sendMove(t: MoveType, p: unknown): void
  close(): void
}

export interface Deps {
  http: Http
  makeSocket(gameId: string, cb: GameSocketCallbacks): SocketLike
}

export type ResumeResult = { ok: true } | { ok: false; reason: 'finished' | 'unavailable' }

export interface AppState {
  token: string | null
  userId: string | null
  username: string | null
  lobbyGames: Game[]
  game: Game | null
  connection: ConnectionStatus
  lastError: string | null
  signup(u: string, p: string, email: string): Promise<boolean>
  login(u: string, p: string): Promise<boolean | import('aws-amplify/auth').SignInOutput>
  logout(): void
  initSession(): Promise<void>
  refreshLobby(): Promise<void>
  createGame(config?: GameConfig): Promise<string | null>
  joinGame(gameId: string): Promise<boolean>
  resumeGame(gameId: string, signal?: AbortSignal): Promise<ResumeResult>
  sendMove(t: MoveType, payload: unknown): void
  leaveTable(): void
}


function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function createAppStore(deps: Deps): StoreApi<AppState> {
  let socket: SocketLike | null = null
  let lastMove: { t: MoveType; payload: unknown } | null = null
  let busyRetried = false

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
      socket = deps.makeSocket(gameId, {
        onGame: g => set({ game: g }),
        onError: msg => {
          if (msg === 'game busy' && lastMove && !busyRetried) {
            busyRetried = true
            const move = lastMove
            setTimeout(() => socket?.sendMove(move.t, move.payload), 300)
            return
          }
          set({ lastError: msg })
        },
        onStatus: s => set({ connection: s }),
      })
      socket.connect()
    }

    const enterGame = (g: Game) => {
      set({ game: g, lastError: null })
      openSocket(g.id)
    }

    return {
      token: null,
      userId: null,
      username: null,
      lobbyGames: [],
      game: null,
      connection: 'idle',
      lastError: null,

      async initSession() {
        try {
          const session = await fetchAuthSession()
          const attrs = await fetchUserAttributes()
          const token = session.tokens?.accessToken?.toString() ?? null
          set({ token, userId: attrs.sub ?? null, username: attrs.preferred_username ?? null, lastError: null })
        } catch (e) {
          set({ token: null, userId: null, username: null })
        }
      },

      async signup(u, p, email) {
        try {
          await signUp({ username: email, password: p, options: { userAttributes: { email, preferred_username: u } } });
          return true; // We don't auto-login here because they need to confirm
        } catch (e) {
          set({ lastError: errorMessage(e) });
          return false;
        }
      },

      async login(u, p) {
        try {
          const res = await signIn({ username: u, password: p, options: { authFlowType: 'USER_AUTH' } });
          if (res.nextStep.signInStep === 'DONE') {
            const session = await fetchAuthSession();
            const attrs = await fetchUserAttributes();
            const token = session.tokens?.accessToken?.toString() ?? null;
            set({ token, userId: attrs.sub ?? null, username: attrs.preferred_username ?? u, lastError: null });
            return true;
          }
          return res;
        } catch (e) {
          set({ lastError: errorMessage(e) });
          return false;
        }
      },

      logout() {
        socket?.close();
        socket = null;
        lastMove = null;
        busyRetried = false;
        signOut().catch(console.error);
        set({ token: null, userId: null, username: null, game: null, connection: 'idle' });
      },

      async refreshLobby() {
        try {
          set({ lobbyGames: await deps.http.listGames() })
        } catch (e) {
          fail(e)
        }
      },

      async createGame(config) {
        try {
          const g = await deps.http.createGame(config)
          enterGame(g)
          return g.id
        } catch (e) {
          fail(e)
          return null
        }
      },

      async joinGame(gameId) {
        try {
          enterGame(await deps.http.joinGame(gameId))
          return true
        } catch (e) {
          fail(e)
          return false
        }
      },

      async resumeGame(gameId, signal) {
        if (get().game?.id === gameId) return { ok: true }
        try {
          const g = await deps.http.getGame(gameId)
          if (signal?.aborted) return { ok: false, reason: 'unavailable' }
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

      sendMove(t, payload) {
        lastMove = { t, payload }
        busyRetried = false
        socket?.sendMove(t, payload)
      },

      leaveTable() {
        socket?.close()
        socket = null
        lastMove = null
        busyRetried = false
        set({ game: null, connection: 'idle' })
      },
    }
  })
}


let defaultStore: StoreApi<AppState> | null = null

export function appStore(): StoreApi<AppState> {
  if (!defaultStore) {
    const http = createHttp(fetch.bind(globalThis))
    defaultStore = createAppStore({
      http,
      makeSocket: (gameId, callbacks) =>
        new GameSocket({ gameId, callbacks, fetchGame: id => http.getGame(id) }),
    })
  }
  return defaultStore
}

export { StoreProvider, useApp } from './context'
