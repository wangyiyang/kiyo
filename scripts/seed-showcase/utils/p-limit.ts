export function pLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = []
  let activeCount = 0

  const next = () => {
    if (queue.length === 0 || activeCount >= concurrency) return
    activeCount++
    const fn = queue.shift()!
    fn().finally(() => {
      activeCount--
      next()
    })
  }

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push(() => fn().then(resolve, reject))
      next()
    })
  }
}
