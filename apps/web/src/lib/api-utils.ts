import { NextResponse } from 'next/server'

export function createUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  )
}

export function createErrorResponse(message: string, status = 500): NextResponse {
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message } },
    { status }
  )
}

export function createValidationResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', message } },
    { status: 400 }
  )
}

export function createNotFoundResponse(resource: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: `${resource} not found` } },
    { status: 404 }
  )
}

export function createForbiddenResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message } },
    { status: 403 }
  )
}

export function createPasswordIncorrectResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'PASSWORD_INCORRECT', message } },
    { status: 403 }
  )
}

export function createBadRequestResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'BAD_REQUEST', message } },
    { status: 400 }
  )
}

export async function parseBody<T>(request: Request): Promise<T | NextResponse> {
  try {
    return await request.json()
  } catch {
    return createValidationResponse('Invalid JSON body')
  }
}

export function validateString(value: unknown, name: string, maxLength: number): string | null {
  if (typeof value !== 'string') return `${name} must be a string`
  if (value.length === 0) return `${name} is required`
  if (value.length > maxLength) return `${name} must be ${maxLength} characters or less`
  return null
}

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): PaginationParams {
  const defaultPage = defaults.page ?? 1
  const defaultLimit = defaults.limit ?? 20
  const maxLimit = defaults.maxLimit ?? 100

  let page = parseInt(searchParams.get('page') ?? '', 10)
  let limit = parseInt(searchParams.get('limit') ?? '', 10)

  if (!Number.isFinite(page) || page < 1) page = defaultPage
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  return { page, limit, offset: (page - 1) * limit }
}
