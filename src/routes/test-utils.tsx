import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { createAppStore, type Deps, type AppState } from '../store'
import { StoreProvider } from '../store/context'
import { makeRoutes } from './routes'

export function renderApp(deps: Deps, initialEntries: string[] = ['/'], initialState?: Partial<AppState>) {
  const store = createAppStore(deps)
  if (initialState) store.setState(initialState)
  const router = createMemoryRouter(makeRoutes(), { initialEntries })
  const view = render(
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>,
  )
  return { store, router, ...view }
}
