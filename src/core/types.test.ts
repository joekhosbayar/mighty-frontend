import { describe, expect, it } from 'vitest'
import { parseServerMessage } from './types'

describe('parseServerMessage', () => {
  it('classifies an ERROR envelope', () => {
    const msg = parseServerMessage('{"type":"ERROR","error":"invalid move: not your turn"}')
    expect(msg).toEqual({ kind: 'error', error: 'invalid move: not your turn' })
  })

  it('classifies anything else as a game broadcast', () => {
    const msg = parseServerMessage('{"id":"g1","status":"bidding","version":7}')
    expect(msg.kind).toBe('game')
    if (msg.kind === 'game') {
      expect(msg.game.id).toBe('g1')
      expect(msg.game.version).toBe(7)
    }
  })

  it('defaults a malformed ERROR to a message', () => {
    expect(parseServerMessage('{"type":"ERROR"}')).toEqual({ kind: 'error', error: 'unknown error' })
  })
})
