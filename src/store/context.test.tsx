import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createAppStore } from './index'
import { StoreProvider, useApp } from './context'
import { makeTestDeps, TEST_TOKEN } from '../core/testing/deps'

function UserProbe() {
  const userId = useApp(s => s.userId)
  return <span>{userId ?? 'anon'}</span>
}

describe('store context', () => {
  it('useApp reads the store provided by StoreProvider', () => {
    const { deps } = makeTestDeps()
    const store = createAppStore(deps)
    store.setState({ token: TEST_TOKEN, userId: 'u1', username: 'alice' })
    render(
      <StoreProvider store={store}>
        <UserProbe />
      </StoreProvider>,
    )
    expect(screen.getByText('u1')).toBeInTheDocument()
  })
})
