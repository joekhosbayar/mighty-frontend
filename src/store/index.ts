import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Game, GameConfig, MoveType } from '../core/types'
import { ApiError, createHttp, decodeToken, type Http } from '../api/http'
import { GameSocket, type ConnectionStatus, type GameSocketCallbacks } from '../api/ws'


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
  login(u: string, p: string): Promise<boolean>
  logout(): void
  refreshLobby(): Promise<void>
  createGame(config?: GameConfig): Promise<string | null>
  joinGame(gameId: string): Promise<boolean>
  resumeGame(gameId: string, signal?: AbortSignal): Promise<ResumeResult>
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
      set({ game: g, lastError: null })
      openSocket(g.id)
    }

    const saved = deps.storage.getItem(TOKEN_KEY)
    const session = saved
      ? { token: saved, ...decodeToken(saved) }
      : { token: null, userId: null, username: null }

    return {
      ...session,
      lobbyGames: [],
      game: null,
      connection: 'idle',
      lastError: null,

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
          set({ token, ...decodeToken(token), lastError: null })
          return true
        } catch (e) {
          set({ lastError: errorMessage(e) })
          return false
        }
      },

      logout() {
        socket?.close()
        socket = null
        lastMove = null
        busyRetried = false
        deps.storage.removeItem(TOKEN_KEY)
        set({
          token: null, userId: null, username: null, game: null, connection: 'idle',
        })
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
          const g = await deps.http.createGame(get().token ?? '', config)
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

export { StoreProvider, useApp } from './context'
