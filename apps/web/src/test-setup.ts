import '@testing-library/jest-dom/vitest'

// Polyfill ResizeObserver for jsdom environment (Radix UI components need it)
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Polyfill Blob.prototype.arrayBuffer for jsdom environment
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) resolve(reader.result as ArrayBuffer)
        else reject(new Error('Failed to read blob as array buffer'))
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(this)
    })
  }
}
