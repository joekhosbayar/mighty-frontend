import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the landing screen by default', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'MIGHTY' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Log In to Play' })).toBeInTheDocument()
})
