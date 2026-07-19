import { RouterProvider, createBrowserRouter } from 'react-router'
import { StoreProvider } from './store/context'
import { makeRoutes } from './routes/routes'

const router = createBrowserRouter(makeRoutes())

export function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  )
}

export default App
