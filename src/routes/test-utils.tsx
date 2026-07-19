import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { createAppStore, type Deps } from '../store'
import { StoreProvider } from '../store/context'
import { makeRoutes } from './routes'

export function renderApp(deps: Deps, initialEntries: string[] = ['/']) {
  const store = createAppStore(deps)
  const router = createMemoryRouter(makeRoutes(), { initialEntries })
  const view = render(
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>,
  )
  return { store, router, ...view }
}
