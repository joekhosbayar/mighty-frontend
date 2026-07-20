import { describe, expect, it, vi } from 'vitest'
import { ApiError, createHttp } from './http'

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch
}

describe('createHttp', () => {
  it('sends the bearer token on game creation', async () => {
    const f = fakeFetch(200, { id: 'g1' })
    await createHttp(f).createGame('tok')
    const init = (f as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('posts game config to createGame', async () => {
    const f = fakeFetch(200, { id: 'g1' })
    const http = createHttp(f)
    await http.createGame('tok', { num_players: 4, allow_joker_partner: false, fail_dist: 'two_one_split' } as any)
    const init = (f as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(init.body))).toEqual({
      num_players: 4,
      allow_joker_partner: false,
      fail_dist: 'two_one_split',
    })
  })

  it('joins, lists, and gets with the right paths', async () => {
    const f = fakeFetch(200, [])
    const http = createHttp(f)
    await http.listGames()
    expect(f).toHaveBeenCalledWith('/games?status=waiting', undefined)
    const f2 = fakeFetch(200, { id: 'g9' })
    await createHttp(f2).joinGame('tok', 'g9')
    expect(f2).toHaveBeenCalledWith('/games/g9/join', expect.anything())
  })

  it('throws ApiError with status and server text on failure', async () => {
    const http = createHttp(fakeFetch(401, 'invalid token\n'))
    const err = await http.listGames().then(
      () => null,
      e => e as ApiError,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err?.status).toBe(401)
    expect(err?.message).toBe('invalid token')
  })

  it('prefixes an absolute base when given', async () => {
    const f = fakeFetch(200, [])
    await createHttp(f, 'http://localhost:8080').listGames()
    expect(f).toHaveBeenCalledWith('http://localhost:8080/games?status=waiting', undefined)
  })
})

