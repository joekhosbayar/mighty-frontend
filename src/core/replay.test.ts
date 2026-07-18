import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Game } from './types'
import { tableView } from './view'

const states = JSON.parse(readFileSync('fixtures/full-game.json', 'utf8')) as Game[]

describe('captured full-game replay (real server contract)', () => {
  it('captured a meaningful number of broadcasts', () => {
    expect(states.length).toBeGreaterThan(20)
  })

  it('reaches every phase of a hand', () => {
    const phases = new Set(states.map(s => s.status))
    for (const phase of ['bidding', 'exchanging', 'calling', 'playing', 'finished']) {
      expect(phases, `missing phase ${phase}`).toContain(phase)
    }
  })

  it('derives a coherent view for every seated player in every state', () => {
    for (const g of states) {
      for (const p of g.players) {
        if (!p) continue
        const v = tableView(g, p.id)
        expect(v.mySeat).toBe(p.seat)
        expect(v.seats).toHaveLength(5)
        if (v.hand.some(h => h.playable)) {
          expect(g.status).toBe('playing')
          expect(g.current_turn).toBe(p.seat)
        }
      }
    }
  })

  it('versions never decrease', () => {
    for (let i = 1; i < states.length; i++) {
      expect(states[i].version).toBeGreaterThanOrEqual(states[i - 1].version)
    }
  })

  // The capture may legitimately contain zero reveals (called card left in
  // the kitty); the invariant is asserted for every state that has one.
  it('reveals the partner as the seat that played the called card', () => {
    for (const g of states) {
      if (g.partner_seat >= 0 && g.partner_card) {
        const playedBy = (g.tricks ?? [])
          .flatMap(t => t.cards)
          .find(
            pc => pc.card.suit === g.partner_card!.suit && pc.card.rank === g.partner_card!.rank,
          )?.seat
        expect(playedBy).toBe(g.partner_seat)
      }
    }
  })
})
