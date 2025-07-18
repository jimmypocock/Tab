import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { eq } from 'drizzle-orm'

const connectionString = process.env.DATABASE_URL!

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client, { schema })

// Helper functions for common operations
export async function getMerchantByEmail(email: string) {
  const result = await db.query.merchants.findFirst({
    where: (merchants, { eq }) => eq(merchants.email, email),
  })
  return result
}

export async function getTabWithItems(tabId: string) {
  const result = await db.query.tabs.findFirst({
    where: (tabs, { eq }) => eq(tabs.id, tabId),
    with: {
      lineItems: true,
      merchant: true,
      payments: true,
    },
  })
  return result
}

export async function validateApiKey(keyHash: string) {
  const result = await db.query.apiKeys.findFirst({
    where: (apiKeys, { and, eq }) => 
      and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)),
    with: {
      merchant: true,
    },
  })
  
  if (result) {
    // Update last used timestamp
    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiKeys.id, result.id))
  }
  
  return result
}