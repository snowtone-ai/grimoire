'use client'

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import { DurableUiPort } from './durable-ui-port'
import type { AppReadModel, AppUiPort } from './ui-port'

const AppPortContext = createContext<AppUiPort | null>(null)

export function AppPortProvider({
  children,
  port,
}: {
  readonly children: ReactNode
  readonly port?: AppUiPort
}) {
  const [resolvedPort] = useState<AppUiPort>(() => port ?? new DurableUiPort())

  useEffect(() => {
    if (resolvedPort instanceof DurableUiPort) void resolvedPort.initialize()
  }, [resolvedPort])

  return (
    <AppPortContext.Provider value={resolvedPort}>
      {children}
    </AppPortContext.Provider>
  )
}

export function useAppPort(): AppUiPort {
  const port = useContext(AppPortContext)
  if (port === null) throw new Error('AppPortProvider is missing.')
  return port
}

export function useAppReadModel(): AppReadModel {
  const port = useAppPort()
  return useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot)
}
