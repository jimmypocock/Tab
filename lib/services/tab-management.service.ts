/**
 * Tab Management Service - Business logic for tab operations
 */

import { DITokens } from '@/lib/di/types'
import { TabRepository, TabFilters, CreateTabInput, TabWithRelations } from '@/lib/repositories/tab.repository'
import { LineItemRepository } from '@/lib/repositories/line-item.repository'
import { BillingGroupRepository } from '@/lib/repositories/billing-group.repository'
import { ValidationError, NotFoundError, BusinessRuleError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { IDIContainer } from '@/lib/di/types'

export interface TabListOptions {
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'amount' | 'status'
  sortOrder?: 'asc' | 'desc'
  filters?: TabFilters
}

export interface TabListResult {
  data: TabWithRelations[]
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalItems: number
  }
}

export class TabManagementService {
  private tabRepo: TabRepository
  private lineItemRepo?: LineItemRepository
  private billingGroupRepo?: BillingGroupRepository

  constructor(container: IDIContainer) {
    this.tabRepo = container.resolve(DITokens.TabRepository)
    // Optional dependencies
    try {
      this.lineItemRepo = container.resolve(DITokens.LineItemRepository)
      this.billingGroupRepo = container.resolve(DITokens.BillingGroupRepository)
    } catch {
      // Optional dependencies might not be registered
    }
  }

  /**
   * List tabs with pagination and filtering
   */
  async listTabs(
    organizationId: string,
    options: TabListOptions = {}
  ): Promise<TabListResult> {
    const page = Math.max(1, options.page || 1)
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 10))
    const offset = (page - 1) * pageSize

    // Get tabs and count in parallel
    const [tabs, totalItems] = await Promise.all([
      this.tabRepo.findMany(organizationId, options.filters || {}, {
        limit: pageSize,
        offset,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        includeRelations: true,
      }),
      this.tabRepo.count(organizationId, options.filters || {}),
    ])

    const totalPages = Math.ceil(totalItems / pageSize)

    return {
      data: tabs,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
      },
    }
  }

  /**
   * Get a single tab by ID
   */
  async getTab(id: string, organizationId: string): Promise<TabWithRelations> {
    const tab = await this.tabRepo.findById(id, organizationId)
    
    if (!tab) {
      throw new NotFoundError('Tab not found')
    }

    return tab
  }

  /**
   * Create a new tab with line items
   */
  async createTab(
    organizationId: string,
    input: Omit<CreateTabInput, 'organizationId'>
  ): Promise<TabWithRelations> {
    // Validate input
    if (!input.lineItems || input.lineItems.length === 0) {
      throw new ValidationError('At least one line item is required')
    }

    if (input.customerEmail && !this.isValidEmail(input.customerEmail)) {
      throw new ValidationError('Invalid email format')
    }

    // Set default billing group if needed
    if (this.billingGroupRepo) {
      for (const item of input.lineItems) {
        if (!item.billingGroupId) {
          const defaultGroup = await this.billingGroupRepo.findDefault(organizationId)
          if (defaultGroup) {
            item.billingGroupId = defaultGroup.id
          }
        }
      }
    }

    // Create the tab
    const tab = await this.tabRepo.create({
      ...input,
      organizationId,
    })

    logger.info('Tab created', {
      tabId: tab.id,
      organizationId,
      totalAmount: tab.totalAmount,
    })

    return tab
  }

  /**
   * Update a tab
   */
  async updateTab(
    id: string,
    organizationId: string,
    updates: Partial<TabWithRelations>
  ): Promise<TabWithRelations> {
    // Get existing tab
    const existingTab = await this.getTab(id, organizationId)

    // Check business rules
    if (existingTab.status === 'paid') {
      throw new BusinessRuleError('Cannot update a paid tab')
    }

    if (existingTab.status === 'void') {
      throw new BusinessRuleError('Cannot update a voided tab')
    }

    // Prevent certain field updates
    const { lineItems, payments, ...allowedUpdates } = updates

    const updated = await this.tabRepo.update(id, organizationId, allowedUpdates)
    
    if (!updated) {
      throw new NotFoundError('Tab not found')
    }

    return updated
  }

  /**
   * Void a tab
   */
  async voidTab(id: string, organizationId: string, reason?: string): Promise<TabWithRelations> {
    const tab = await this.getTab(id, organizationId)

    // Check if tab can be voided
    if (tab.status === 'paid') {
      throw new BusinessRuleError('Cannot void a paid tab')
    }

    if (tab.status === 'void') {
      throw new BusinessRuleError('Tab is already voided')
    }

    if (parseFloat(tab.paidAmount) > 0) {
      throw new BusinessRuleError('Cannot void a tab with payments')
    }

    const voided = await this.tabRepo.update(id, organizationId, {
      status: 'void',
      metadata: {
        ...tab.metadata,
        voidedAt: new Date().toISOString(),
        voidReason: reason,
      },
    })

    if (!voided) {
      throw new Error('Failed to void tab')
    }

    logger.info('Tab voided', {
      tabId: id,
      organizationId,
      reason,
    })

    return voided
  }

  /**
   * Delete a tab (only if no payments)
   */
  async deleteTab(id: string, organizationId: string): Promise<void> {
    const tab = await this.getTab(id, organizationId)

    // Check if tab can be deleted
    if (tab.payments && tab.payments.length > 0) {
      throw new BusinessRuleError('Cannot delete a tab with payments')
    }

    if (parseFloat(tab.paidAmount) > 0) {
      throw new BusinessRuleError('Cannot delete a tab with payments')
    }

    // Soft delete by voiding
    await this.voidTab(id, organizationId, 'Deleted by user')
  }

  /**
   * Calculate tab totals
   */
  calculateTotals(lineItems: Array<{ quantity: number; unitPrice: number }>) {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice),
      0
    )
    const taxRate = 0.1 // TODO: Make configurable
    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}