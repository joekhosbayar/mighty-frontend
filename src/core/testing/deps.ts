import { vi } from 'vitest'
import type { Http } from '../../api/http'
import type { Deps, SocketLike } from '../../store'
import { baseGame, player } from './builders'

export const TEST_TOKEN = `h.${btoa(JSON.stringify({ user_id: 'u1', username: 'alice' }))}.s`

/** Builds injectable store deps with vitest mocks and a captured socket list. */
export function makeTestDeps(over: Partial<Http> = {}) {
  const sockets: Array<{ gameId: string; cb: Parameters<Deps['makeSocket']>[2]; socket: SocketLike }> = []
  const http: Http = {
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
