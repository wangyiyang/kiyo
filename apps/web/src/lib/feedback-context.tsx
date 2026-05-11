'use client'

import * as React from 'react'

type FeedbackContextValue = {
  open: boolean
  show: () => void
  hide: () => void
  setOpen: (next: boolean) => void
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const show = React.useCallback(() => setOpen(true), [])
  const hide = React.useCallback(() => setOpen(false), [])

  const value = React.useMemo<FeedbackContextValue>(
    () => ({ open, show, hide, setOpen }),
    [open, show, hide]
  )

  return (
    <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackContextValue {
  const ctx = React.useContext(FeedbackContext)
  if (!ctx) {
    throw new Error('useFeedback must be used within <FeedbackProvider>')
  }
  return ctx
}
