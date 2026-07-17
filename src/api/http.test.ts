import { describe, expect, it, vi } from 'vitest'
import { ApiError, createHttp, decodeToken } from './http'

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch
}

describe('createHttp', () => {
  it('logs in and returns the token', async () => {
    const f = fakeFetch(200, { token: 'abc' })
    const http = createHttp(f)
    await expect(http.login('alice', 'pw')).resolves.toBe('abc')
    expect(f).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'alice', password: 'pw' }),
    }))
  })

  it('sends the bearer token on game creation', async () => {
    const f = fakeFetch(200, { id: 'g1' })
    await createHttp(f).createGame('tok')
    const init = (f as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
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
    const http = createHttp(fakeFetch(401, 'invalid credentials\n'))
    const err = await http.login('a', 'b').then(
      () => null,
      e => e as ApiError,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err?.status).toBe(401)
    expect(err?.message).toBe('invalid credentials')
  })

  it('prefixes an absolute base when given', async () => {
    const f = fakeFetch(200, [])
    await createHttp(f, 'http://localhost:8080').listGames()
    expect(f).toHaveBeenCalledWith('http://localhost:8080/games?status=waiting', undefined)
  })
})

describe('decodeToken', () => {
  it('extracts user_id and username from the JWT payload', () => {
    const payload = btoa(JSON.stringify({ user_id: 'u-1', username: 'alice' }))
    expect(decodeToken(`head.${payload}.sig`)).toEqual({ userId: 'u-1', username: 'alice' })
  })
})
