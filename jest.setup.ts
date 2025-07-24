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

// Mock setImmediate for environments where it's not available
if (typeof setImmediate === 'undefined') {
  global.setImmediate = ((fn: Function, ...args: any[]) => {
    return setTimeout(fn, 0, ...args)
  }) as any
}

// Mock clearImmediate for environments where it's not available
if (typeof clearImmediate === 'undefined') {
  global.clearImmediate = ((id: any) => {
    return clearTimeout(id)
  }) as any
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

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((field, value) => ({ type: 'eq', field, value })),
  and: jest.fn((...conditions) => ({ type: 'and', conditions })),
  or: jest.fn((...conditions) => ({ type: 'or', conditions })),
  desc: jest.fn((field) => ({ type: 'desc', field })),
  asc: jest.fn((field) => ({ type: 'asc', field })),
  gte: jest.fn((field, value) => ({ type: 'gte', field, value })),
  lte: jest.fn((field, value) => ({ type: 'lte', field, value })),
  like: jest.fn((field, value) => ({ type: 'like', field, value })),
  inArray: jest.fn((field, values) => ({ type: 'inArray', field, values })),
  sql: jest.fn(),
  relations: jest.fn(() => ({})),
}))

// Polyfill fetch for tests
if (typeof fetch === 'undefined') {
  const nodeFetch = require('node-fetch')
  global.fetch = nodeFetch.default || nodeFetch
  global.Response = nodeFetch.Response
  global.Request = nodeFetch.Request
  global.Headers = nodeFetch.Headers
}

// Mock db/client to match what routes import
jest.mock('@/lib/db/client', () => {
  const mockDb = require('@/lib/db').db
  return { db: mockDb }
})

// Mock the database client to prevent actual connections
jest.mock('postgres', () => {
  return jest.fn(() => {
    const mockClient = () => ({
      then: jest.fn(),
      catch: jest.fn(),
      finally: jest.fn(),
    })
    mockClient.unsafe = jest.fn()
    mockClient.begin = jest.fn()
    mockClient.end = jest.fn()
    mockClient.file = jest.fn()
    mockClient.notify = jest.fn()
    mockClient.listen = jest.fn()
    mockClient.unlisten = jest.fn()
    mockClient.options = {}
    mockClient.types = {
      parsers: {}
    }
    return mockClient
  })
})

