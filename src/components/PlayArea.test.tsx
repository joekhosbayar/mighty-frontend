import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayArea } from './PlayArea'
import { tableView } from '../core/view'
import { baseGame, c, player, trick } from '../core/testing/builders'

const playingGame = (hand: ReturnType<typeof c>[], over = {}) =>
  baseGame({
    status: 'playing', trump: 'hearts', current_turn: 0, declarer: 1,
    players: [player(0, { hand }), player(1), player(2), player(3), player(4)],
    tricks: [trick({ winner: 0 }), trick()],
    ...over,
  })

describe('PlayArea', () => {
  it('renders seats and the current trick', () => {
    const g = playingGame([c('clubs', '5')], {
      tricks: [
        trick({ winner: 2 }),
        trick({ lead_suit: 'diamonds', cards: [{ player_id: 'p2', seat: 2, card: c('diamonds', 'Q') }] }),
      ],
    })
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={vi.fn()} />)
    expect(screen.getByTestId('seat-1')).toHaveTextContent('declarer')
    expect(screen.getByTestId('trick-card-2')).toHaveTextContent('♦Q')
  })

  it('plays an ordinary card immediately without calling the joker', async () => {
    const onPlayCard = vi.fn()
    render(<PlayArea view={tableView(playingGame([c('clubs', '5')]), 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-5'))
    expect(onPlayCard).toHaveBeenCalledWith(c('clubs', '5'), false)
  })

  it('offers the joker call when leading the joker caller', async () => {
    const onPlayCard = vi.fn()
    const g = playingGame([c('clubs', '3'), c('diamonds', '2')])
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-3'))
    expect(onPlayCard).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Call the Joker' }))
    expect(onPlayCard).toHaveBeenCalledWith(c('clubs', '3'), true)
  })

  it('can decline the joker call', async () => {
    const onPlayCard = vi.fn()
    const g = playingGame([c('clubs', '3'), c('diamonds', '2')])
    render(<PlayArea view={tableView(g, 'p0')} onPlayCard={onPlayCard} />)
    await userEvent.click(screen.getByTestId('hand-card-clubs-3'))
    await userEvent.click(screen.getByRole('button', { name: 'Play without calling' }))
    expect(onPlayCard).toHaveBeenCalledWith(c('clubs', '3'), false)
  })
})
