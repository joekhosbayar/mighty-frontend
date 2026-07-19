import { describe, expect, it, vi } from 'vitest'
import type { Game } from '../core/types'
import type { Http } from '../api/http'
import { ApiError } from '../api/http'
import { createAppStore, type Deps, type SocketLike } from './index'
import { baseGame, player } from '../core/testing/builders'

const TOKEN = `h.${btoa(JSON.stringify({ user_id: 'u1', username: 'alice' }))}.s`

function makeDeps(over: Partial<Http> = {}) {
  const sockets: Array<{ gameId: string; cb: Parameters<Deps['makeSocket']>[2]; socket: SocketLike }> = []
  const http: Http = {
    signup: vi.fn(async () => ({ id: 'u1', username: 'alice', email: 'a@b.c' })),
    login: vi.fn(async () => TOKEN),
    createGame: vi.fn(async () => baseGame({ id: 'g7', status: 'waiting' })),
    joinGame: vi.fn(async (_t, id) => baseGame({ id })),
    listGames: vi.fn(async () => [baseGame({ id: 'gA', status: 'waiting' })] as Game[]),
    getGame: vi.fn(async id => baseGame({ id })),
    ...over,
  }
  const storage = new Map<string, string>()
  const deps: Deps = {
    http,
    makeSocket: (gameId, _token, cb) => {
      const socket: SocketLike = { connect: vi.fn(), sendMove: vi.fn(), close: vi.fn() }
      sockets.push({ gameId, cb, socket })
      return socket
    },
    storage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => void storage.set(k, v),
      removeItem: k => void storage.delete(k),
    },
  }
  return { deps, http, sockets, storage }
}

describe('app store', () => {
  it('starts on auth when no saved token, lobby when one exists', () => {
    const { deps, storage } = makeDeps()
    expect(createAppStore(deps).getState().screen).toEqual({ name: 'auth' })
    storage.set('mighty.token', TOKEN)
    const restored = createAppStore(deps)
    expect(restored.getState().screen).toEqual({ name: 'lobby' })
    expect(restored.getState().userId).toBe('u1')
  })

  it('login stores the session and moves to the lobby', async () => {
    const { deps, storage } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    expect(store.getState()).toMatchObject({ token: TOKEN, userId: 'u1', username: 'alice' })
    expect(store.getState().screen).toEqual({ name: 'lobby' })
    expect(storage.get('mighty.token')).toBe(TOKEN)
  })

  it('signup then auto-login', async () => {
    const { deps, http } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().signup('alice', 'pw', 'a@b.c')
    expect(http.signup).toHaveBeenCalled()
    expect(store.getState().screen).toEqual({ name: 'lobby' })
  })

  it('login failure surfaces the error and stays on auth', async () => {
    const { deps } = makeDeps({ login: vi.fn(async () => { throw new ApiError(401, 'invalid credentials') }) })
    const store = createAppStore(deps)
    await store.getState().login('alice', 'bad')
    expect(store.getState().lastError).toBe('invalid credentials')
    expect(store.getState().screen).toEqual({ name: 'auth' })
  })

  it('createGame opens a socket and routes socket events into state', async () => {
    const { deps, sockets } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().createGame()
    expect(store.getState().screen).toEqual({ name: 'table', gameId: 'g7' })
    expect(sockets).toHaveLength(1)
    expect(sockets[0].socket.connect).toHaveBeenCalled()
    sockets[0].cb.onGame(baseGame({ id: 'g7', version: 12 }))
    expect(store.getState().game?.version).toBe(12)
    sockets[0].cb.onStatus('open')
    expect(store.getState().connection).toBe('open')
    sockets[0].cb.onError('not your turn')
    expect(store.getState().lastError).toBe('not your turn')
  })

  it('sendMove forwards to the socket; leaveTable closes it', async () => {
    const { deps, sockets } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().joinGame('gA')
    store.getState().sendMove('pass', null)
    expect(sockets[0].socket.sendMove).toHaveBeenCalledWith('pass', null)
    store.getState().leaveTable()
    expect(sockets[0].socket.close).toHaveBeenCalled()
    expect(store.getState().screen).toEqual({ name: 'lobby' })
  })

  it('a 401 during lobby actions logs out', async () => {
    const { deps } = makeDeps({ listGames: vi.fn(async () => { throw new ApiError(401, 'token expired') }) })
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().refreshLobby()
    expect(store.getState().screen).toEqual({ name: 'auth' })
    expect(store.getState().token).toBeNull()
  })

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
})

describe('busy retry', () => {
  it('silently resends the last move once after 300ms on game busy', async () => {
    vi.useFakeTimers()
    try {
      const { deps, sockets } = makeDeps()
      const store = createAppStore(deps)
      await store.getState().login('alice', 'pw')
      await store.getState().joinGame('gA')
      store.getState().sendMove('pass', null)
      sockets[0].cb.onError('game busy')
      expect(store.getState().lastError).toBeNull()
      expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(300)
      expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(2)
      expect(sockets[0].socket.sendMove).toHaveBeenLastCalledWith('pass', null)
      // Second busy on the retry surfaces.
      sockets[0].cb.onError('game busy')
      expect(store.getState().lastError).toBe('game busy')
    } finally {
      vi.useRealTimers()
    }
  })

  it('surfaces other errors immediately without retrying', async () => {
    const { deps, sockets } = makeDeps()
    const store = createAppStore(deps)
    await store.getState().login('alice', 'pw')
    await store.getState().joinGame('gA')
    store.getState().sendMove('pass', null)
    sockets[0].cb.onError('not your turn')
    expect(store.getState().lastError).toBe('not your turn')
    expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(1)
  })

  it('a fresh move re-arms the single retry', async () => {
    vi.useFakeTimers()
    try {
      const { deps, sockets } = makeDeps()
      const store = createAppStore(deps)
      await store.getState().login('alice', 'pw')
      await store.getState().joinGame('gA')
      store.getState().sendMove('pass', null)
      sockets[0].cb.onError('game busy')
      vi.advanceTimersByTime(300)
      store.getState().sendMove('bid', { points: 3, suit: 'clubs', is_no_trump: false })
      sockets[0].cb.onError('game busy')
      expect(store.getState().lastError).toBeNull()
      vi.advanceTimersByTime(300)
      expect(sockets[0].socket.sendMove).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
    }
  })
})
