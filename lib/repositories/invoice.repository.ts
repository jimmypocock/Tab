/**
 * Invoice Repository
 */

import { eq, and, desc } from 'drizzle-orm'
import { invoices } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'

export interface InvoiceFilters {
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  tabId?: string
  billingGroupId?: string
}

export class InvoiceRepository extends BaseRepository {
  readonly name = 'InvoiceRepository'

  async findMany(
    organizationId: string,
    filters: InvoiceFilters = {},
    options: {
      limit?: number
      offset?: number
      includeRelations?: boolean
    } = {}
  ) {
    const conditions = [eq(invoices.organizationId, organizationId)]
    
    if (filters.status) {
      conditions.push(eq(invoices.status, filters.status))
    }
    if (filters.tabId) {
      conditions.push(eq(invoices.tabId, filters.tabId))
    }
    if (filters.billingGroupId) {
      conditions.push(eq(invoices.billingGroupId, filters.billingGroupId))
    }

    return this.db.query.invoices.findMany({
      where: and(...conditions),
      with: options.includeRelations ? {
        tab: {
          with: {
            lineItems: true
          }
        },
        billingGroup: true,
        payments: true,
      } : undefined,
      limit: options.limit,
      offset: options.offset,
      orderBy: desc(invoices.createdAt),
    })
  }

  async findById(id: string, organizationId: string) {
    return this.db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.organizationId, organizationId)
      ),
      with: {
        tab: {
          with: {
            lineItems: true,
            customerOrganization: true
          }
        },
        billingGroup: true,
        payments: true,
      }
    })
  }

  async findByPublicUrl(publicUrl: string) {
    return this.db.query.invoices.findFirst({
      where: eq(invoices.publicUrl, publicUrl),
      with: {
        tab: {
          with: {
            lineItems: true
          }
        },
        billingGroup: true,
        organization: true,
      }
    })
  }

  async create(data: any) {
    // Generate unique public URL
    const publicUrl = this.generatePublicUrl()
    
    const [invoice] = await this.db.insert(invoices)
      .values({
        ...data,
        publicUrl,
        invoiceNumber: await this.generateInvoiceNumber(data.organizationId),
      })
      .returning()
    
    return invoice
  }

  async update(id: string, organizationId: string, updates: any) {
    const [updated] = await this.db
      .update(invoices)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(invoices.id, id),
        eq(invoices.organizationId, organizationId)
      ))
      .returning()
    
    return updated
  }

  async markAsSent(id: string, organizationId: string) {
    return this.update(id, organizationId, {
      status: 'sent',
      sentAt: new Date(),
    })
  }

  async markAsPaid(id: string, organizationId: string) {
    return this.update(id, organizationId, {
      status: 'paid',
      paidAt: new Date(),
    })
  }

  async generateInvoiceNumber(organizationId: string): Promise<string> {
    // Get the latest invoice number
    const latest = await this.db.query.invoices.findFirst({
      where: eq(invoices.organizationId, organizationId),
      orderBy: desc(invoices.createdAt),
    })
    
    if (!latest || !latest.invoiceNumber) {
      return `INV-${new Date().getFullYear()}-0001`
    }
    
    // Extract number and increment
    const match = latest.invoiceNumber.match(/(\d+)$/)
    if (match) {
      const num = parseInt(match[1]) + 1
      return `INV-${new Date().getFullYear()}-${num.toString().padStart(4, '0')}`
    }
    
    return `INV-${new Date().getFullYear()}-0001`
  }

  private generatePublicUrl(): string {
    return `inv_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`
  }
}