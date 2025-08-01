import { db } from '@/lib/db'
import { lineItems, tabs, payments, invoices, billingGroups } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { DatabaseError, ValidationError, UnauthorizedError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface CreateLineItemData {
  tabId: string
  description: string
  quantity: number
  unitPrice: number
  billingGroupId?: string
  metadata?: Record<string, any>
}

export interface UpdateLineItemData {
  description?: string
  quantity?: number
  unitPrice?: number
  billingGroupId?: string
  metadata?: Record<string, any>
}

export interface LineItemWithProtection {
  id: string
  tabId: string
  description: string
  quantity: number
  unitPrice: string
  total: string
  billingGroupId: string | null
  metadata: Record<string, any> | null
  createdAt: Date
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  canEdit: boolean
  canDelete: boolean
  protectionReasons: string[]
}

export interface PaymentProtectionResult {
  isProtected: boolean
  reasons: string[]
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  paidAmount: number
  totalAmount: number
}

export class LineItemCrudService {
  /**
   * Check if a line item is protected by payment status
   */
  static async checkPaymentProtection(
    lineItemId: string,
    organizationId: string
  ): Promise<PaymentProtectionResult> {
    try {
      // Get line item with related data
      const lineItem = await db.query.lineItems.findFirst({
        where: eq(lineItems.id, lineItemId),
        with: {
          tab: {
            with: {
              payments: {
                where: eq(payments.status, 'succeeded')
              }
            }
          },
          billingGroup: {
            with: {
              invoice: true
            }
          }
        }
      })

      if (!lineItem) {
        throw new ValidationError('Line item not found')
      }

      // Verify organization access
      if (lineItem.tab.organizationId !== organizationId) {
        throw new UnauthorizedError('You do not have access to this line item')
      }

      const reasons: string[] = []
      let isProtected = false
      let paidAmount = 0
      const totalAmount = parseFloat(lineItem.total)

      // Check for successful payments on the tab
      const successfulPayments = lineItem.tab.payments || []
      if (successfulPayments.length > 0) {
        paidAmount = successfulPayments.reduce((sum, payment) => 
          sum + parseFloat(payment.amount), 0
        )

        if (paidAmount > 0) {
          isProtected = true
          reasons.push(`Tab has received payment(s) totaling $${paidAmount.toFixed(2)}`)
        }
      }

      // Check for invoice status
      if (lineItem.billingGroup?.invoice) {
        const invoice = lineItem.billingGroup.invoice
        const invoicePaidAmount = parseFloat(invoice.paidAmount || '0')

        if (invoicePaidAmount > 0) {
          isProtected = true
          reasons.push(`Associated invoice has been paid $${invoicePaidAmount.toFixed(2)}`)
        }

        if (['paid', 'overdue', 'uncollectible'].includes(invoice.status)) {
          isProtected = true
          reasons.push(`Associated invoice is in final status '${invoice.status}'`)
        }
      }

      // Determine payment status
      let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid'
      if (paidAmount > 0) {
        if (paidAmount >= totalAmount) {
          paymentStatus = 'paid'
        } else {
          paymentStatus = 'partial'
        }
      }

      return {
        isProtected,
        reasons,
        paymentStatus,
        paidAmount,
        totalAmount
      }
    } catch (error) {
      logger.error('Failed to check payment protection', error as Error, {
        lineItemId,
        organizationId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to check payment protection', error)
    }
  }

  /**
   * Get line item with protection information
   */
  static async getLineItemWithProtection(
    lineItemId: string,
    organizationId: string
  ): Promise<LineItemWithProtection> {
    try {
      const lineItem = await db.query.lineItems.findFirst({
        where: eq(lineItems.id, lineItemId),
        with: {
          tab: true
        }
      })

      if (!lineItem) {
        throw new ValidationError('Line item not found')
      }

      // Verify organization access
      if (lineItem.tab.organizationId !== organizationId) {
        throw new UnauthorizedError('You do not have access to this line item')
      }

      // Check payment protection
      const protection = await this.checkPaymentProtection(lineItemId, organizationId)

      return {
        id: lineItem.id,
        tabId: lineItem.tabId,
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        total: lineItem.total,
        billingGroupId: lineItem.billingGroupId,
        metadata: (lineItem.metadata as Record<string, any>) || {},
        createdAt: lineItem.createdAt,
        paymentStatus: protection.paymentStatus,
        canEdit: !protection.isProtected,
        canDelete: !protection.isProtected,
        protectionReasons: protection.reasons
      }
    } catch (error) {
      logger.error('Failed to get line item with protection', error as Error, {
        lineItemId,
        organizationId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to get line item', error)
    }
  }

  /**
   * Create a new line item
   */
  static async createLineItem(
    data: CreateLineItemData,
    organizationId: string,
    userId: string
  ): Promise<LineItemWithProtection> {
    try {
      // Verify tab belongs to organization
      const tab = await db.query.tabs.findFirst({
        where: and(
          eq(tabs.id, data.tabId),
          eq(tabs.organizationId, organizationId)
        )
      })

      if (!tab) {
        throw new ValidationError('Tab not found or you do not have access to it')
      }

      // Validate billing group if provided
      if (data.billingGroupId) {
        const billingGroup = await db.query.billingGroups.findFirst({
          where: and(
            eq(billingGroups.id, data.billingGroupId),
            eq(billingGroups.tabId, data.tabId)
          )
        })

        if (!billingGroup) {
          throw new ValidationError('Billing group not found or does not belong to this tab')
        }
      }

      // Calculate total
      const total = data.quantity * data.unitPrice

      await db.transaction(async (tx) => {
        // Create line item
        const [newLineItem] = await tx
          .insert(lineItems)
          .values({
            tabId: data.tabId,
            description: data.description,
            quantity: data.quantity,
            unitPrice: data.unitPrice.toFixed(2),
            total: total.toFixed(2),
            billingGroupId: data.billingGroupId || null,
            metadata: data.metadata || {}
          })
          .returning()

        // Update tab totals
        await this.recalculateTabTotals(data.tabId, tx)

        logger.info('Line item created', {
          lineItemId: newLineItem.id,
          tabId: data.tabId,
          organizationId,
          userId
        })

        return newLineItem
      })

      // Get the created line item with protection info
      return await this.getLineItemWithProtection(
        (await db.query.lineItems.findFirst({
          where: and(
            eq(lineItems.tabId, data.tabId),
            eq(lineItems.description, data.description)
          ),
          orderBy: (lineItems, { desc }) => [desc(lineItems.createdAt)]
        }))!.id,
        organizationId
      )
    } catch (error) {
      logger.error('Failed to create line item', error as Error, {
        tabId: data.tabId,
        organizationId,
        userId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to create line item', error)
    }
  }

  /**
   * Update a line item (with payment protection)
   */
  static async updateLineItem(
    lineItemId: string,
    data: UpdateLineItemData,
    organizationId: string,
    userId: string,
    options: { force?: boolean } = {}
  ): Promise<LineItemWithProtection> {
    try {
      // Check payment protection unless forced
      if (!options.force) {
        const protection = await this.checkPaymentProtection(lineItemId, organizationId)
        
        if (protection.isProtected) {
          const reasonsText = protection.reasons.join('; ')
          throw new ValidationError(`Cannot edit line item: ${reasonsText}. Use force=true to override.`)
        }
      }

      // Get current line item
      const currentLineItem = await db.query.lineItems.findFirst({
        where: eq(lineItems.id, lineItemId),
        with: {
          tab: true
        }
      })

      if (!currentLineItem) {
        throw new ValidationError('Line item not found')
      }

      // Verify organization access
      if (currentLineItem.tab.organizationId !== organizationId) {
        throw new UnauthorizedError('You do not have access to this line item')
      }

      // Validate billing group if being changed
      if (data.billingGroupId !== undefined && data.billingGroupId !== null) {
        const billingGroup = await db.query.billingGroups.findFirst({
          where: and(
            eq(billingGroups.id, data.billingGroupId),
            eq(billingGroups.tabId, currentLineItem.tabId)
          )
        })

        if (!billingGroup) {
          throw new ValidationError('Billing group not found or does not belong to this tab')
        }
      }

      await db.transaction(async (tx) => {
        // Prepare update data
        const updateData: any = {}
        
        if (data.description !== undefined) updateData.description = data.description
        if (data.quantity !== undefined) updateData.quantity = data.quantity
        if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice.toFixed(2)
        if (data.billingGroupId !== undefined) updateData.billingGroupId = data.billingGroupId
        if (data.metadata !== undefined) updateData.metadata = data.metadata

        // Recalculate total if quantity or unitPrice changed
        if (data.quantity !== undefined || data.unitPrice !== undefined) {
          const quantity = data.quantity ?? currentLineItem.quantity
          const unitPrice = data.unitPrice ?? parseFloat(currentLineItem.unitPrice)
          updateData.total = (quantity * unitPrice).toFixed(2)
        }

        // Update line item
        await tx
          .update(lineItems)
          .set(updateData)
          .where(eq(lineItems.id, lineItemId))

        // Update tab totals
        await this.recalculateTabTotals(currentLineItem.tabId, tx)

        logger.info('Line item updated', {
          lineItemId,
          organizationId,
          userId,
          changes: Object.keys(updateData),
          forced: options.force
        })
      })

      // Get updated line item with protection info
      return await this.getLineItemWithProtection(lineItemId, organizationId)
    } catch (error) {
      logger.error('Failed to update line item', error as Error, {
        lineItemId,
        organizationId,
        userId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to update line item', error)
    }
  }

  /**
   * Delete a line item (with payment protection)
   */
  static async deleteLineItem(
    lineItemId: string,
    organizationId: string,
    userId: string,
    options: { force?: boolean } = {}
  ): Promise<void> {
    try {
      // Check payment protection unless forced
      if (!options.force) {
        const protection = await this.checkPaymentProtection(lineItemId, organizationId)
        
        if (protection.isProtected) {
          const reasonsText = protection.reasons.join('; ')
          throw new ValidationError(`Cannot delete line item: ${reasonsText}. Use force=true to override.`)
        }
      }

      // Get current line item
      const currentLineItem = await db.query.lineItems.findFirst({
        where: eq(lineItems.id, lineItemId),
        with: {
          tab: true
        }
      })

      if (!currentLineItem) {
        throw new ValidationError('Line item not found')
      }

      // Verify organization access
      if (currentLineItem.tab.organizationId !== organizationId) {
        throw new UnauthorizedError('You do not have access to this line item')
      }

      await db.transaction(async (tx) => {
        // Delete line item
        await tx
          .delete(lineItems)
          .where(eq(lineItems.id, lineItemId))

        // Update tab totals
        await this.recalculateTabTotals(currentLineItem.tabId, tx)

        logger.info('Line item deleted', {
          lineItemId,
          tabId: currentLineItem.tabId,
          organizationId,
          userId,
          forced: options.force
        })
      })
    } catch (error) {
      logger.error('Failed to delete line item', error as Error, {
        lineItemId,
        organizationId,
        userId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to delete line item', error)
    }
  }

  /**
   * Recalculate tab totals after line item changes
   */
  private static async recalculateTabTotals(tabId: string, tx: any = db) {
    // Get all line items for the tab
    const allLineItems = await tx.query.lineItems.findMany({
      where: eq(lineItems.tabId, tabId)
    })

    // Calculate totals
    const subtotal = allLineItems.reduce((sum, item) => 
      sum + parseFloat(item.total), 0
    )
    
    // Simple tax calculation - in real app, this would be more sophisticated
    const taxAmount = subtotal * 0.08 // 8% tax
    const totalAmount = subtotal + taxAmount

    // Update tab
    await tx
      .update(tabs)
      .set({
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(tabs.id, tabId))
  }

  /**
   * Get all line items for a tab with protection info
   */
  static async getTabLineItems(
    tabId: string,
    organizationId: string
  ): Promise<LineItemWithProtection[]> {
    try {
      // Verify tab access
      const tab = await db.query.tabs.findFirst({
        where: and(
          eq(tabs.id, tabId),
          eq(tabs.organizationId, organizationId)
        )
      })

      if (!tab) {
        throw new ValidationError('Tab not found or you do not have access to it')
      }

      // Get all line items for the tab
      const tabLineItems = await db.query.lineItems.findMany({
        where: eq(lineItems.tabId, tabId),
        orderBy: (lineItems, { asc }) => [asc(lineItems.createdAt)]
      })

      // Get protection info for each line item
      const results = await Promise.all(
        tabLineItems.map(async (item) => {
          try {
            return await this.getLineItemWithProtection(item.id, organizationId)
          } catch (error) {
            // If we can't get protection info, assume it's unprotected
            logger.warn('Could not get protection info for line item', {
              lineItemId: item.id,
              error
            })
            
            return {
              id: item.id,
              tabId: item.tabId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              billingGroupId: item.billingGroupId,
              metadata: (item.metadata as Record<string, any>) || {},
              createdAt: item.createdAt,
              paymentStatus: 'unpaid' as const,
              canEdit: true,
              canDelete: true,
              protectionReasons: []
            }
          }
        })
      )

      return results
    } catch (error) {
      logger.error('Failed to get tab line items', error as Error, {
        tabId,
        organizationId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to get tab line items', error)
    }
  }
}