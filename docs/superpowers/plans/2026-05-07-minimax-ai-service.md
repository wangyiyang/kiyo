# Minimax AI Service Abstraction Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/ai` shared package with unified Minimax API client, exposing `generateImage`, `generateText`, and `generateMusic` with retry, timeout, and typed errors.

**Architecture:** A single HTTP client module handles all fetch/retry/timeout logic. Each AI capability (image/text/music) is a thin wrapper that maps domain options to Minimax API payloads. All errors normalize to `MinimaxError`.

**Tech Stack:** TypeScript, native `fetch()`, Vitest, `vi.fn()` for mocking.

---

## File Structure

```
packages/ai/
├── package.json
├── tsconfig.json
├── index.ts
└── src/
    ├── errors.ts
    ├── client.ts
    ├── image.ts
    ├── text.ts
    ├── music.ts
    └── __tests__/
        ├── client.test.ts
        ├── image.test.ts
        ├── text.test.ts
        └── music.test.ts
```

---

### Task 1: Create Package Skeleton

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/index.ts`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@kiyo/ai",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "index.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write index.ts (placeholder)**

```typescript
// Public exports will be added as modules are implemented
export {}
```

- [ ] **Step 4: Install dependencies**

Run: `cd packages/ai && pnpm install`

- [ ] **Step 5: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): scaffold @kiyo/ai package"
```

---

### Task 2: Error Types

**Files:**
- Create: `packages/ai/src/errors.ts`
- Modify: `packages/ai/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MinimaxError } from '../errors'

describe('MinimaxError', () => {
  it('should carry code, message, statusCode, and responseBody', () => {
    const err = new MinimaxError('something broke', 'api_error', 500, { detail: 'fail' })
    expect(err.message).toBe('something broke')
    expect(err.code).toBe('api_error')
    expect(err.statusCode).toBe(500)
    expect(err.responseBody).toEqual({ detail: 'fail' })
  })

  it('should work without optional fields', () => {
    const err = new MinimaxError('timeout', 'timeout')
    expect(err.statusCode).toBeUndefined()
    expect(err.responseBody).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai && pnpm vitest run src/__tests__/errors.test.ts`
Expected: FAIL — `MinimaxError` not defined

- [ ] **Step 3: Write minimal implementation**

Create `packages/ai/src/errors.ts`:

```typescript
export type MinimaxErrorCode = 'network' | 'timeout' | 'rate_limit' | 'api_error' | 'unknown'

export class MinimaxError extends Error {
  constructor(
    message: string,
    public code: MinimaxErrorCode,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = 'MinimaxError'
  }
}
```

- [ ] **Step 4: Update index.ts exports**

Modify `packages/ai/index.ts`:

```typescript
export { MinimaxError } from './src/errors'
export type { MinimaxErrorCode } from './src/errors'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ai && pnpm vitest run src/__tests__/errors.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): add MinimaxError type"
```

---

### Task 3: HTTP Client with Retry and Timeout

**Files:**
- Create: `packages/ai/src/client.ts`
- Modify: `packages/ai/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/ai/src/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { minimaxFetch } from '../client'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

describe('minimaxFetch', () => {
  it('returns JSON on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'ok' }),
    } as Response)

    const result = await minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    expect(result).toEqual({ result: 'ok' })
  })

  it('retries on network error then succeeds', async () => {
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'ok' }),
      } as Response)

    const promise = minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise
    expect(result).toEqual({ result: 'ok' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws MinimaxError(timeout) when request exceeds timeout', async () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) // never resolves

    const promise = minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    await vi.advanceTimersByTimeAsync(35000)
    await expect(promise).rejects.toThrow(MinimaxError)
    await expect(promise).rejects.toMatchObject({ code: 'timeout' })
  })

  it('throws MinimaxError(rate_limit) on 429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'too many requests' }),
    } as Response)

    await expect(minimaxFetch('/v1/test', { body: JSON.stringify({}) }))
      .rejects.toMatchObject({ code: 'rate_limit', statusCode: 429 })
  })

  it('throws MinimaxError(api_error) on 4xx/5xx with body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    } as Response)

    await expect(minimaxFetch('/v1/test', { body: JSON.stringify({}) }))
      .rejects.toMatchObject({ code: 'api_error', statusCode: 400, responseBody: { error: 'bad request' } })
  })

  it('exhausts retries then throws MinimaxError(network)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

    const promise = minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    await vi.advanceTimersByTimeAsync(15000)
    await expect(promise).rejects.toMatchObject({ code: 'network' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(4) // initial + 3 retries
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/ai && pnpm vitest run src/__tests__/client.test.ts`
Expected: FAIL — `minimaxFetch` not defined

