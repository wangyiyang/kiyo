'use client'

import * as React from 'react'

type WaitlistContextValue = {
  open: boolean
  show: () => void
  hide: () => void
  setOpen: (next: boolean) => void
}

const WaitlistContext = React.createContext<WaitlistContextValue | null>(null)

export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const show = React.useCallback(() => setOpen(true), [])
  const hide = React.useCallback(() => setOpen(false), [])

  const value = React.useMemo<WaitlistContextValue>(
    () => ({ open, show, hide, setOpen }),
    [open, show, hide]
  )

  return (
    <WaitlistContext.Provider value={value}>{children}</WaitlistContext.Provider>
  )
}

export function useWaitlist(): WaitlistContextValue {
  const ctx = React.useContext(WaitlistContext)
  if (!ctx) {
    throw new Error('useWaitlist must be used within <WaitlistProvider>')
  }
  return ctx
}
