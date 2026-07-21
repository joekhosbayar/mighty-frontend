import type { Game, GameConfig } from '../core/types'
import { fetchAuthSession } from 'aws-amplify/auth'
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface Http {
  createGame(config?: GameConfig): Promise<Game>
  joinGame(gameId: string): Promise<Game>
  listGames(): Promise<Game[]>
  getGame(gameId: string): Promise<Game>
}

async function getToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.accessToken?.toString()
  } catch {
    return undefined
  }
}

export function createHttp(fetchFn: typeof fetch = fetch, base = ''): Http {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken()
    let finalInit: RequestInit | undefined = init
    if (token) {
      const headers = new Headers(init?.headers)
      headers.set('Authorization', `Bearer ${token}`)
      finalInit = { ...init, headers }
    }

    const res = await fetchFn(base + path, finalInit)
    if (!res.ok) {
      throw new ApiError(res.status, (await res.text()).trim() || res.statusText)
    }
    return res.json() as Promise<T>
  }

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return {
    createGame: (config) => request('/games', post(config ?? {})),
    joinGame: (gameId) => request(`/games/${gameId}/join`, post({})),
    listGames: () => request('/games?status=waiting', undefined),
    getGame: gameId => request(`/games/${gameId}`, undefined),
  }
}

