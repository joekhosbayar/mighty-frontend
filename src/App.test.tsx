import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the auth screen by default', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Mighty' })).toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
})
