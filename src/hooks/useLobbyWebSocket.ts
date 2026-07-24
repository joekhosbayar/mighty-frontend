import { useEffect, useRef } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import type { LobbyEvent } from '../core/types'

export function useLobbyWebSocket(onEvent: (event: LobbyEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const isComponentMounted = useRef(true)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    isComponentMounted.current = true
    let retries = 0

    const connect = async () => {
      if (!isComponentMounted.current) return

      let token = ''
      try {
        const session = await fetchAuthSession()
        token = session.tokens?.accessToken?.toString() ?? ''
      } catch (e) {
        console.warn('Failed to fetch auth session', e)
      }

      if (!isComponentMounted.current) return

      const apiUrl = import.meta.env.VITE_API_URL as string | undefined
      let urlStr = ''
      if (apiUrl) {
        const url = new URL(apiUrl)
        const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
        urlStr = `${proto}//${url.host}/lobby/ws`
      } else {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
        urlStr = `${proto}//${location.host}/lobby/ws`
      }

      const ws = new WebSocket(urlStr)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'AUTH', token }))
        retries = 0
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as Record<string, unknown>
          if (msg.type === 'ERROR') {
            console.error('Lobby WS error, stopping reconnects:', msg.error)
            isComponentMounted.current = false
            ws.close()
            return
          }
          if (msg.type === 'game_created' || msg.type === 'game_joined') {
            onEventRef.current(msg as unknown as LobbyEvent)
          }
        } catch (e) {
          console.error('Failed to parse lobby message', e)
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (isComponentMounted.current) {
          // If we failed auth, isComponentMounted was set to false, so we won't hit this.
          const delay = Math.min(1000 * 2 ** retries, 10000)
          retries += 1
          setTimeout(connect, delay)
        }
      }
    }

    void connect()

    return () => {
      isComponentMounted.current = false
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])
}

