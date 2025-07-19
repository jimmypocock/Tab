import { db } from './client'
import { sql } from 'drizzle-orm'

// Helper to count rows with conditions
export async function countRows(
  table: any,
  where?: any
): Promise<number> {
  if (where) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(where)
    return Number(result[0]?.count || 0)
  } else {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
    return Number(result[0]?.count || 0)
  }
}