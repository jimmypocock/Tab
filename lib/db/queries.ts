import { db } from './client'
import { sql } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

// Helper to count rows with conditions
export async function countRows<T extends PgTable>(
  table: T,
  where?: any
): Promise<number> {
  const query = db
    .select({ count: sql<number>`count(*)` })
    .from(table)
  
  if (where) {
    query.where(where)
  }
  
  const result = await query
  return Number(result[0]?.count || 0)
}