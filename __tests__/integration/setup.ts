import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'

// Store database instances for cleanup
const databases: { client: PGlite; db: ReturnType<typeof drizzle> }[] = []

/**
 * Creates a new isolated test database
 */
export async function createTestDatabase() {
  // Create in-memory database
  const client = new PGlite()
  const db = drizzle(client, { schema })
  
  // Store for cleanup
  databases.push({ client, db })
  
  // Run migrations
  try {
    await migrate(db, { migrationsFolder: './drizzle' })
  } catch (error) {
    console.warn('Migration failed, creating schema manually:', error)
    // If migrations fail, we can create tables manually
    await createSchemaManually(db)
  }
  
  return { client, db }
}

/**
 * Cleans up all test databases
 */
export async function cleanupAllDatabases() {
  for (const { client } of databases) {
    await client.close()
  }
  databases.length = 0
}

/**
 * Creates test organization with API key
 */
export async function createTestOrganization(db: any) {
  const orgId = `org_test_${randomBytes(8).toString('hex')}`
  const userId = `user_test_${randomBytes(8).toString('hex')}`
  
  // Create organization
  const [organization] = await db.insert(schema.organizations).values({
    id: orgId,
    name: 'Test Organization',
    isMerchant: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()
  
  // Create user member
  await db.insert(schema.organizationMembers).values({
    id: `member_${randomBytes(8).toString('hex')}`,
    organizationId: orgId,
    userId: userId,
    role: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  
  // Create API key
  const apiKey = `tab_test_${randomBytes(16).toString('hex')}`
  const keyHash = randomBytes(32).toString('hex') // In real app, this would be hashed
  
  const [apiKeyRecord] = await db.insert(schema.apiKeys).values({
    id: `key_${randomBytes(8).toString('hex')}`,
    organizationId: orgId,
    name: 'Test API Key',
    keyHash,
    lastFour: apiKey.slice(-4),
    environment: 'test',
    scope: 'full',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()
  
  return {
    organization,
    userId,
    apiKey,
    apiKeyRecord
  }
}

/**
 * Seeds test data
 */
export async function seedTestData(db: any, organizationId: string) {
  // Create default billing group
  const [defaultGroup] = await db.insert(schema.billingGroups).values({
    id: `group_default_${randomBytes(8).toString('hex')}`,
    organizationId,
    name: 'Default Group',
    isDefault: true,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()
  
  // Create payment processor
  const [processor] = await db.insert(schema.paymentProcessors).values({
    id: `proc_${randomBytes(8).toString('hex')}`,
    organizationId,
    type: 'stripe',
    name: 'Test Stripe',
    isActive: true,
    encryptedCredentials: JSON.stringify({ test: true }),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()
  
  return { defaultGroup, processor }
}

/**
 * Clears all data from database (for test isolation)
 */
export async function clearDatabase(db: any) {
  // Clear in dependency order
  await db.delete(schema.auditLogs).execute()
  await db.delete(schema.payments).execute()
  await db.delete(schema.lineItems).execute()
  await db.delete(schema.invoices).execute()
  await db.delete(schema.billingGroupRules).execute()
  await db.delete(schema.billingGroups).execute()
  await db.delete(schema.tabs).execute()
  await db.delete(schema.apiKeys).execute()
  await db.delete(schema.organizationInvitations).execute()
  await db.delete(schema.organizationMembers).execute()
  await db.delete(schema.paymentProcessors).execute()
  await db.delete(schema.organizations).execute()
}

/**
 * Creates schema manually if migrations fail
 */
async function createSchemaManually(db: any) {
  // Create organizations table first
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_merchant BOOLEAN DEFAULT false,
      merchant_id TEXT,
      customer_organization_code TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // Create other tables in dependency order
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      last_four TEXT NOT NULL,
      environment TEXT NOT NULL,
      scope TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      last_used_at TIMESTAMP,
      usage_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      status TEXT NOT NULL DEFAULT 'open',
      currency TEXT NOT NULL DEFAULT 'USD',
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_organization_id TEXT,
      external_reference TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS billing_groups (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      is_default BOOLEAN DEFAULT false,
      display_order INTEGER DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS line_items (
      id TEXT PRIMARY KEY,
      tab_id TEXT NOT NULL REFERENCES tabs(id),
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      billing_group_id TEXT REFERENCES billing_groups(id),
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_processors (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      encrypted_credentials TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // Add other tables as needed...
}