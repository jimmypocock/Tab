/**
 * Line Item Repository
 */

import { eq, and } from 'drizzle-orm'
import { lineItems } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'

export class LineItemRepository extends BaseRepository {
  readonly name = 'LineItemRepository'

  async findByTabId(tabId: string, organizationId: string) {
    return this.db.query.lineItems.findMany({
      where: and(
        eq(lineItems.tabId, tabId),
        eq(lineItems.organizationId, organizationId)
      ),
      orderBy: (lineItems: any, { asc }: any) => [asc(lineItems.createdAt)],
    })
  }

  async createMany(items: any[]) {
    if (items.length === 0) return []
    
    return this.db.insert(lineItems)
      .values(items)
      .returning()
  }

  async update(id: string, organizationId: string, updates: any) {
    const [updated] = await this.db
      .update(lineItems)
      .set(updates)
      .where(and(
        eq(lineItems.id, id),
        eq(lineItems.organizationId, organizationId)
      ))
      .returning()
    
    return updated
  }

  async delete(id: string, organizationId: string) {
    return this.db
      .delete(lineItems)
      .where(and(
        eq(lineItems.id, id),
        eq(lineItems.organizationId, organizationId)
      ))
  }
}