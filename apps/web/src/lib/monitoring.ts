import * as Sentry from '@sentry/nextjs'

type MonitoringContext = {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

function normalizeException(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(typeof error === 'string' ? error : 'Unknown application error')
}

export function captureAppException(
  error: unknown,
  context: MonitoringContext = {}
) {
  Sentry.captureException(normalizeException(error), context)
}