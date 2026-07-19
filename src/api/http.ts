import type { Game, GameConfig } from '../core/types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface SignupResult {
  id: string
  username: string
  email: string
}

export interface Http {
  signup(username: string, password: string, email: string): Promise<SignupResult>
  login(username: string, password: string): Promise<string>
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
    signup: (username, password, email) => request('/auth/signup', post({ username, password, email })),
    login: async (username, password) =>
      (await request<{ token: string }>('/auth/login', post({ username, password }))).token,
    createGame: (token, config) => request('/games', post(config ?? {}, token)),
    joinGame: (token, gameId) => request(`/games/${gameId}/join`, post({}, token)),
    listGames: () => request('/games?status=waiting', undefined),
    getGame: gameId => request(`/games/${gameId}`, undefined),
  }
}

export function decodeToken(token: string): { userId: string; username: string } {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(b64)) as { user_id: string; username: string }
  return { userId: payload.user_id, username: payload.username }
}
