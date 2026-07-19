import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the login screen by default', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Mighty' })).toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
})
