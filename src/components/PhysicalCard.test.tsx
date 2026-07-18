import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhysicalCard } from './PhysicalCard'

const hasAccentBorder = (el: HTMLElement | null) =>
  !!el && el.style.border === '2px solid var(--color-accent)'

describe('PhysicalCard mighty highlight', () => {
  it('highlights the spade ace when spades is not trump', () => {
    const { container } = render(<PhysicalCard card={{ suit: 'spades', rank: 'A' }} trump="hearts" />)
    expect(hasAccentBorder(container.querySelector('.card-physical'))).toBe(true)
  })

  it('highlights the diamond ace and not the spade ace when spades is trump', () => {
    const spade = render(<PhysicalCard card={{ suit: 'spades', rank: 'A' }} trump="spades" />)
    expect(hasAccentBorder(spade.container.querySelector('.card-physical'))).toBe(false)

    const diamond = render(<PhysicalCard card={{ suit: 'diamonds', rank: 'A' }} trump="spades" />)
    expect(hasAccentBorder(diamond.container.querySelector('.card-physical'))).toBe(true)
  })
})
