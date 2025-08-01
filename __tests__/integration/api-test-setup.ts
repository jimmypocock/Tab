/**
 * API Integration Test Setup
 * 
 * This file sets up the test environment for real API endpoint testing
 * with actual database operations and proper DI container setup.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DIContainer } from '@/lib/di/container'
import { configureDI } from '@/lib/di/config'
import { RequestContext } from '@/lib/api/request-context'

// Test environment configuration
export const TEST_CONFIG = {
  // Use test database URL or local Supabase
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_123',
  RESEND_API_KEY: process.env.RESEND_API_KEY || 're_test_123',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  TEST_API_KEY: 'tab_test_12345678901234567890123456789012',
  TEST_ORGANIZATION_ID: 'test-org-123',
  TEST_USER_ID: 'test-user-123'
} as const

/**
 * Create a test database connection
 */
export function createTestDatabase() {
  const sql = postgres(TEST_CONFIG.DATABASE_URL, {
    max: 1, // Limit connections for tests
    idle_timeout: 20,
    connect_timeout: 10,
  })
  
  return drizzle(sql, {
    logger: process.env.NODE_ENV === 'test' && process.env.DEBUG_SQL === 'true',
  })
}

/**
 * Create a test DI container with real dependencies but test configuration
 */
export function createTestDIContainer(): DIContainer {
  const container = new DIContainer()
  
  // Configure with test-specific settings
  configureDI(container, {
    database: createTestDatabase(),
    redis: createMockRedis(),
    stripe: createMockStripe(),
    logger: createTestLogger(),
    emailService: createMockEmailService(),
  })
  
  return container
}

/**
 * Create a mock Redis client for testing
 */
function createMockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    expire: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
  }
}

/**
 * Create a mock Stripe client for testing
 */
function createMockStripe() {
  return {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
          payment_status: 'unpaid'
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          payment_status: 'paid',
          amount_total: 10000
        }),
      },
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_123',
        status: 'requires_payment_method'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 10000
      }),
      confirm: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded'
      }),
    },
    webhookEndpoints: {
      create: jest.fn(),
      retrieve: jest.fn(),
    }
  }
}

/**
 * Create a test logger that captures logs for assertions
 */
function createTestLogger() {
  const logs: Array<{ level: string; message: string; meta?: any }> = []
  
  const logger = {
    info: jest.fn((message: string, meta?: any) => logs.push({ level: 'info', message, meta })),
    error: jest.fn((message: string, meta?: any) => logs.push({ level: 'error', message, meta })),
    warn: jest.fn((message: string, meta?: any) => logs.push({ level: 'warn', message, meta })),
    debug: jest.fn((message: string, meta?: any) => logs.push({ level: 'debug', message, meta })),
    getLogs: () => logs,
    clearLogs: () => logs.splice(0, logs.length),
  }
  
  return logger
}

/**
 * Create a mock email service for testing
 */
function createMockEmailService() {
  return {
    sendEmail: jest.fn().mockResolvedValue({ id: 'email_123' }),
    sendInvoiceEmail: jest.fn().mockResolvedValue({ id: 'email_456' }),
    sendInvitationEmail: jest.fn().mockResolvedValue({ id: 'email_789' }),
  }
}

/**
 * Create a test organization context
 */
export function createTestOrganizationContext(overrides: Partial<any> = {}) {
  return {
    organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
    organization: {
      id: TEST_CONFIG.TEST_ORGANIZATION_ID,
      name: 'Test Organization',
      isMerchant: true,
      isCorporate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides.organization
    },
    userId: TEST_CONFIG.TEST_USER_ID,
    userRole: 'owner' as const,
    apiKey: TEST_CONFIG.TEST_API_KEY,
    authType: 'apiKey' as const,
    scope: 'merchant' as const,
    ...overrides
  }
}

/**
 * Create a test request with proper headers and context
 */
