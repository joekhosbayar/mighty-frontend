import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { appStore, type AppState } from './index'

const StoreContext = createContext<StoreApi<AppState> | null>(null)

export function StoreProvider({ store, children }: { store?: StoreApi<AppState>; children: ReactNode }) {
  return <StoreContext.Provider value={store ?? appStore()}>{children}</StoreContext.Provider>
}

export function useApp<T>(selector: (s: AppState) => T): T {
  const store = useContext(StoreContext) ?? appStore()
  return useStore(store, selector)
}
