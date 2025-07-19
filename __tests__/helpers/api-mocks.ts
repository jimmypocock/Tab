// Centralized API test mocks
export const setupApiMocks = () => {
  // Mock database
  jest.mock('@/lib/db/client', () => ({
    db: {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
      execute: jest.fn().mockResolvedValue({ length: 0 }),
      eq: jest.fn(),
      and: jest.fn(),
      or: jest.fn(),
      query: {
        tabs: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        merchants: {
          findFirst: jest.fn(),
        },
      },
    },
  }))

  // Mock bcrypt
  jest.mock('bcryptjs', () => ({
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('$2a$10$hashedvalue'),
  }))

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
    withRedisCache: jest.fn((key, ttl, fn) => fn()),
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
    },
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

// Helper to setup API key validation
export const mockApiKeyValidation = (merchantId: string = 'merchant_123') => {
  const db = require('@/lib/db/client').db
  
  db.select.mockReturnThis()
  db.from.mockReturnThis()
  db.where.mockReturnThis()
  db.leftJoin.mockResolvedValue([{
    id: 'key_123',
    key: '$2a$10$hashedkey',
    merchantId: merchantId,
    active: true,
    merchant: { 
      id: merchantId,
      businessName: 'Test Business',
      userId: 'user_123'
    }
  }])
}

// Helper to mock successful tab creation
export const mockTabCreation = (tabData: any = {}) => {
  const db = require('@/lib/db/client').db
  
  const defaultTab = {
    id: 'tab_123',
    merchantId: 'merchant_123',
    customerEmail: 'test@example.com',
    totalAmount: '100.00',
    paidAmount: '0.00',
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...tabData,
  }
  
  db.transaction.mockImplementation(async (fn: any) => {
    const tx = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([defaultTab]),
    }
    return fn(tx)
  })
  
  return defaultTab
}