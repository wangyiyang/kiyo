import * as Sentry from '@sentry/nextjs'

type MonitoringContext = {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatErrorPart(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return undefined
}

function normalizeException(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === 'string') {
    return new Error(error)
  }

  if (isPlainObject(error)) {
    const code = formatErrorPart(error.code)
    const message = formatErrorPart(error.message)

    if (code && message) {
      return new Error(`${code}: ${message}`)
    }

    if (message) {
      return new Error(message)
    }

    if (code) {
      return new Error(`Error code: ${code}`)
    }
  }

  return new Error('Unknown application error')
}

function withOriginalError(
  error: unknown,
  context: MonitoringContext
): MonitoringContext {
  if (error instanceof Error || !isPlainObject(error)) {
    return context
  }

  return {
    ...context,
    extra: {
      ...context.extra,
      originalError: error,
    },
  }
}

export function captureAppException(
  error: unknown,
  context: MonitoringContext = {}
) {
  Sentry.captureException(
    normalizeException(error),
    withOriginalError(error, context)
  )
}
