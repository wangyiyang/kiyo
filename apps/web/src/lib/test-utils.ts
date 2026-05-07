import { vi } from 'vitest'

export function createMockSupabaseClient(options: { userId?: string } = {}) {
  const dataStore: Record<string, any[]> = {
    songs: [],
    albums: [],
    album_songs: [],
  }

  let currentTable = ''
  let currentFilters: Array<(item: any) => boolean> = []
  let currentSelect = '*'
  let currentOrder: { column: string; ascending: boolean } | null = null
  let currentSingle = false
  let currentLimit: number | null = null

  const reset = () => {
    currentTable = ''
    currentFilters = []
    currentSelect = '*'
    currentOrder = null
    currentSingle = false
    currentLimit = null
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
    if (currentSingle) {
      result = result[0] ?? null
    }
    return result
  }

  const chain = {
    select: (columns = '*') => {
      currentSelect = columns
      return chain
    },
    insert: (values: any | any[]) => {
      const arr = Array.isArray(values) ? values : [values]
      arr.forEach((v) => dataStore[currentTable].push({ ...v, id: v.id || `mock-${Math.random().toString(36).slice(2)}` }))
      return {
        data: arr.length === 1 ? arr[0] : arr,
        error: null,
        select: (columns = '*') => ({
          single: () => ({
            then: async (resolve: any) => {
              const result = arr.length === 1 ? arr[0] : arr
              reset()
              return resolve({ data: result, error: null })
            },
          }),
          then: async (resolve: any) => {
            reset()
            return resolve({ data: arr, error: null })
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
      const before = dataStore[currentTable].length
      dataStore[currentTable] = dataStore[currentTable].filter((item) => !currentFilters.every((f) => f(item)))
      const deleted = before - dataStore[currentTable].length
      return {
        data: deleted > 0 ? { count: deleted } : null,
        error: null,
        eq: (column: string, value: any) => {
          currentFilters.push((item) => item[column] === value)
          return chain
        },
      }
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

  return { from, auth, dataStore, chain }
}
