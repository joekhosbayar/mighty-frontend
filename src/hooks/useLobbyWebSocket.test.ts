import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useLobbyWebSocket } from './useLobbyWebSocket'
import { fetchAuthSession } from 'aws-amplify/auth'
import type { LobbyEvent } from '../core/types'

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}))

class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  sent: string[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((ev: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.onclose?.()
  }

  // Helper test methods
  triggerOpen() {
    this.readyState = 1
    this.onopen?.()
  }

  triggerMessage(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) })
  }

  triggerClose() {
    this.readyState = 3
    this.onclose?.()
  }
}

describe('useLobbyWebSocket', () => {
  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: { accessToken: { toString: () => 'mock-jwt-token' } },
    } as any)
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
    vi.restoreAllMocks()
  })

  it('connects to WS endpoint and sends AUTH token on open', async () => {
    const onEvent = vi.fn()
    renderHook(() => useLobbyWebSocket(onEvent))

    // Wait for microtask (fetchAuthSession) to complete
    await act(async () => {
      await Promise.resolve()
    })

    expect(MockWebSocket.instances.length).toBe(1)
    const ws = MockWebSocket.instances[0]
    expect(ws.url).toBe('ws://localhost:3000/lobby/ws')

    act(() => {
      ws.triggerOpen()
    })

    expect(ws.sent).toHaveLength(1)
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'AUTH', token: 'mock-jwt-token' })
  })

  it('handles game_created and game_joined events', async () => {
    const onEvent = vi.fn()
    renderHook(() => useLobbyWebSocket(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.triggerOpen()
    })

    const createdEvent: LobbyEvent = {
      type: 'game_created',
      game: { id: 'g1', status: 'waiting', version: 1, created_at: '', updated_at: '', players: [], current_turn: 0, dealer: 0, bids: null, current_bid: null, declarer: -1, passed_players: null, contract: null, partner_card: null, partner_seat: -1, is_no_friend: false, trump: 'none', tricks: null, scores: null },
    }
    act(() => {
      ws.triggerMessage(createdEvent)
    })
    expect(onEvent).toHaveBeenCalledWith(createdEvent)

    const joinedEvent: LobbyEvent = {
      type: 'game_joined',
      game_id: 'g1',
      players_seated: 2,
      max_players: 5,
    }
    act(() => {
      ws.triggerMessage(joinedEvent)
    })
    expect(onEvent).toHaveBeenCalledWith(joinedEvent)
  })

  it('ignores invalid JSON or unknown event types', async () => {
    const onEvent = vi.fn()
    renderHook(() => useLobbyWebSocket(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.triggerOpen()
    })

    act(() => {
      ws.triggerMessage('invalid json {')
    })
    expect(onEvent).not.toHaveBeenCalled()

    act(() => {
      ws.triggerMessage({ type: 'unknown_event' })
    })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('reconnects after close when component is mounted', async () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    renderHook(() => useLobbyWebSocket(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    expect(MockWebSocket.instances.length).toBe(1)
    const ws1 = MockWebSocket.instances[0]

    act(() => {
      ws1.triggerClose()
    })

    // Fast-forward 1000ms (retries=0 -> delay=1000)
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(MockWebSocket.instances.length).toBe(2)
    vi.useRealTimers()
  })

  it('closes WebSocket and stops reconnecting on unmount', async () => {
    const onEvent = vi.fn()
    const { unmount } = renderHook(() => useLobbyWebSocket(onEvent))

    await act(async () => {
      await Promise.resolve()
    })

    const ws = MockWebSocket.instances[0]
    const closeSpy = vi.spyOn(ws, 'close')

    unmount()

    expect(closeSpy).toHaveBeenCalled()
  })
})
