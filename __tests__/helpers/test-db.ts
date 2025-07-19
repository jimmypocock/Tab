import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/lib/db/schema'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import crypto from 'crypto'

// Test database connection
let testDb: ReturnType<typeof drizzle> | null = null
let sql: ReturnType<typeof postgres> | null = null

export async function setupTestDatabase() {
  // Use a unique schema for each test run to avoid conflicts
  const testSchema = `test_${crypto.randomBytes(6).toString('hex')}`
  
  // For testing, we'll use an in-memory approach or mock
  // In a real setup, you'd use a test database
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
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    select: jest.fn(),
    from: jest.fn(),
  }
  
  return mockDb
}

export async function cleanupTestDatabase() {
  if (sql) {
    await sql.end()
    sql = null
    testDb = null
  }
}

// Helper to create test data
export const testData = {
  merchant: (overrides = {}) => ({
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    businessName: 'Test Business',
    email: 'test@business.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  apiKey: (merchantId: string, overrides = {}) => {
    const key = `tab_test_${crypto.randomBytes(16).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(key).digest('hex')
    
    return {
      key, // Return the unhashed key for testing
      record: {
        id: crypto.randomUUID(),
        merchantId,
        keyHash,
        keyPrefix: key.substring(0, 8),
        name: 'Test API Key',
        isActive: true,
        environment: 'test' as const,
        createdAt: new Date(),
        lastUsedAt: null,
        ...overrides,
      }
    }
  },
  
  tab: (merchantId: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    merchantId,
    customerEmail: 'customer@example.com',
    customerName: 'Test Customer',
    currency: 'USD',
    subtotal: '100.00',
    taxAmount: '7.50',
    totalAmount: '107.50',
    paidAmount: '0.00',
    status: 'open' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  lineItem: (tabId: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    tabId,
    description: 'Test Item',
    quantity: 1,
    unitPrice: '100.00',
    totalPrice: '100.00',
    createdAt: new Date(),
    ...overrides,
  }),
  
  payment: (tabId: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    tabId,
    stripePaymentIntentId: `pi_test_${crypto.randomBytes(12).toString('hex')}`,
    amount: '107.50',
    currency: 'USD',
    status: 'succeeded' as const,
    createdAt: new Date(),
    ...overrides,
  }),
}