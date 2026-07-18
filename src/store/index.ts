import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Game, MoveType } from '../core/types'
import { ApiError, createHttp, decodeToken, type Http } from '../api/http'
import { GameSocket, type ConnectionStatus, type GameSocketCallbacks } from '../api/ws'

export type AppScreen = { name: 'auth' } | { name: 'lobby' } | { name: 'table'; gameId: string }

export interface SocketLike {
  connect(): void
  sendMove(t: MoveType, p: unknown): void
  close(): void
}

export interface Deps {
  http: Http
  makeSocket(gameId: string, token: string, cb: GameSocketCallbacks): SocketLike
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

export interface AppState {
  token: string | null
  userId: string | null
  username: string | null
  screen: AppScreen
  lobbyGames: Game[]
  game: Game | null
  connection: ConnectionStatus
  lastError: string | null
  signup(u: string, p: string, email: string): Promise<void>
  login(u: string, p: string): Promise<void>
  logout(): void
  refreshLobby(): Promise<void>
  createGame(): Promise<void>
  joinGame(gameId: string): Promise<void>
  sendMove(t: MoveType, payload: unknown): void
  leaveTable(): void
}

const TOKEN_KEY = 'mighty.token'

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
      socket = deps.makeSocket(gameId, get().token ?? '', {
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
      set({ game: g, screen: { name: 'table', gameId: g.id }, lastError: null })
      openSocket(g.id)
    }

    const saved = deps.storage.getItem(TOKEN_KEY)
    const session = saved
      ? { token: saved, ...decodeToken(saved) }
      : { token: null, userId: null, username: null }

    return {
      ...session,
      screen: saved ? ({ name: 'lobby' } as const) : ({ name: 'auth' } as const),
      lobbyGames: [],
      game: null,
      connection: 'idle',
      lastError: null,

      async signup(u, p, email) {
        try {
          await deps.http.signup(u, p, email)
          await get().login(u, p)
        } catch (e) {
          set({ lastError: errorMessage(e) })
        }
      },

      async login(u, p) {
        try {
          const token = await deps.http.login(u, p)
          deps.storage.setItem(TOKEN_KEY, token)
          set({ token, ...decodeToken(token), screen: { name: 'lobby' }, lastError: null })
        } catch (e) {
          set({ lastError: errorMessage(e) })
        }
      },

      logout() {
        socket?.close()
        socket = null
        lastMove = null
        busyRetried = false
        deps.storage.removeItem(TOKEN_KEY)
        set({
          token: null, userId: null, username: null,
          screen: { name: 'auth' }, game: null, connection: 'idle',
        })
      },

      async refreshLobby() {
        try {
          set({ lobbyGames: await deps.http.listGames() })
        } catch (e) {
          fail(e)
        }
      },

      async createGame() {
        try {
          enterGame(await deps.http.createGame(get().token ?? ''))
        } catch (e) {
          fail(e)
        }
      },

      async joinGame(gameId) {
        try {
          enterGame(await deps.http.joinGame(get().token ?? '', gameId))
        } catch (e) {
          fail(e)
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
        set({ screen: { name: 'lobby' }, game: null, connection: 'idle' })
      },
    }
  })
}

function defaultStorage(): Deps['storage'] {
  try {
    const s = window.localStorage
    if (s) {
      s.getItem('mighty.probe')
      return s
    }
  } catch {
    // Storage disabled (private mode, sandbox) — fall through to memory.
  }
  const mem = new Map<string, string>()
  return {
    getItem: k => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: k => void mem.delete(k),
  }
}

let defaultStore: StoreApi<AppState> | null = null

export function appStore(): StoreApi<AppState> {
  if (!defaultStore) {
    const http = createHttp(fetch.bind(globalThis))
    defaultStore = createAppStore({
      http,
      makeSocket: (gameId, token, callbacks) =>
        new GameSocket({ gameId, token, callbacks, fetchGame: id => http.getGame(id) }),
      storage: defaultStorage(),
    })
  }
  return defaultStore
}

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore(), selector)
}
