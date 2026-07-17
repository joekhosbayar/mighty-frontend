import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Hand } from './Hand'
import { c } from '../core/testing/builders'

const cards = [
  { card: c('spades', 'A'), playable: true },
  { card: c('clubs', '5'), playable: false },
]

describe('Hand', () => {
  it('play mode: enables only playable cards and reports clicks', async () => {
    const onCard = vi.fn()
    render(<Hand cards={cards} mode="play" onCard={onCard} />)
    expect(screen.getByTestId('hand-card-clubs-5')).toBeDisabled()
    await userEvent.click(screen.getByTestId('hand-card-spades-A'))
    expect(onCard).toHaveBeenCalledWith(c('spades', 'A'))
  })

  it('select mode: everything enabled, selection marked pressed', async () => {
    const onCard = vi.fn()
    render(<Hand cards={cards} mode="select" selected={[c('clubs', '5')]} onCard={onCard} />)
    expect(screen.getByTestId('hand-card-clubs-5')).toBeEnabled()
    expect(screen.getByTestId('hand-card-clubs-5')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('hand-card-spades-A')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByTestId('hand-card-clubs-5'))
    expect(onCard).toHaveBeenCalledWith(c('clubs', '5'))
  })
})
