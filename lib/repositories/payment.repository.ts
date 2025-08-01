/**
 * Payment Repository
 */

import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { payments } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'

export interface PaymentFilters {
  tabId?: string
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded'
  processor?: string
  minAmount?: number
  maxAmount?: number
  createdAfter?: Date
  createdBefore?: Date
}

export class PaymentRepository extends BaseRepository {
  readonly name = 'PaymentRepository'

  async findMany(
    organizationId: string,
    filters: PaymentFilters = {},
    options: {
      limit?: number
      offset?: number
      includeRelations?: boolean
    } = {}
  ) {
    const conditions = [eq(payments.organizationId, organizationId)]
    
    if (filters.tabId) {
      conditions.push(eq(payments.tabId, filters.tabId))
    }
    if (filters.status) {
      conditions.push(eq(payments.status, filters.status))
    }
    if (filters.processor) {
      conditions.push(eq(payments.processor, filters.processor))
    }
    if (filters.minAmount) {
      conditions.push(gte(payments.amount, filters.minAmount.toString()))
    }
    if (filters.maxAmount) {
      conditions.push(lte(payments.amount, filters.maxAmount.toString()))
    }
    if (filters.createdAfter) {
      conditions.push(gte(payments.createdAt, filters.createdAfter))
    }
    if (filters.createdBefore) {
      conditions.push(lte(payments.createdAt, filters.createdBefore))
    }

    return this.db.query.payments.findMany({
      where: and(...conditions),
      with: options.includeRelations ? {
        tab: true,
        lineItems: true,
      } : undefined,
      limit: options.limit,
      offset: options.offset,
      orderBy: desc(payments.createdAt),
    })
  }

  async findById(id: string, organizationId: string) {
    return this.db.query.payments.findFirst({
      where: and(
        eq(payments.id, id),
        eq(payments.organizationId, organizationId)
      ),
      with: {
        tab: true,
        lineItems: true,
      }
    })
  }

  async create(data: any) {
    const [payment] = await this.db.insert(payments)
      .values(data)
      .returning()
    
    return payment
  }

  async update(id: string, organizationId: string, updates: any) {
    const [updated] = await this.db
      .update(payments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(payments.id, id),
        eq(payments.organizationId, organizationId)
      ))
      .returning()
    
    return updated
  }

  async findByProcessorPaymentId(processorPaymentId: string) {
    return this.db.query.payments.findFirst({
      where: eq(payments.processorPaymentId, processorPaymentId)
    })
  }

  async getTotalPaidForTab(tabId: string): Promise<number> {
    const result = await this.db
      .select({ total: payments.amount })
      .from(payments)
      .where(and(
        eq(payments.tabId, tabId),
        eq(payments.status, 'succeeded')
      ))
    
    return result.reduce((sum, row) => sum + parseFloat(row.total), 0)
  }
}