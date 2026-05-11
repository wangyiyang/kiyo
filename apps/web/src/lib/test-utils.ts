import { vi } from 'vitest'

export function createMockSupabaseClient(options: { userId?: string } = {}) {
  const dataStore: Record<string, any[]> = {
    songs: [],
    albums: [],
    album_songs: [],
    lyrics: [],
    generation_tasks: [],
    rate_limits: [],
  }

  let currentTable = ''
  let currentFilters: Array<(item: any) => boolean> = []
  let currentSelect = '*'
  let currentOrder: { column: string; ascending: boolean } | null = null
  let currentSingle = false
  let currentLimit: number | null = null
  let currentRange: { from: number; to: number } | null = null

  const reset = () => {
    currentTable = ''
    currentFilters = []
    currentSelect = '*'
    currentOrder = null
    currentSingle = false
    currentLimit = null
    currentRange = null
  }

  const buildResult = () => {
    let result = [...dataStore[currentTable]]
    currentFilters.forEach((f) => {
      result = result.filter(f)
    })
    if (currentOrder) {
      result.sort((a, b) => {
        const dir = currentOrder!.ascending ? 1 : -1
        return a[currentOrder!.column] > b[currentOrder!.column] ? dir : -dir
      })
    }
    if (currentLimit) {
      result = result.slice(0, currentLimit)
    }
    if (currentRange) {
      result = result.slice(currentRange.from, currentRange.to + 1)
    }
    if (currentSingle) {
      result = result[0] ?? null
    }
    return result
  }

  const chain = {
    select: (columns = '*', options?: { count?: string }) => {
      currentSelect = columns
      if (options?.count) {
        return {
          eq: (column: string, value: any) => {
            currentFilters.push((item) => item[column] === value)
            return {
              eq: (column2: string, value2: any) => {
                currentFilters.push((item) => item[column2] === value2)
                return {
                  gte: (column3: string, value3: any) => {
                    currentFilters.push((item) => item[column3] >= value3)
                    return {
                      then: async (resolve: any) => {
                        const filtered = buildResult()
                        reset()
                        return resolve({ data: null, count: filtered.length, error: null })
                      },
                    }
                  },
                }
              },
              then: async (resolve: any) => {
                const filtered = buildResult()
                reset()
                return resolve({ data: null, count: filtered.length, error: null })
              },
            }
          },
        }
      }
      return chain
    },
    insert: (values: any | any[]) => {
      const arr = Array.isArray(values) ? values : [values]
      const inserted: any[] = []
      arr.forEach((v) => {
        const item = { ...v, id: v.id || `mock-${Math.random().toString(36).slice(2)}` }
        dataStore[currentTable].push(item)
        inserted.push(item)
      })
      return {
        data: inserted.length === 1 ? inserted[0] : inserted,
        error: null,
        select: (columns = '*') => ({
          single: () => ({
            then: async (resolve: any) => {
              const result = inserted.length === 1 ? inserted[0] : inserted
              reset()
              return resolve({ data: result, error: null })
            },
          }),
          then: async (resolve: any) => {
            reset()
            return resolve({ data: inserted, error: null })
          },
        }),
      }
    },
    update: (values: any) => {
      let items = dataStore[currentTable].filter((item) => currentFilters.every((f) => f(item)))
      items.forEach((item) => Object.assign(item, values))
      return {
        data: items.length === 1 ? items[0] : items,
        error: null,
        eq: (column: string, value: any) => {
          currentFilters.push((item) => item[column] === value)
          return chain
        },
        select: (columns = '*') => ({
          single: () => ({
            then: async (resolve: any) => {
              const result = items.length === 1 ? items[0] : items
              reset()
              return resolve({ data: result, error: null })
            },
          }),
          then: async (resolve: any) => {
            reset()
            return resolve({ data: items, error: null })
          },
        }),
      }
    },
    delete: () => {
      const deleteChain = {
        data: null,
        error: null,
        eq: (column: string, value: any) => {
          currentFilters.push((item) => item[column] === value)
          return deleteChain
        },
        lt: (column: string, value: any) => {
          currentFilters.push((item) => item[column] < value)
          return deleteChain
        },
        then: async (resolve: any) => {
          const before = dataStore[currentTable].length
          dataStore[currentTable] = dataStore[currentTable].filter((item) => !currentFilters.every((f) => f(item)))
          const deleted = before - dataStore[currentTable].length
          reset()
          return resolve({ data: deleted > 0 ? { count: deleted } : null, error: null })
        },
      }
      return deleteChain
    },
    eq: (column: string, value: any) => {
      currentFilters.push((item) => item[column] === value)
      return chain
    },
    in: (column: string, values: any[]) => {
      currentFilters.push((item) => values.includes(item[column]))
      return chain
    },
    order: (column: string, { ascending = true } = {}) => {
      currentOrder = { column, ascending }
      return chain
    },
    limit: (n: number) => {
      currentLimit = n
      return chain
    },
    range: (from: number, to: number) => {
      currentRange = { from, to }
      return chain
    },
    single: () => {
      currentSingle = true
      return chain
    },
    then: async (resolve: any) => {
      const result = buildResult()
      reset()
      return resolve({ data: result, error: null })
    },
  }

  const from = (table: string) => {
    currentTable = table
    return chain
  }

  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: options.userId ? { id: options.userId } : null },
      error: null,
    }),
  }

  const uploadedFiles: { path: string; buffer: ArrayBuffer; contentType?: string }[] = []

  const storage = {
    from: (_bucket: string) => ({
      upload: vi.fn().mockImplementation((path: string, buffer: ArrayBuffer, options?: { contentType?: string }) => {
        uploadedFiles.push({ path, buffer, contentType: options?.contentType })
        return Promise.resolve({ data: { path }, error: null })
      }),
      getPublicUrl: vi.fn().mockImplementation((path: string) => ({
        data: { publicUrl: `https://mock-cdn.supabase.co/storage/v1/object/public/covers/${path}` },
      })),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://mock-cdn.supabase.co/storage/v1/object/sign/audio/mock-file.mp3?token=mock-token' },
        error: null,
      }),
    }),
  }

  const rpc = (fn: string, params?: Record<string, unknown>) => {
    if (fn === 'claim_pending_task') {
      const type = params?.task_type as string
      const pending = dataStore.generation_tasks
        .filter((t) => t.status === 'pending' && t.type === type)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const task = pending[0] ?? null
      if (task) {
        task.status = 'processing'
        task.started_at = new Date().toISOString()
      }
      return Promise.resolve({ data: task, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }

  return { from, auth, dataStore, chain, storage, uploadedFiles, rpc }
}
