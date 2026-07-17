import { describe, expect, it } from 'vitest'
import { parseServerMessage } from './types'

describe('parseServerMessage', () => {
  it('classifies an ERROR envelope', () => {
    const msg = parseServerMessage('{"type":"ERROR","error":"invalid move: not your turn"}')
    expect(msg).toEqual({ kind: 'error', error: 'invalid move: not your turn' })
  })

  it('classifies a bare game object as a game broadcast', () => {
    const msg = parseServerMessage('{"id":"g1","status":"bidding","version":7}')
    expect(msg.kind).toBe('game')
    if (msg.kind === 'game') {
      expect(msg.game.id).toBe('g1')
      expect(msg.game.version).toBe(7)
    }
  })

  it('unwraps a move envelope carrying game_state', () => {
    const msg = parseServerMessage(
      '{"type":"move","move_type":"bid","player_id":"u1","version":9,"game_state":{"id":"g1","status":"bidding","version":9}}',
    )
    expect(msg.kind).toBe('game')
    if (msg.kind === 'game') {
      expect(msg.game.id).toBe('g1')
      expect(msg.game.version).toBe(9)
    }
  })

  it('classifies a stateless envelope like player_joined as an event needing resync', () => {
    const msg = parseServerMessage('{"type":"player_joined","player":{"id":"u2"},"version":3}')
    expect(msg).toEqual({ kind: 'event', type: 'player_joined' })
  })

  it('defaults a malformed ERROR to a message', () => {
    expect(parseServerMessage('{"type":"ERROR"}')).toEqual({ kind: 'error', error: 'unknown error' })
  })
})
