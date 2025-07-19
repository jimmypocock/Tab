import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:1235'
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock window.matchMedia only in jsdom environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock Web APIs for Node.js environment
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input: string): Uint8Array {
      return Buffer.from(input, 'utf-8')
    }
    encodeInto(input: string, dest: Uint8Array): TextEncoderEncodeIntoResult {
      const encoded = Buffer.from(input, 'utf-8')
      const written = Math.min(encoded.length, dest.length)
      encoded.copy(dest, 0, 0, written)
      return { read: input.length, written }
    }
    get encoding(): string {
      return 'utf-8'
    }
  } as any
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(input: Uint8Array): string {
      return Buffer.from(input).toString('utf-8')
    }
    get encoding(): string {
      return 'utf-8'
    }
    get fatal(): boolean {
      return false
    }
    get ignoreBOM(): boolean {
      return false
    }
  } as any
}

if (typeof Response === 'undefined') {
  global.Response = class Response {
    ok: boolean
    status: number
    statusText: string
    headers: Headers
    body: any
    
    constructor(body?: any, init?: any) {
      this.body = body
      this.ok = (init?.status || 200) >= 200 && (init?.status || 200) < 300
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Headers(init?.headers || {})
    }
    
    text() { 
      return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body || ''))
    }
    
    json() { 
      return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body || {})
    }
  } as any
}

// Mock Next.js Request/Response for tests
if (typeof Request === 'undefined') {
  global.Request = class Request {
    url: string
    method: string
    headers: Headers
    body: any
    
    constructor(url: string, init?: any) {
      this.url = url
      this.method = init?.method || 'GET'
      this.headers = new Headers(init?.headers || {})
      this.body = init?.body
    }
    
    text() { 
      return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body || ''))
    }
    
    json() { 
      return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body || {})
    }
  } as any
}

// Mock Headers
if (typeof Headers === 'undefined') {
  global.Headers = class Headers {
    private headers: Map<string, string>
    
    constructor(init?: any) {
      this.headers = new Map(Object.entries(init || {}))
    }
    
    get(name: string) {
      return this.headers.get(name.toLowerCase()) || null
    }
    
    set(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value)
    }
  } as any
}

// Mock TransformStream for MSW
if (typeof TransformStream === 'undefined') {
  global.TransformStream = class TransformStream {
    readable: any
    writable: any
    
    constructor() {
      this.readable = {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      }
      this.writable = {
        getWriter: () => ({
          write: () => Promise.resolve(),
          close: () => Promise.resolve(),
          releaseLock: () => {},
        }),
      }
    }
  } as any
}

// Mock BroadcastChannel for MSW
if (typeof BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class BroadcastChannel {
    name: string
    onmessage: ((event: MessageEvent) => void) | null = null
    onmessageerror: ((event: MessageEvent) => void) | null = null
    
    constructor(name: string) {
      this.name = name
    }
    
    postMessage(_message: any): void {
      // Mock implementation
    }
    
    close(): void {
      // Mock implementation
    }
    
    addEventListener(_type: string, _listener: any): void {
      // Mock implementation
    }
    
    removeEventListener(_type: string, _listener: any): void {
      // Mock implementation
    }
    
    dispatchEvent(_event: Event): boolean {
      return true
    }
  } as any
}

// Mock crypto for Node.js environment
const crypto = require('crypto')
if (!global.crypto) {
  global.crypto = {
    randomBytes: (size: number) => crypto.randomBytes(size),
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''))
        hash.update(Buffer.from(data))
        return hash.digest()
      }
    },
    getRandomValues: (arr: Uint8Array) => {
      const bytes = crypto.randomBytes(arr.length)
      arr.set(bytes)
      return arr
    }
  } as any
}

// Mock clipboard API for jsdom environment
if (typeof window !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: jest.fn(),
      readText: jest.fn(),
    },
    configurable: true,
  })
}

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Polyfill fetch for tests
if (typeof fetch === 'undefined') {
  const nodeFetch = require('node-fetch')
  global.fetch = nodeFetch.default || nodeFetch
  global.Response = nodeFetch.Response
  global.Request = nodeFetch.Request
  global.Headers = nodeFetch.Headers
}

// Setup MSW if available
try {
  const { server } = require('./__tests__/mocks/server')
  
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'warn',
    })
  })
  
  afterEach(() => {
    server.resetHandlers()
  })
  
  afterAll(() => {
    server.close()
  })
} catch (e) {
  // MSW not available in this test
}