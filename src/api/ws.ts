import type { Game, MoveType } from '../core/types'
import { parseServerMessage } from '../core/types'

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface WebSocketLike {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: (() => void) | null
}

export interface GameSocketCallbacks {
  onGame(game: Game): void
  onError(message: string): void
  onStatus(status: ConnectionStatus): void
}

export interface GameSocketOptions {
  gameId: string
  token: string
  callbacks: GameSocketCallbacks
  wsFactory?: (path: string) => WebSocketLike
  fetchGame?: (gameId: string) => Promise<Game>
  maxBackoffMs?: number
}

function browserWsFactory(path: string): WebSocketLike {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${location.host}${path}`) as unknown as WebSocketLike
}

export class GameSocket {
  private ws: WebSocketLike | null = null
  private lastVersion = 0
  private closed = false
  private retries = 0
  private readonly opts: GameSocketOptions

  constructor(opts: GameSocketOptions) {
    this.opts = opts
  }

  connect(): void {
    const { gameId, token, callbacks } = this.opts
    callbacks.onStatus(this.retries === 0 ? 'connecting' : 'reconnecting')
    const ws = (this.opts.wsFactory ?? browserWsFactory)(`/games/${gameId}/ws`)
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'AUTH', token }))
      callbacks.onStatus('open')
      this.retries = 0
      void this.resync()
    }
    ws.onmessage = ev => {
      const msg = parseServerMessage(String(ev.data))
      if (msg.kind === 'error') callbacks.onError(msg.error)
      else this.acceptGame(msg.game)
    }
    ws.onclose = () => {
      if (this.closed) {
        callbacks.onStatus('closed')
        return
      }
      const delay = Math.min(1000 * 2 ** this.retries, this.opts.maxBackoffMs ?? 10_000)
      this.retries += 1
      callbacks.onStatus('reconnecting')
      setTimeout(() => {
        if (!this.closed) this.connect()
      }, delay)
    }
  }

  private async resync(): Promise<void> {
    if (!this.opts.fetchGame) return
    try {
      this.acceptGame(await this.opts.fetchGame(this.opts.gameId))
    } catch {
      // A failed resync is safe to ignore: the next broadcast carries full state.
    }
  }

  sendMove(moveType: MoveType, payload: unknown): void {
    this.ws?.send(
      JSON.stringify({ type: 'MOVE', move_type: moveType, payload, client_version: this.lastVersion }),
    )
  }

  close(): void {
    this.closed = true
    this.ws?.close()
  }

  private acceptGame(game: Game): void {
    if (game.version < this.lastVersion) return
    this.lastVersion = game.version
    this.opts.callbacks.onGame(game)
  }
}