// Mock drizzle-orm to prevent database operations
jest.mock('drizzle-orm/postgres-js', () => {
  // Create a comprehensive thenable mock chain that supports all methods
  const createThenable = (value = []) => {
    const thenable = {
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return thenable
  }
  
  const createMockQueryChain = (value = []) => {
    const chain = {
      from: jest.fn(() => createMockQueryChain(value)),
      where: jest.fn(() => createMockQueryChain(value)),
      orderBy: jest.fn(() => createMockQueryChain(value)),
      limit: jest.fn(() => createThenable(value)),
      innerJoin: jest.fn(() => createMockQueryChain(value)),
      leftJoin: jest.fn(() => createMockQueryChain(value)),
      groupBy: jest.fn(() => createMockQueryChain(value)),
      having: jest.fn(() => createMockQueryChain(value)),
      offset: jest.fn(() => createMockQueryChain(value)),
      // Make the chain itself thenable so it can be awaited at any point
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  const createMockInsertChain = (value = []) => {
    const chain = {
      values: jest.fn(() => createMockInsertChain(value)),
      returning: jest.fn(() => createThenable(value)),
      onConflictDoUpdate: jest.fn(() => createMockInsertChain(value)),
      onConflictDoNothing: jest.fn(() => createThenable(value)),
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  const createMockUpdateChain = (value = []) => {
    const chain = {
      set: jest.fn(() => createMockUpdateChain(value)),
      where: jest.fn(() => createMockUpdateChain(value)),
      returning: jest.fn(() => createThenable(value)),
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  const createMockDeleteChain = () => {
    const chain = {
      where: jest.fn(() => createThenable()),
      then: jest.fn((resolve) => resolve()),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  return {
    drizzle: jest.fn(() => ({
      select: jest.fn(() => createMockQueryChain([])),
      insert: jest.fn(() => createMockInsertChain([])),
      update: jest.fn(() => createMockUpdateChain([])),
      delete: jest.fn(() => createMockDeleteChain()),
      transaction: jest.fn(),
      query: {},
    }))
  }
})


// Set DATABASE_URL to prevent connection attempts
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock'

// Mock database client and schema
jest.mock('@/lib/db', () => {
  // Create a comprehensive thenable mock chain that supports all methods
  const createThenable = (value = []) => {
    const thenable = {
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return thenable
  }
  
  const createMockQueryChain = (value = []) => {
    const chain = {
      from: jest.fn(() => createMockQueryChain(value)),
      where: jest.fn(() => createMockQueryChain(value)),
      orderBy: jest.fn(() => createMockQueryChain(value)),
      limit: jest.fn(() => createMockQueryChain(value)),
      innerJoin: jest.fn(() => createMockQueryChain(value)),
      leftJoin: jest.fn(() => createMockQueryChain(value)),
      groupBy: jest.fn(() => createMockQueryChain(value)),
      having: jest.fn(() => createMockQueryChain(value)),
      offset: jest.fn(() => createMockQueryChain(value)),
      // Make the chain itself thenable so it can be awaited at any point
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  const createMockInsertChain = (value = []) => {
    const chain = {
      values: jest.fn(() => createMockInsertChain(value)),
      returning: jest.fn(() => createThenable(value)),
      onConflictDoUpdate: jest.fn(() => createMockInsertChain(value)),
      onConflictDoNothing: jest.fn(() => createThenable(value)),
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  const createMockUpdateChain = (value = []) => {
    const chain = {
      set: jest.fn(() => createMockUpdateChain(value)),
      where: jest.fn(() => createMockUpdateChain(value)),
      returning: jest.fn(() => createThenable(value)),
      then: jest.fn((resolve) => resolve(value)),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  const createMockDeleteChain = () => {
    const chain = {
      where: jest.fn(() => createThenable()),
      then: jest.fn((resolve) => resolve()),
      catch: jest.fn(),
      finally: jest.fn(),
    }
    return chain
  }
  
  return {
    db: {
      select: jest.fn(() => createMockQueryChain([])),
      insert: jest.fn(() => createMockInsertChain([])),
      update: jest.fn(() => createMockUpdateChain([])),
      delete: jest.fn(() => createMockDeleteChain()),
      transaction: jest.fn((callback) => {
        // Simple transaction mock that just executes the callback
        const tx = {
          select: jest.fn(() => createMockQueryChain([])),
          insert: jest.fn(() => createMockInsertChain([])),
          update: jest.fn(() => createMockUpdateChain([])),
          delete: jest.fn(() => createMockDeleteChain()),
        }
        return Promise.resolve(callback(tx))
      }),
      query: {
        tabs: {
          findFirst: jest.fn(() => Promise.resolve(null)),
          findMany: jest.fn(() => Promise.resolve([])),
        },
        lineItems: {
          findFirst: jest.fn(() => Promise.resolve(null)),
          findMany: jest.fn(() => Promise.resolve([])),
        },
        billingGroups: {
          findFirst: jest.fn(() => Promise.resolve(null)),
          findMany: jest.fn(() => Promise.resolve([])),
        },
      },
    },
    // Mock schema tables with more complete structure
    tabs: { 
      id: 'id', 
      name: 'name', 
      organizationId: 'organizationId',
      totalAmount: 'totalAmount',
      status: 'status',
      createdAt: 'createdAt'
    },
    lineItems: { 
      id: 'id', 
      tabId: 'tabId', 
      billingGroupId: 'billingGroupId',
      description: 'description',
      quantity: 'quantity',
      unitPrice: 'unitPrice',
      total: 'total'
    },
    billingGroups: { 
      id: 'id', 
      tabId: 'tabId',
      name: 'name',
      groupType: 'groupType',
      status: 'status',
      payerEmail: 'payerEmail',
      payerOrganizationId: 'payerOrganizationId',
      creditLimit: 'creditLimit',
      currentBalance: 'currentBalance',
      depositAmount: 'depositAmount',
      depositApplied: 'depositApplied',
      createdAt: 'createdAt'
    },
    organizations: { 
      id: 'id',
      name: 'name'
    },
    payments: {
      id: 'id',
      status: 'status'
    },
    // Mock drizzle helper functions
    eq: jest.fn((col, val) => ({ type: 'eq', column: col, value: val })),
    and: jest.fn((...conditions) => ({ type: 'and', conditions })),
    or: jest.fn((...conditions) => ({ type: 'or', conditions })),
    desc: jest.fn((col) => ({ type: 'desc', column: col })),
    asc: jest.fn((col) => ({ type: 'asc', column: col })),
    sql: jest.fn((strings, ...values) => ({ type: 'sql', strings, values })),
    isNull: jest.fn((col) => ({ type: 'isNull', column: col })),
    isNotNull: jest.fn((col) => ({ type: 'isNotNull', column: col })),
  }
})

// Mock withApiAuth for all tests
jest.mock('@/lib/api/middleware', () => ({
  withApiAuth: jest.fn((handler) => {
    return async (req: any, context: any, params: any) => {
      const mockApiContext = {
        organizationId: 'org_123',
        apiKeyId: 'key_123', 
        requestId: 'req_123',
        environment: 'test' as const
      }
      return handler(req, mockApiContext, params)
    }
  }),
  parseJsonBody: jest.fn(async (req: any) => {
    // Simple implementation for tests
    if (req.body) return req.body
    if (req.json && typeof req.json === 'function') return req.json()
    return {}
  })
}))

// Mock NextResponse for API route tests
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url, init) => {
    return {
      url,
      method: init?.method || 'GET',
      headers: new Headers(init?.headers || {}),
      json: async () => init?.body ? JSON.parse(init.body) : {},
      text: async () => init?.body || '',
    }
  }),
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      headers: new Headers(init?.headers || {}),
      json: async () => data,
      ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
    })),
  }
}))

// Mock organization middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((request, handler) => {
    // Handle both patterns:
    // 1. withOrganizationAuth(handler) - returns a wrapped handler
    // 2. withOrganizationAuth(request, handler) - executes immediately
    
    if (typeof request === 'function') {
      // Pattern 1: request is actually the handler
      const actualHandler = request
      return async (req: any, params: any) => {
        // Check for API key header
        const apiKey = req.headers?.get?.('X-API-Key') || req.headers?.['X-API-Key']
        if (!apiKey) {
          return {
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
            ok: false,
          }
        }
        
        const mockOrgContext = {
          organizationId: 'org_123',
          userId: 'user_123'
        }
        return actualHandler(req, mockOrgContext, params)
      }
    } else {
      // Pattern 2: request is the request object, handler is the second param
      // Return an async function that handles the request
      return (async () => {
        // Check for API key header
        const apiKey = request.headers?.get?.('X-API-Key') || request.headers?.['X-API-Key']
        if (!apiKey) {
          return {
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
            ok: false,
          }
        }
        
        const mockOrgContext = {
          organizationId: 'org_123',
          userId: 'user_123'
        }
        
        try {
          return await handler(request, mockOrgContext)
      } catch (error: any) {
        // Handle errors like the real middleware does
        if (error.name === 'ValidationError') {
          return {
            status: 400,
            json: async () => ({ error: { message: error.message, details: error.details || error.issues } }),
            ok: false,
          }
        }
        if (error.name === 'NotFoundError') {
          return {
            status: 404,
            json: async () => ({ error: error.message }),
            ok: false,
          }
        }
        if (error.name === 'ConflictError') {
          return {
            status: 409,
            json: async () => ({ error: error.message }),
            ok: false,
          }
        }
        if (error.name === 'DatabaseError') {
          return {
            status: 500,
            json: async () => ({ error: error.message }),
            ok: false,
          }
        }
        // Default error response
        return {
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
          ok: false,
        }
      }
      })()
    }
  })
}))

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