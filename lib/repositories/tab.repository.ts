/**
 * Tab Repository - handles all database operations for tabs
 */

import { eq, and, or, gte, lte, like, desc, asc, sql } from 'drizzle-orm'
import { tabs, lineItems, payments, organizations } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'
import type { Tab, LineItem } from '@/types'

export interface TabFilters {
  status?: 'open' | 'paid' | 'void' | 'closed'
  customerEmail?: string
  customerOrganizationId?: string
  externalReference?: string
  createdAfter?: Date
  createdBefore?: Date
  minAmount?: number
  maxAmount?: number
}

export interface TabWithRelations extends Tab {
  lineItems: LineItem[]
  payments: any[]
  customerOrganization?: any
}

export interface CreateTabInput {
  organizationId: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerOrganizationId?: string
  externalReference?: string
  currency: string
  metadata?: any
  lineItems?: Array<{
    description: string
    quantity: number
    unitPrice: number
    metadata?: any
    billingGroupId?: string
  }>
}

export class TabRepository extends BaseRepository {
  readonly name = 'TabRepository'

  /**
   * Find many tabs with optional filters and pagination
   */
  async findMany(
    organizationId: string,
    filters: TabFilters = {},
    options: {
      limit?: number
      offset?: number
      sortBy?: 'createdAt' | 'amount' | 'status'
      sortOrder?: 'asc' | 'desc'
      includeRelations?: boolean
    } = {}
  ): Promise<TabWithRelations[]> {
    this.log('findMany', { organizationId, filters, options })

    try {
      const conditions = [eq(tabs.organizationId, organizationId)]
      
      // Apply filters
      if (filters.status) {
        conditions.push(eq(tabs.status, filters.status))
      }
      if (filters.customerEmail) {
        conditions.push(eq(tabs.customerEmail, filters.customerEmail))
      }
      if (filters.customerOrganizationId) {
        conditions.push(eq(tabs.customerOrganizationId, filters.customerOrganizationId))
      }
      if (filters.externalReference) {
        conditions.push(like(tabs.externalReference, `%${filters.externalReference}%`))
      }
      if (filters.createdAfter) {
        conditions.push(gte(tabs.createdAt, filters.createdAfter))
      }
      if (filters.createdBefore) {
        conditions.push(lte(tabs.createdAt, filters.createdBefore))
      }
      if (filters.minAmount) {
        conditions.push(gte(tabs.totalAmount, filters.minAmount.toString()))
      }
      if (filters.maxAmount) {
        conditions.push(lte(tabs.totalAmount, filters.maxAmount.toString()))
      }

      const query = this.db.query.tabs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: options.includeRelations !== false ? {
          lineItems: {
            orderBy: (lineItems: any, { asc }: any) => [asc(lineItems.createdAt)],
          },
          payments: {
            where: (payments: any, { eq }: any) => eq(payments.status, 'succeeded'),
            orderBy: (payments: any, { desc }: any) => [desc(payments.createdAt)],
          },
          customerOrganization: {
            columns: {
              id: true,
              name: true,
              billingEmail: true,
            }
          },
        } : undefined,
        limit: options.limit,
        offset: options.offset,
        orderBy: this.buildOrderBy(options.sortBy, options.sortOrder),
      })

      return await query
    } catch (error) {
      return this.handleError('findMany', error)
    }
  }

  /**
   * Find a single tab by ID
   */
  async findById(
    id: string, 
    organizationId: string,
    includeRelations = true
  ): Promise<TabWithRelations | null> {
    this.log('findById', { id, organizationId })

    try {
      const result = await this.db.query.tabs.findFirst({
        where: and(
          eq(tabs.id, id),
          eq(tabs.organizationId, organizationId)
        ),
        with: includeRelations ? {
          lineItems: {
            orderBy: (lineItems: any, { asc }: any) => [asc(lineItems.createdAt)],
          },
          payments: {
            orderBy: (payments: any, { desc }: any) => [desc(payments.createdAt)],
          },
          customerOrganization: true,
        } : undefined,
      })

      return result || null
    } catch (error) {
      return this.handleError('findById', error)
    }
  }

  /**
   * Create a new tab with line items
   */
  async create(input: CreateTabInput): Promise<TabWithRelations> {
    this.log('create', input)

    return this.transaction(async (tx) => {
      try {
        // Calculate totals
        const lineItemsData = input.lineItems || []
        const subtotal = lineItemsData.reduce(
          (sum, item) => sum + (item.quantity * item.unitPrice), 
          0
        )
        const taxAmount = subtotal * 0.1 // TODO: Make tax rate configurable
        const totalAmount = subtotal + taxAmount

        // Create tab
        const [newTab] = await tx.insert(tabs).values({
          organizationId: input.organizationId,
          status: 'open',
          currency: input.currency,
          totalAmount: totalAmount.toFixed(2),
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          paidAmount: '0.00',
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          customerOrganizationId: input.customerOrganizationId,
          externalReference: input.externalReference,
          metadata: input.metadata,
        }).returning()

        // Create line items
        const createdLineItems = []
        if (lineItemsData.length > 0) {
          const lineItemsToInsert = lineItemsData.map(item => ({
            tabId: newTab.id,
            organizationId: input.organizationId,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            totalPrice: (item.quantity * item.unitPrice).toFixed(2),
            metadata: item.metadata,
            billingGroupId: item.billingGroupId,
          }))

          const insertedItems = await tx.insert(lineItems)
            .values(lineItemsToInsert)
            .returning()
          
          createdLineItems.push(...insertedItems)
        }

        // Return with relations
        return {
          ...newTab,
          lineItems: createdLineItems,
          payments: [],
          customerOrganization: null,
        }
      } catch (error) {
        return this.handleError('create', error)
      }
    })
  }

  /**
   * Update a tab
   */
  async update(
    id: string,
    organizationId: string,
    updates: Partial<Tab>
  ): Promise<TabWithRelations | null> {
    this.log('update', { id, organizationId, updates })

    try {
      const [updated] = await this.db
        .update(tabs)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(
          eq(tabs.id, id),
          eq(tabs.organizationId, organizationId)
        ))
        .returning()

      if (!updated) {
        return null
      }

      return this.findById(id, organizationId)
    } catch (error) {
      return this.handleError('update', error)
    }
  }

  /**
   * Delete a tab (soft delete by setting status to 'void')
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    this.log('delete', { id, organizationId })

    try {
      const result = await this.update(id, organizationId, { status: 'void' })
      return result !== null
    } catch (error) {
      return this.handleError('delete', error)
    }
  }

  /**
   * Count tabs matching filters
   */
  async count(organizationId: string, filters: TabFilters = {}): Promise<number> {
    this.log('count', { organizationId, filters })

    try {
      const conditions = [eq(tabs.organizationId, organizationId)]
      
      // Apply same filters as findMany
      if (filters.status) {
        conditions.push(eq(tabs.status, filters.status))
      }
      // ... other filters

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(tabs)
        .where(and(...conditions))
        .execute()

      return Number(result[0]?.count || 0)
    } catch (error) {
      return this.handleError('count', error)
    }
  }

  /**
   * Build order by clause
   */
  private buildOrderBy(sortBy?: string, sortOrder?: string) {
    const order = sortOrder === 'asc' ? asc : desc
    
    switch (sortBy) {
      case 'amount':
        return [order(tabs.totalAmount)]
      case 'status':
        return [order(tabs.status)]
      case 'createdAt':
      default:
        return [order(tabs.createdAt)]
    }
  }
}