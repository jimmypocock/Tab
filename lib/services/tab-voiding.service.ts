import { db } from '@/lib/db'
import { tabs, payments, invoices, billingGroups, lineItems } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { DatabaseError, ValidationError, UnauthorizedError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface VoidingBlocker {
  type: 'payment' | 'invoice' | 'billing_group'
  count: number
  message: string
  details?: any[]
}

export interface VoidingValidationResult {
  canVoid: boolean
  blockers: VoidingBlocker[]
  warnings: string[]
  tab: {
    id: string
    externalReference: string | null
    customerEmail: string | null
    customerName: string | null
    status: string
    totalAmount: string
    paidAmount: string
    createdAt: Date
  }
}

export interface VoidingAuditEntry {
  tabId: string
  voidedBy: string
  voidedAt: Date
  reason: string
  previousStatus: string
  paymentRefunds: any[]
  invoiceActions: any[]
}

export class TabVoidingService {
  /**
   * Validate if a tab can be safely voided
   */
  static async validateVoiding(
    tabId: string,
    organizationId: string
  ): Promise<VoidingValidationResult> {
    try {
      // Get the tab with related data
      const tab = await db.query.tabs.findFirst({
        where: and(
          eq(tabs.id, tabId),
          eq(tabs.organizationId, organizationId)
        ),
        with: {
          payments: {
            where: eq(payments.status, 'succeeded')
          },
          billingGroups: {
            with: {
              invoice: true
            }
          },
          lineItems: true
        }
      })

      if (!tab) {
        throw new ValidationError('Tab not found')
      }

      // Cannot void already voided tabs
      if (tab.status === 'void') {
        throw new ValidationError('Tab is already voided')
      }

      const blockers: VoidingBlocker[] = []
      const warnings: string[] = []

      // Check 1: Successful payments exist
      const successfulPayments = tab.payments || []
      if (successfulPayments.length > 0) {
        const totalPaid = successfulPayments.reduce((sum, payment) => 
          sum + parseFloat(payment.amount), 0
        )
        
        blockers.push({
          type: 'payment',
          count: successfulPayments.length,
          message: `Cannot void tab with ${successfulPayments.length} successful payment(s) totaling $${totalPaid.toFixed(2)}. Payments must be refunded first.`,
          details: successfulPayments.map(p => ({
            id: p.id,
            amount: p.amount,
            processor: p.processor,
            processorPaymentId: p.processorPaymentId
          }))
        })
      }

      // Check 2: Invoices with payments
      const paidInvoices = (tab.billingGroups || [])
        .filter(bg => bg.invoice && parseFloat(bg.invoice.paidAmount || '0') > 0)

      if (paidInvoices.length > 0) {
        const totalInvoicePaid = paidInvoices.reduce((sum, bg) => 
          sum + parseFloat(bg.invoice!.paidAmount || '0'), 0
        )
        
        blockers.push({
          type: 'invoice',
          count: paidInvoices.length,
          message: `Cannot void tab with ${paidInvoices.length} paid invoice(s) totaling $${totalInvoicePaid.toFixed(2)}. Invoice payments must be handled first.`,
          details: paidInvoices.map(bg => ({
            invoiceId: bg.invoice!.id,
            invoiceNumber: bg.invoice!.invoiceNumber,
            paidAmount: bg.invoice!.paidAmount
          }))
        })
      }

      // Check 3: Billing groups with complex relationships
      const activeBillingGroups = (tab.billingGroups || [])
        .filter(bg => bg.status === 'active')

      if (activeBillingGroups.length > 0) {
        warnings.push(`${activeBillingGroups.length} active billing group(s) will be closed when tab is voided.`)
      }

      // Warnings for unpaid line items
      const unpaidLineItems = tab.lineItems || []
      if (unpaidLineItems.length > 0) {
        const totalUnpaid = unpaidLineItems.reduce((sum, item) => sum + parseFloat(item.total), 0)
        warnings.push(`${unpaidLineItems.length} line item(s) totaling $${totalUnpaid.toFixed(2)} will become uncollectible when voided.`)
      }

      return {
        canVoid: blockers.length === 0,
        blockers,
        warnings,
        tab: {
          id: tab.id,
          externalReference: tab.externalReference,
          customerEmail: tab.customerEmail,
          customerName: tab.customerName,
          status: tab.status,
          totalAmount: tab.totalAmount,
          paidAmount: tab.paidAmount,
          createdAt: tab.createdAt
        }
      }
    } catch (error) {
      logger.error('Failed to validate tab voiding', error as Error, {
        tabId,
        organizationId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to validate tab voiding', error)
    }
  }

  /**
   * Void a tab after validation
   */
  static async voidTab(
    tabId: string,
    organizationId: string,
    userId: string,
    reason: string,
    options: {
      skipValidation?: boolean
      closeActiveBillingGroups?: boolean
      voidDraftInvoices?: boolean
    } = {}
  ): Promise<VoidingAuditEntry> {
    try {
      // Validate voiding unless explicitly skipped
      let validation: VoidingValidationResult | null = null
      if (!options.skipValidation) {
        validation = await this.validateVoiding(tabId, organizationId)
        
        if (!validation.canVoid) {
          const blockerMessages = validation.blockers.map(b => b.message).join('; ')
          throw new ValidationError(`Cannot void tab: ${blockerMessages}`)
        }
      }

      const auditEntry: VoidingAuditEntry = {
        tabId,
        voidedBy: userId,
        voidedAt: new Date(),
        reason,
        previousStatus: '',
        paymentRefunds: [],
        invoiceActions: []
      }

      await db.transaction(async (tx) => {
        // Get current tab status
        const currentTab = await tx.query.tabs.findFirst({
          where: eq(tabs.id, tabId),
          with: {
            billingGroups: {
              with: {
                invoice: true
              }
            }
          }
        })

        if (!currentTab) {
          throw new ValidationError('Tab not found')
        }

        auditEntry.previousStatus = currentTab.status

        // Handle billing groups
        if (options.closeActiveBillingGroups) {
          const activeBillingGroups = currentTab.billingGroups.filter(bg => bg.status === 'active')
          
          for (const billingGroup of activeBillingGroups) {
            await tx
              .update(billingGroups)
              .set({ 
                status: 'closed',
                updatedAt: new Date()
              })
              .where(eq(billingGroups.id, billingGroup.id))

            logger.info('Billing group closed due to tab voiding', {
              billingGroupId: billingGroup.id,
              tabId,
              voidedBy: userId
            })
          }
        }

        // Handle draft invoices
        if (options.voidDraftInvoices) {
          const draftInvoices = currentTab.billingGroups
            .filter(bg => bg.invoice && bg.invoice.status === 'draft')
            .map(bg => bg.invoice!)

          for (const invoice of draftInvoices) {
            await tx
              .update(invoices)
              .set({ 
                status: 'void',
                updatedAt: new Date()
              })
              .where(eq(invoices.id, invoice.id))

            auditEntry.invoiceActions.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              action: 'voided',
              previousStatus: 'draft'
            })

            logger.info('Draft invoice voided due to tab voiding', {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              tabId,
              voidedBy: userId
            })
          }
        }

        // Finally, void the tab
        await tx
          .update(tabs)
          .set({
            status: 'void',
            updatedAt: new Date(),
            metadata: {
              ...((currentTab.metadata as any) || {}),
              voidedAt: auditEntry.voidedAt.toISOString(),
              voidedBy: userId,
              voidReason: reason,
              previousStatus: auditEntry.previousStatus
            }
          })
          .where(eq(tabs.id, tabId))

        logger.info('Tab voided successfully', {
          tabId,
          organizationId,
          userId,
          reason,
          previousStatus: auditEntry.previousStatus
        })
      })

      return auditEntry
    } catch (error) {
      logger.error('Failed to void tab', error as Error, {
        tabId,
        organizationId,
        userId,
        reason
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to void tab', error)
    }
  }

  /**
   * Get voiding history for a tab
   */
  static async getVoidingHistory(
    tabId: string,
    organizationId: string
  ): Promise<any> {
    try {
      const tab = await db.query.tabs.findFirst({
        where: and(
          eq(tabs.id, tabId),
          eq(tabs.organizationId, organizationId)
        )
      })

      if (!tab) {
        throw new ValidationError('Tab not found')
      }

      const metadata = (tab.metadata as any) || {}
      
      if (tab.status !== 'void') {
        return {
          isVoided: false,
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
          previousStatus: null
        }
      }

      return {
        isVoided: true,
        voidedAt: metadata.voidedAt ? new Date(metadata.voidedAt) : null,
        voidedBy: metadata.voidedBy || null,
        voidReason: metadata.voidReason || null,
        previousStatus: metadata.previousStatus || null
      }
    } catch (error) {
      logger.error('Failed to get voiding history', error as Error, {
        tabId,
        organizationId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to get voiding history', error)
    }
  }

  /**
   * Restore a voided tab (if possible)
   */
  static async restoreVoidedTab(
    tabId: string,
    organizationId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const tab = await tx.query.tabs.findFirst({
          where: and(
            eq(tabs.id, tabId),
            eq(tabs.organizationId, organizationId)
          )
        })

        if (!tab) {
          throw new ValidationError('Tab not found')
        }

        if (tab.status !== 'void') {
          throw new ValidationError('Tab is not voided')
        }

        const metadata = (tab.metadata as any) || {}
        const previousStatus = metadata.previousStatus || 'open'

        // Restore the tab
        await tx
          .update(tabs)
          .set({
            status: previousStatus,
            updatedAt: new Date(),
            metadata: {
              ...metadata,
              restoredAt: new Date().toISOString(),
              restoredBy: userId,
              restoreReason: reason
            }
          })
          .where(eq(tabs.id, tabId))

        logger.info('Voided tab restored', {
          tabId,
          organizationId,
          userId,
          reason,
          restoredToStatus: previousStatus
        })
      })
    } catch (error) {
      logger.error('Failed to restore voided tab', error as Error, {
        tabId,
        organizationId,
        userId,
        reason
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to restore voided tab', error)
    }
  }

  /**
   * Get all voided tabs for an organization (for reporting)
   */
  static async getVoidedTabs(
    organizationId: string,
    options: {
      limit?: number
      offset?: number
      dateFrom?: Date
      dateTo?: Date
    } = {}
  ): Promise<{ tabs: any[]; total: number }> {
    try {
      const { limit = 50, offset = 0, dateFrom, dateTo } = options

      let whereClause = and(
        eq(tabs.organizationId, organizationId),
        eq(tabs.status, 'void')
      )

      // Add date filters if provided
      if (dateFrom || dateTo) {
        // Note: This would need more complex date filtering logic
        // For now, we'll keep it simple
      }

      const voidedTabs = await db.query.tabs.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: (tabs, { desc }) => [desc(tabs.updatedAt)],
        with: {
          lineItems: true
        }
      })

      // Get total count
      const [{ count: totalCount }] = await db
        .select({ count: count() })
        .from(tabs)
        .where(whereClause)

      const transformedTabs = voidedTabs.map(tab => {
        const metadata = (tab.metadata as any) || {}
        return {
          id: tab.id,
          externalReference: tab.externalReference,
          customerEmail: tab.customerEmail,
          customerName: tab.customerName,
          totalAmount: tab.totalAmount,
          lineItemsCount: tab.lineItems?.length || 0,
          createdAt: tab.createdAt,
          voidedAt: metadata.voidedAt ? new Date(metadata.voidedAt) : tab.updatedAt,
          voidedBy: metadata.voidedBy,
          voidReason: metadata.voidReason,
          previousStatus: metadata.previousStatus
        }
      })

      return {
        tabs: transformedTabs,
        total: totalCount
      }
    } catch (error) {
      logger.error('Failed to get voided tabs', error as Error, {
        organizationId
      })
      
      throw new DatabaseError('Failed to get voided tabs', error)
    }
  }
}