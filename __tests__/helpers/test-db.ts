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
      organizations: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      organizationUsers: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
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
  organization: (overrides = {}) => ({
    id: crypto.randomUUID(),
    name: 'Test Organization',
    slug: 'test-organization',
    type: 'business' as const,
    isMerchant: true,
    isCorporate: false,
    primaryEmail: 'test@organization.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: crypto.randomUUID(),
    ...overrides,
  }),

  organizationUser: (organizationId: string, userId: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    organizationId,
    userId,
    role: 'owner' as const,
    status: 'active' as const,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  // Legacy merchant for backward compatibility
  merchant: (overrides = {}) => ({
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    businessName: 'Test Business',
    email: 'test@business.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  apiKey: (organizationId: string, overrides = {}) => {
    const key = `tab_test_${crypto.randomBytes(16).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(key).digest('hex')
    
    return {
      key, // Return the unhashed key for testing
      record: {
        id: crypto.randomUUID(),
        organizationId,
        merchantId: organizationId, // For backward compatibility
        keyHash,
        keyPrefix: key.substring(0, 8),
        name: 'Test API Key',
        scope: 'merchant',
        isActive: true,
        environment: 'test' as const,
        createdAt: new Date(),
        lastUsedAt: null,
        ...overrides,
      }
    }
  },
  
  tab: (organizationId: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    organizationId,
    merchantId: organizationId, // For backward compatibility
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
    unitPrice: '10.00',
    total: '10.00',
    createdAt: new Date(),
    ...overrides,
  }),
  
  payment: (tabId: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    tabId,
    amount: '50.00',
    currency: 'USD',
    status: 'succeeded' as const,
    processor: 'stripe' as const,
    processorPaymentId: `pi_${crypto.randomBytes(16).toString('hex')}`,
    createdAt: new Date(),
    ...overrides,
  }),
  
  session: (overrides = {}) => ({
    id: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    sessionToken: crypto.randomBytes(32).toString('hex'),
    userId: crypto.randomUUID(),
    ...overrides,
  })
}

// Helper to create a complete test scenario
export function createTestScenario() {
  const userId = crypto.randomUUID()
  const organization = testData.organization({ createdBy: userId })
  const orgUser = testData.organizationUser(organization.id, userId)
  const apiKey = testData.apiKey(organization.id)
  const tab = testData.tab(organization.id)
  const lineItems = [
    testData.lineItem(tab.id, { description: 'Item 1', unitPrice: '50.00', total: '50.00' }),
    testData.lineItem(tab.id, { description: 'Item 2', unitPrice: '50.00', total: '50.00' })
  ]
  
  return {
    userId,
    organization,
    organizationUser: orgUser,
    apiKey,
    tab,
    lineItems,
  }
}