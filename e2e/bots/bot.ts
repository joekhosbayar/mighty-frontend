import WebSocket from 'ws'
import { createHttp, decodeToken } from '../../src/api/http'
import { legalPlays } from '../../src/core/rules'
import { parseServerMessage, type Game, type MoveType } from '../../src/core/types'

const BACKEND = process.env.MIGHTY_BACKEND_URL ?? 'http://localhost:8080'

export interface BotOptions {
  name: string
  gameId?: string
  opensBidding?: boolean
  onRaw?(raw: string): void
  onGame?(game: Game): void
}

export interface BotHandle {
  done: Promise<Game>
  gameId: string
  userId: string
  stop(): void
}

export async function runBot(opts: BotOptions): Promise<BotHandle> {
  const http = createHttp(fetch.bind(globalThis), BACKEND)
  try {
    await http.signup(opts.name, 'botpass123', `${opts.name}@bots.local`)
  } catch {
    // 409: bot account already exists — fine, just log in.
  }
  const token = await http.login(opts.name, 'botpass123')
  const { userId } = decodeToken(token)
  const game = opts.gameId ? await http.joinGame(token, opts.gameId) : await http.createGame(token)

  const ws = new WebSocket(`${BACKEND.replace(/^http/, 'ws')}/games/${game.id}/ws`)

  let resolveDone!: (g: Game) => void
  let rejectDone!: (e: Error) => void
  const done = new Promise<Game>((res, rej) => {
    resolveDone = res
    rejectDone = rej
  })

  let lastActed = -1
  let retryOffset = 0
  let current: Game | null = null

  const send = (moveType: MoveType, payload: unknown, version: number) =>
    ws.send(JSON.stringify({ type: 'MOVE', move_type: moveType, payload, client_version: version }))

  const act = (g: Game) => {
    const me = g.players.find(p => p?.id === userId)
    if (!me) return
    if (g.status === 'finished') {
      resolveDone(g)
      ws.close()
      return
    }
    if (g.version === lastActed) return

    if (g.status === 'bidding' && g.current_turn === me.seat) {
      lastActed = g.version
      if (opts.opensBidding && !g.current_bid) {
        send('bid', { points: 3, suit: 'clubs', is_no_trump: false }, g.version)
      } else {
        send('pass', null, g.version)
      }
    } else if (g.status === 'exchanging' && g.declarer === me.seat) {
      lastActed = g.version
      send('discard', (me.hand ?? []).slice(0, 3), g.version)
    } else if (g.status === 'calling' && g.declarer === me.seat) {
      lastActed = g.version
      send('call_partner', { suit: 'hearts', rank: 'A' }, g.version)
    } else if (g.status === 'playing' && g.current_turn === me.seat) {
      lastActed = g.version
      const plays = legalPlays(g, me.seat)
      const card = plays[Math.min(retryOffset, Math.max(plays.length - 1, 0))]
      if (card) send('play_card', { card, call_joker: false }, g.version)
    }
  }

  const accept = (g: Game) => {
    if (current && g.version < current.version) return
    retryOffset = 0
    current = g
    opts.onGame?.(g)
    act(g)
  }

  const resync = async () => {
    try {
      accept(await http.getGame(game.id))
    } catch {
      // Transient fetch failure — the next event or envelope recovers state.
    }
  }

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'AUTH', token }))
    void resync()
  })
  ws.on('message', data => {
    const raw = data.toString()
    opts.onRaw?.(raw)
    const msg = parseServerMessage(raw)
    if (msg.kind === 'error') {
      // Rejected move: try the next legal option on the same state.
      retryOffset += 1
      if (current) {
        lastActed = -1
        act(current)
      }
      return
    }
    if (msg.kind === 'event') {
      // Stateless envelope (e.g. player_joined) — refetch over REST.
      void resync()
      return
    }
    accept(msg.game)
  })
  ws.on('error', e => rejectDone(e instanceof Error ? e : new Error(String(e))))

  return { done, gameId: game.id, userId, stop: () => ws.close() }
}
