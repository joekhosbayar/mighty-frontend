import type { Game, GameConfig } from '../core/types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface Http {
  createGame(token: string, config?: GameConfig): Promise<Game>
  joinGame(token: string, gameId: string): Promise<Game>
  listGames(): Promise<Game[]>
  getGame(gameId: string): Promise<Game>
}

export function createHttp(fetchFn: typeof fetch = fetch, base = ''): Http {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchFn(base + path, init)
    if (!res.ok) {
      throw new ApiError(res.status, (await res.text()).trim() || res.statusText)
    }
    return res.json() as Promise<T>
  }

  const post = (body: unknown, token?: string): RequestInit => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  return {
    createGame: (token, config) => request('/games', post(config ?? {}, token)),
    joinGame: (token, gameId) => request(`/games/${gameId}/join`, post({}, token)),
    listGames: () => request('/games?status=waiting', undefined),
    getGame: gameId => request(`/games/${gameId}`, undefined),
  }
}