export function createTestRequest(
  url: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): NextRequest {
  const { params, ...requestOptions } = options
  
  const headers = new Headers({
    'x-api-key': TEST_CONFIG.TEST_API_KEY,
    'content-type': 'application/json',
    ...requestOptions.headers,
  })
  
  let fullUrl = url
  if (params) {
    const searchParams = new URLSearchParams(params)
    fullUrl += '?' + searchParams.toString()
  }
  
  return new NextRequest(fullUrl, {
    ...requestOptions,
    headers,
  })
}

/**
 * Create a test request context with DI container
 */
export function createTestRequestContext(
  request: NextRequest,
  orgContext = createTestOrganizationContext()
): RequestContext {
  return new RequestContext(request, orgContext)
}

/**
 * Test data generators
 */
export const TestData = {
  tab: (overrides: Partial<any> = {}) => ({
    id: 'tab_test_123',
    organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    totalAmount: '100.00',
    paidAmount: '0.00',
    status: 'open' as const,
    currency: 'usd' as const,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  lineItem: (overrides: Partial<any> = {}) => ({
    id: 'li_test_123',
    tabId: 'tab_test_123',
    description: 'Test Item',
    quantity: 1,
    unitPrice: '50.00',
    totalPrice: '50.00',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  payment: (overrides: Partial<any> = {}) => ({
    id: 'pay_test_123',
    organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
    tabId: 'tab_test_123',
    amount: '100.00',
    currency: 'usd' as const,
    status: 'succeeded' as const,
    processor: 'stripe' as const,
    processorPaymentId: 'pi_test_123',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  invoice: (overrides: Partial<any> = {}) => ({
    id: 'inv_test_123',
    organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
    tabId: 'tab_test_123',
    invoiceNumber: 'INV-001',
    status: 'draft' as const,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    subtotal: '100.00',
    taxAmount: '0.00',
    totalAmount: '100.00',
    paidAmount: '0.00',
    balanceDue: '100.00',
    currency: 'usd' as const,
    publicUrl: 'test-public-url-123',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  createTabPayload: (overrides: Partial<any> = {}) => ({
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    currency: 'usd',
    lineItems: [
      {
        description: 'Test Item',
        quantity: 1,
        unitPrice: 25.00
      }
    ],
    metadata: {},
    ...overrides
  })
}

/**
 * Database test helpers
 */
export class DatabaseTestHelpers {
  static async cleanupTestData(db: any) {
    // Clean up test data in proper order to respect foreign keys
    await db.delete('payments').where('organizationId', TEST_CONFIG.TEST_ORGANIZATION_ID)
    await db.delete('invoices').where('organizationId', TEST_CONFIG.TEST_ORGANIZATION_ID)
    await db.delete('lineItems').where('tabId like', 'tab_test_%')
    await db.delete('tabs').where('organizationId', TEST_CONFIG.TEST_ORGANIZATION_ID)
    await db.delete('organizations').where('id', TEST_CONFIG.TEST_ORGANIZATION_ID)
  }
  
  static async setupTestOrganization(db: any) {
    const org = {
      id: TEST_CONFIG.TEST_ORGANIZATION_ID,
      name: 'Test Organization',
      isMerchant: true,
      isCorporate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    await db.insert('organizations').values(org).onConflictDoNothing()
    return org
  }
}

/**
 * Assertion helpers for API testing
 */
export class ApiTestHelpers {
  static expectSuccessResponse(response: Response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('content-type')).toContain('application/json')
  }
  
  static expectErrorResponse(response: Response, expectedStatus = 400) {
    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('content-type')).toContain('application/json')
  }
  
  static async expectResponseData(response: Response, expectedFields: string[]) {
    const data = await response.json()
    expect(data).toHaveProperty('data')
    
    for (const field of expectedFields) {
      expect(data.data).toHaveProperty(field)
    }
    
    return data
  }
  
  static async expectPaginatedResponse(response: Response) {
    const data = await response.json()
    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('pagination')
    expect(data.pagination).toHaveProperty('page')
    expect(data.pagination).toHaveProperty('pageSize')
    expect(data.pagination).toHaveProperty('totalItems')
    expect(data.pagination).toHaveProperty('totalPages')
    
    return data
  }
}