import { jest } from '@jest/globals'

// Comprehensive mock setup for all dependencies
export function setupMocks() {
  // Mock drizzle-orm
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

  // Mock drizzle-orm/pg-core
  jest.mock('drizzle-orm/pg-core', () => ({
    pgTable: jest.fn(() => ({})),
    pgEnum: jest.fn(() => ({})),
    serial: jest.fn(() => ({})),
    varchar: jest.fn(() => ({})),
    decimal: jest.fn(() => ({})),
    boolean: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    uuid: jest.fn(() => ({})),
    integer: jest.fn(() => ({})),
    text: jest.fn(() => ({})),
    primaryKey: jest.fn(() => ({})),
    index: jest.fn(() => ({})),
  }))

  // Mock database client
  jest.mock('@/lib/db/client', () => {
    const mockDb = {
      transaction: jest.fn(),
      query: {
        tabs: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        apiKeys: {
          findFirst: jest.fn(),
        },
        merchants: {
          findFirst: jest.fn(),
        },
        lineItems: {
          findMany: jest.fn(),
        },
        payments: {
          findMany: jest.fn(),
        },
      },
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      select: jest.fn(),
      from: jest.fn(),
      where: jest.fn(),
      values: jest.fn(),
      set: jest.fn(),
      returning: jest.fn(),
      leftJoin: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
    }
    
    // Make chainable
    Object.keys(mockDb).forEach(key => {
      if (typeof mockDb[key as keyof typeof mockDb] === 'function' && key !== 'transaction' && key !== 'query') {
        (mockDb[key as keyof typeof mockDb] as jest.Mock).mockReturnThis()
      }
    })
    
    return { db: mockDb }
  })

  // Mock schema
  jest.mock('@/lib/db/schema', () => ({
    merchants: {},
    apiKeys: {},
    tabs: {},
    lineItems: {},
    payments: {},
    invoices: {},
    merchantsRelations: {},
    apiKeysRelations: {},
    tabsRelations: {},
    lineItemsRelations: {},
    paymentsRelations: {},
    invoicesRelations: {},
  }))

  // Mock bcryptjs
  jest.mock('bcryptjs', () => ({
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('$2a$10$hashedvalue'),
  }))

  // Mock Stripe
  jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/test',
          }),
          retrieve: jest.fn(),
        },
      },
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test_123',
          client_secret: 'pi_test_secret',
        }),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
      webhookEndpoints: {
        create: jest.fn(),
        list: jest.fn().mockResolvedValue({ data: [] }),
        del: jest.fn(),
      },
    }))
  })

  // Mock Redis
  jest.mock('@/lib/redis/client', () => ({
    redis: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
    },
  }))

  // Mock cache
  jest.mock('@/lib/cache', () => ({
    withRedisCache: jest.fn(async (key, fn) => fn()),
    CacheKeys: {
      apiKey: jest.fn((hash) => `api_key:${hash}`),
      merchant: jest.fn((id) => `merchant:${id}`),
      tab: jest.fn((id) => `tab:${id}`),
      dashboardStats: jest.fn((id) => `dashboard:${id}`),
    },
  }))

  // Mock logger
  jest.mock('@/lib/logger', () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      logRequest: jest.fn(),
      logResponse: jest.fn(),
    },
  }))

  // Mock Supabase
  jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn().mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user_123' } },
          error: null,
        }),
      },
      from: jest.fn(),
    }),
  }))

  // Mock Next.js modules
  jest.mock('next/navigation', () => ({
    redirect: jest.fn(),
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    })),
    useSearchParams: jest.fn(() => new URLSearchParams()),
    usePathname: jest.fn(() => '/'),
  }))

  // Mock Next.js headers
  jest.mock('next/headers', () => ({
    headers: jest.fn(() => new Map([['x-api-key', 'test']])),
    cookies: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
    })),
  }))
}

// Reset all mocks between tests
export function resetMocks() {
  jest.clearAllMocks()
}

// Get mock implementations
export function getMocks() {
  const db = require('@/lib/db/client').db
  const bcrypt = require('bcryptjs')
  const stripe = require('stripe')
  const redis = require('@/lib/redis/client').redis
  const cache = require('@/lib/cache')
  const logger = require('@/lib/logger').logger
  
  return {
    db,
    bcrypt,
    stripe,
    redis,
    cache,
    logger,
  }
}