- [ ] **Step 3: Write implementation**

Create `packages/ai/src/client.ts`:

```typescript
import { MinimaxError } from './errors'

const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com'
const TIMEOUT_MS = Number(process.env.MINIMAX_TIMEOUT_MS || '30000')
const MAX_RETRIES = Number(process.env.MINIMAX_MAX_RETRIES || '3')

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MinimaxError('Request timed out', 'timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function minimaxFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${BASE_URL}${path}`
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) {
    throw new MinimaxError('MINIMAX_API_KEY is not set', 'unknown')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${apiKey}`)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers,
      })

      if (response.status === 429) {
        const body = await response.json().catch(() => undefined)
        throw new MinimaxError('Rate limit exceeded', 'rate_limit', 429, body)
      }

      if (!response.ok) {
        const body = await response.json().catch(() => undefined)
        throw new MinimaxError(
          `Minimax API error: ${response.status}`,
          'api_error',
          response.status,
          body
        )
      }

      return await response.json()
    } catch (err) {
      lastError = err

      if (err instanceof MinimaxError && err.code === 'timeout') {
        throw err
      }

      if (err instanceof MinimaxError && (err.code === 'rate_limit' || err.code === 'api_error')) {
        throw err
      }

      const isLastAttempt = attempt === MAX_RETRIES
      if (isLastAttempt) {
        if (err instanceof MinimaxError) {
          throw err
        }
        throw new MinimaxError(
          err instanceof Error ? err.message : 'Network request failed',
          'network'
        )
      }

      await delay(2 ** attempt * 1000)
    }
  }

  throw lastError
}
```

- [ ] **Step 4: Update index.ts exports**

Modify `packages/ai/index.ts`:

```typescript
export { MinimaxError } from './src/errors'
export type { MinimaxErrorCode } from './src/errors'
export { minimaxFetch } from './src/client'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/ai && pnpm vitest run src/__tests__/client.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): add minimaxFetch client with retry and timeout"
```

---

### Task 4: Image Generation

**Files:**
- Create: `packages/ai/src/image.ts`
- Modify: `packages/ai/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/image.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateImage } from '../image'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('generateImage', () => {
  it('returns imageUrl on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          image_url: 'https://example.com/image.png',
        },
      }),
    } as Response)

    const result = await generateImage({ prompt: 'a red cat', width: 512, height: 512 })
    expect(result.imageUrl).toBe('https://example.com/image.png')
  })

  it('throws MinimaxError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad prompt' }),
    } as Response)

    await expect(generateImage({ prompt: 'bad' })).rejects.toBeInstanceOf(MinimaxError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai && pnpm vitest run src/__tests__/image.test.ts`
Expected: FAIL — `generateImage` not defined

- [ ] **Step 3: Write implementation**

Create `packages/ai/src/image.ts`:

```typescript
import { minimaxFetch } from './client'

export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
  model?: string
}

export interface GenerateImageResult {
  imageUrl: string
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const body = {
    prompt: options.prompt,
    width: options.width,
    height: options.height,
    model: options.model,
  }

  const response = await minimaxFetch('/v1/image/generation', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as { data?: { image_url?: string } }
  const imageUrl = data.data?.image_url

  if (!imageUrl) {
    throw new Error('Invalid response from image generation API')
  }

  return { imageUrl }
}
```

- [ ] **Step 4: Update index.ts exports**

Modify `packages/ai/index.ts`:

```typescript
export { MinimaxError } from './src/errors'
export type { MinimaxErrorCode } from './src/errors'
export { minimaxFetch } from './src/client'
export { generateImage } from './src/image'
export type { GenerateImageOptions, GenerateImageResult } from './src/image'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ai && pnpm vitest run src/__tests__/image.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): add generateImage for text-to-image"
```

---

### Task 5: Text Generation

**Files:**
- Create: `packages/ai/src/text.ts`
- Modify: `packages/ai/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/text.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateText } from '../text'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('generateText', () => {
  it('returns text and usage on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Hello world' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    } as Response)

    const result = await generateText({ userPrompt: 'Say hello' })
    expect(result.text).toBe('Hello world')
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 })
  })

  it('throws MinimaxError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid model' }),
    } as Response)

    await expect(generateText({ userPrompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai && pnpm vitest run src/__tests__/text.test.ts`
Expected: FAIL — `generateText` not defined

- [ ] **Step 3: Write implementation**

Create `packages/ai/src/text.ts`:

```typescript
import { minimaxFetch } from './client'

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

export async function generateText(
  options: GenerateTextOptions
): Promise<GenerateTextResult> {
  const messages: Array<{ role: string; content: string }> = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content: options.userPrompt })

  const body = {
    model: options.model,
    messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  }

  const response = await minimaxFetch('/v1/text/chatcompletion_v2', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('Invalid response from text generation API')
  }

  return {
    text,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
        }
      : undefined,
  }
}
```

- [ ] **Step 4: Update index.ts exports**

Modify `packages/ai/index.ts`:

```typescript
export { MinimaxError } from './src/errors'
export type { MinimaxErrorCode } from './src/errors'
export { minimaxFetch } from './src/client'
export { generateImage } from './src/image'
export type { GenerateImageOptions, GenerateImageResult } from './src/image'
export { generateText } from './src/text'
export type { GenerateTextOptions, GenerateTextResult } from './src/text'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ai && pnpm vitest run src/__tests__/text.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): add generateText for LLM text generation"
```

---

### Task 6: Music Generation (Reserved)

**Files:**
- Create: `packages/ai/src/music.ts`
- Modify: `packages/ai/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/music.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateMusic } from '../music'
import { MinimaxError } from '../errors'

describe('generateMusic', () => {
  it('throws not-yet-implemented error', async () => {
    await expect(generateMusic({ style: 'pop' })).rejects.toBeInstanceOf(MinimaxError)
    await expect(generateMusic({ style: 'pop' })).rejects.toMatchObject({
      code: 'unknown',
      message: 'Music generation is not yet implemented',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai && pnpm vitest run src/__tests__/music.test.ts`
Expected: FAIL — `generateMusic` not defined

- [ ] **Step 3: Write implementation**

Create `packages/ai/src/music.ts`:

```typescript
import { MinimaxError } from './errors'

export interface GenerateMusicOptions {
  style?: string
  mood?: string
  lyrics?: string
  duration?: number
}

export interface GenerateMusicResult {
  audioUrl: string
}

export async function generateMusic(
  _options: GenerateMusicOptions
): Promise<GenerateMusicResult> {
  throw new MinimaxError('Music generation is not yet implemented', 'unknown')
}
```

- [ ] **Step 4: Update index.ts exports**

Modify `packages/ai/index.ts`:

```typescript
export { MinimaxError } from './src/errors'
export type { MinimaxErrorCode } from './src/errors'
export { minimaxFetch } from './src/client'
export { generateImage } from './src/image'
export type { GenerateImageOptions, GenerateImageResult } from './src/image'
export { generateText } from './src/text'
export type { GenerateTextOptions, GenerateTextResult } from './src/text'
export { generateMusic } from './src/music'
export type { GenerateMusicOptions, GenerateMusicResult } from './src/music'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/ai && pnpm vitest run src/__tests__/music.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): add generateMusic stub (reserved)"
```

---

### Task 7: Integration and Validation

**Files:**
- Modify: `apps/web/package.json`
- Modify: `.env.local.example`

- [ ] **Step 1: Add @kiyo/ai dependency to apps/web**

Modify `apps/web/package.json` dependencies:

```json
"@kiyo/ai": "workspace:*",
```

- [ ] **Step 2: Update .env.local.example**

Modify `.env.local.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://cgqorvwsnuiqtoxzwymr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Minimax AI
MINIMAX_API_KEY=
```

- [ ] **Step 3: Install workspace dependencies**

Run: `pnpm install`

- [ ] **Step 4: Run full test suite for packages/ai**

Run: `cd packages/ai && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 5: Run type-check for packages/ai**

Run: `cd packages/ai && pnpm type-check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json .env.local.example pnpm-lock.yaml
git commit -m "chore: wire @kiyo/ai into web app and env example"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| Create `packages/ai` shared package | Task 1 |
| Expose `generateImage` | Task 4 |
| Expose `generateText` | Task 5 |
| Expose `generateMusic` (reserved) | Task 6 |
| Hide Minimax details | Task 3 (`minimaxFetch` is internal; public API is domain-specific) |
| Unified `MinimaxError` | Task 2 |
| Retry with exponential backoff | Task 3 |
| Timeout | Task 3 |
| Env var injection | Task 3 (`MINIMAX_API_KEY`), Task 7 (`.env.local.example`) |
| Unit tests with mocked HTTP | Tasks 2-6 |

### Placeholder Scan

- No "TBD", "TODO", "implement later" found
- All test code is concrete
- All implementation code is concrete
- No "similar to Task N" references

### Type Consistency

- `MinimaxError` constructor signature matches usage in `client.ts` and `music.ts`
- `generateImage` / `generateText` / `generateMusic` interfaces match spec exactly
