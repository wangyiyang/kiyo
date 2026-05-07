# Minimax AI Service Abstraction Layer Design

## Background

Issue #6 requires building an abstraction layer for Minimax (CN) AI APIs to support:
- Album cover generation (text-to-image)
- Lyrics generation (large language model text generation)
- Music generation (reserved interface)

The layer must hide Minimax implementation details from business code, inject API keys via environment variables, and provide unified error handling, retry logic, and timeout configuration.

## Goals

1. Create `packages/ai` as a shared monorepo package
2. Expose clean TypeScript APIs for image generation, text generation, and music generation
3. Never expose Minimax SDK or HTTP details to consumers
4. Unified error types with clear messages
5. Configurable retry (exponential backoff, max 3 attempts) and timeout (default 30s)
6. Unit tests with mocked HTTP

## Architecture

### Package Location

`packages/ai` — follows the existing monorepo pattern used by `packages/supabase` and `packages/ui`.

```
packages/ai/
├── src/
│   ├── client.ts      # Unified HTTP client with retry, timeout, error handling
│   ├── image.ts       # Text-to-image API wrapper
│   ├── text.ts        # LLM text generation wrapper
│   ├── music.ts       # Music generation (reserved/stubbed)
│   ├── errors.ts      # Custom error types
│   └── index.ts       # Public exports
├── package.json
├── tsconfig.json
└── src/
    └── __tests__/
        ├── client.test.ts
        ├── image.test.ts
        ├── text.test.ts
        └── music.test.ts
```

### HTTP Client (`src/client.ts`)

- Uses native `fetch()` directly against Minimax REST API endpoints
- Configuration injected via environment variables
- Retry strategy: exponential backoff, max 3 retries, only on 5xx and network errors
- Timeout: default 30s per request
- Headers: `Authorization: Bearer {MINIMAX_API_KEY}`, `Content-Type: application/json`

### Error Handling (`src/errors.ts`)

```typescript
export class MinimaxError extends Error {
  constructor(
    message: string,
    public code: 'network' | 'timeout' | 'rate_limit' | 'api_error' | 'unknown',
    public statusCode?: number,
    public responseBody?: unknown
  )
}
```

- `network`: fetch failure, DNS, connection reset
- `timeout`: request exceeded timeout
- `rate_limit`: 429 response
- `api_error`: 4xx/5xx with JSON error body
- `unknown`: anything else

### Service Modules

#### Image Generation (`src/image.ts`)

```typescript
export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
  model?: string
}

export interface GenerateImageResult {
  imageUrl: string
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>
```

Maps to Minimax text-to-image API.

#### Text Generation (`src/text.ts`)

```typescript
export interface GenerateTextOptions {
  systemPrompt?: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface GenerateTextResult {
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}

export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult>
```

Maps to Minimax text generation API.

#### Music Generation (`src/music.ts`)

```typescript
export interface GenerateMusicOptions {
  style?: string
  mood?: string
  lyrics?: string
  duration?: number
}

export interface GenerateMusicResult {
  audioUrl: string
}

export async function generateMusic(options: GenerateMusicOptions): Promise<GenerateMusicResult>
```

Stubbed/reserved for future Minimax music API integration.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MINIMAX_API_KEY` | Yes | Minimax API key |
| `MINIMAX_BASE_URL` | No | Override base URL (default: `https://api.minimaxi.com`) |
| `MINIMAX_TIMEOUT_MS` | No | Request timeout in ms (default: 30000) |
| `MINIMAX_MAX_RETRIES` | No | Max retry attempts (default: 3) |

## Testing Strategy

- **Framework**: Vitest (consistent with monorepo)
- **Mocking**: Global `fetch` mock via `vi.fn()`
- **Coverage targets**:
  - Success paths for all three services
  - Network error → retry → success
  - Network error → retry exhaustion → `MinimaxError`
  - Timeout → `MinimaxError('timeout')`
  - 429 → `MinimaxError('rate_limit')`
  - 4xx/5xx → `MinimaxError('api_error')` with parsed body

## Acceptance Criteria

- [ ] `packages/ai` builds and type-checks cleanly
- [ ] Business code imports only from `@kiyo/ai`, never touches Minimax details
- [ ] `MINIMAX_API_KEY` injected via env, no hardcoded keys
- [ ] All `MinimaxError` instances carry `code`, `message`, and optional `statusCode`
- [ ] Unit tests cover success + failure + retry + timeout paths
- [ ] `generateMusic` returns a typed stub/error indicating "not yet implemented"
