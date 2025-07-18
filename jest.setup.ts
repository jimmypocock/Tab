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