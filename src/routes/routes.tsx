import { Navigate, type RouteObject } from 'react-router'
import { AuthRedirect } from './AuthRedirect'
import { RequireAuth } from './RequireAuth'
import { LoginRoute } from './LoginRoute'
import { LobbyRoute } from './LobbyRoute'
import { GameRoute } from './GameRoute'

export function makeRoutes(): RouteObject[] {
  return [
    { path: '/', element: <AuthRedirect /> },
    { path: '/login', element: <LoginRoute /> },
    { path: '/lobby', element: <RequireAuth><LobbyRoute /></RequireAuth> },
    { path: '/games/:id', element: <RequireAuth><GameRoute /></RequireAuth> },
    { path: '*', element: <AuthRedirect /> },
  ]
}
