import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/lib/db/schema'
import { migrate } from 'drizzle-orm/pglite/migrator'

let testDb: ReturnType<typeof drizzle> | null = null
let client: PGlite | null = null

export async function setupTestDatabase() {
  // Create in-memory database
  client = new PGlite()
  testDb = drizzle(client, { schema })
  
  // Run migrations
  await migrate(testDb, { migrationsFolder: './drizzle' })
  
  return testDb
}

export async function cleanupTestDatabase() {
  if (client) {
    await client.close()
    client = null
    testDb = null
  }
}

export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }
  return testDb
}

// Helper to reset database between tests
export async function resetTestDatabase() {
  if (!testDb) return
  
  // Clear all tables (in reverse order of dependencies)
  await testDb.delete(schema.payments).execute()
  await testDb.delete(schema.lineItems).execute()
  await testDb.delete(schema.invoices).execute()
  await testDb.delete(schema.billingGroups).execute()
  await testDb.delete(schema.tabs).execute()
  await testDb.delete(schema.apiKeys).execute()
  await testDb.delete(schema.organizationInvitations).execute()
  await testDb.delete(schema.organizationMembers).execute()
  await testDb.delete(schema.organizations).execute()
  await testDb.delete(schema.paymentProcessors).execute()
}

// Test data factories
export const testDataFactory = {
  organization: (overrides = {}) => ({
    id: `org_${Date.now()}`,
    name: 'Test Organization',
    isMerchant: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  tab: (organizationId: string, overrides = {}) => ({
    id: `tab_${Date.now()}`,
    organizationId,
    status: 'open' as const,
    currency: 'USD',
    totalAmount: '100.00',
    subtotal: '90.91',
    taxAmount: '9.09',
    paidAmount: '0.00',
    customerName: 'Test Customer',
    customerEmail: 'customer@test.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  lineItem: (tabId: string, organizationId: string, overrides = {}) => ({
    id: `item_${Date.now()}`,
    tabId,
    organizationId,
    description: 'Test Item',
    quantity: '1',
    unitPrice: '10.00',
    totalPrice: '10.00',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  apiKey: (organizationId: string, overrides = {}) => ({
    id: `key_${Date.now()}`,
    organizationId,
    name: 'Test Key',
    keyHash: 'test_hash',
    environment: 'test' as const,
    scope: 'full' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
}