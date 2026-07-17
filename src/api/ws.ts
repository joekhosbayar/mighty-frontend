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

  constructor(private readonly opts: GameSocketOptions) {}

  connect(): void {
    const { gameId, token, callbacks } = this.opts
    callbacks.onStatus('connecting')
    const ws = (this.opts.wsFactory ?? browserWsFactory)(`/games/${gameId}/ws`)
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'AUTH', token }))
      callbacks.onStatus('open')
    }
    ws.onmessage = ev => {
      const msg = parseServerMessage(String(ev.data))
      if (msg.kind === 'error') callbacks.onError(msg.error)
      else this.acceptGame(msg.game)
    }
    ws.onclose = () => {
      callbacks.onStatus('closed')
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
