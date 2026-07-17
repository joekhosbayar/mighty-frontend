import { describe, expect, it, vi } from 'vitest'
import type { WebSocketLike } from './ws'
import { GameSocket } from './ws'

class FakeWS implements WebSocketLike {
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  send(data: string) { this.sent.push(data) }
  close() { this.onclose?.() }
  open() { this.onopen?.() }
  receive(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

function makeSocket(overrides: { fetchGame?: (id: string) => Promise<never> } = {}) {
  const ws = new FakeWS()
  const callbacks = { onGame: vi.fn(), onError: vi.fn(), onStatus: vi.fn() }
  const socket = new GameSocket({
    gameId: 'g1',
    token: 'tok',
    callbacks,
    wsFactory: () => ws,
    ...overrides,
  })
  return { ws, callbacks, socket }
}

const gameV = (version: number) => ({ id: 'g1', status: 'bidding', version })

describe('GameSocket', () => {
  it('sends AUTH as the first frame on open', () => {
    const { ws, socket, callbacks } = makeSocket()
    socket.connect()
    expect(callbacks.onStatus).toHaveBeenCalledWith('connecting')
    ws.open()
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'AUTH', token: 'tok' })
    expect(callbacks.onStatus).toHaveBeenCalledWith('open')
  })

  it('emits game broadcasts and error frames to the right callbacks', () => {
    const { ws, socket, callbacks } = makeSocket()
    socket.connect()
    ws.open()
    ws.receive(gameV(5))
    expect(callbacks.onGame).toHaveBeenCalledWith(expect.objectContaining({ version: 5 }))
    ws.receive({ type: 'ERROR', error: 'not your turn' })
    expect(callbacks.onError).toHaveBeenCalledWith('not your turn')
  })

  it('tags moves with the last seen version', () => {
    const { ws, socket } = makeSocket()
    socket.connect()
    ws.open()
    ws.receive(gameV(9))
    socket.sendMove('pass', null)
    const frame = JSON.parse(ws.sent[1])
    expect(frame).toEqual({ type: 'MOVE', move_type: 'pass', payload: null, client_version: 9 })
  })

  it('reports closed when the user closes', () => {
    const { ws, socket, callbacks } = makeSocket()
    socket.connect()
    ws.open()
    socket.close()
    expect(callbacks.onStatus).toHaveBeenLastCalledWith('closed')
    expect(ws.sent.filter(f => JSON.parse(f).type === 'MOVE')).toHaveLength(0)
  })
})
