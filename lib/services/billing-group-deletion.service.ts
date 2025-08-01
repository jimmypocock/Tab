import { db } from '@/lib/db'
import { billingGroups, lineItems, payments, invoices, invoiceLineItems } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { DatabaseError, ValidationError, UnauthorizedError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface DeletionBlocker {
  type: 'invoice' | 'payment' | 'line_items'
  count: number
  message: string
}

export interface DeletionValidationResult {
  canDelete: boolean
  blockers: DeletionBlocker[]
  warnings: string[]
  billingGroup: any
}

export class BillingGroupDeletionService {
  /**
   * Validate if a billing group can be safely deleted
   */
  static async validateDeletion(
    billingGroupId: string,
    organizationId: string
  ): Promise<DeletionValidationResult> {
    try {
      // Get the billing group with related data
      const billingGroup = await db.query.billingGroups.findFirst({
        where: eq(billingGroups.id, billingGroupId),
        with: {
          invoice: true,
          tab: {
            columns: { organizationId: true }
          },
          lineItems: {
            columns: { id: true, amount: true }
          }
        }
      })

      if (!billingGroup) {
        throw new ValidationError('Billing group not found')
      }

      // Verify organization access
      if (billingGroup.tab?.organizationId !== organizationId) {
        throw new UnauthorizedError('You do not have permission to delete this billing group')
      }

      const blockers: DeletionBlocker[] = []
      const warnings: string[] = []

      // Check 1: Invoice exists and has activity
      if (billingGroup.invoice) {
        const invoice = billingGroup.invoice
        
        // Check if invoice has been paid (partially or fully)
        if (invoice.paidAmount && parseFloat(invoice.paidAmount) > 0) {
          blockers.push({
            type: 'invoice',
            count: 1,
            message: `Cannot delete billing group with paid invoice (${invoice.invoiceNumber}). Amount paid: $${invoice.paidAmount}`
          })
        }
        
        // Check if invoice is in final states that should be preserved
        if (['paid', 'overdue', 'uncollectible'].includes(invoice.status)) {
          blockers.push({
            type: 'invoice',
            count: 1,
            message: `Cannot delete billing group with invoice in '${invoice.status}' status. This must be preserved for audit purposes.`
          })
        }

        // Warning for draft invoices
        if (invoice.status === 'draft' && parseFloat(invoice.totalAmount) > 0) {
          warnings.push(`Invoice ${invoice.invoiceNumber} is in draft status with amount $${invoice.totalAmount}. It will be deleted.`)
        }
      }

      // Check 2: Successful payments exist
      const successfulPayments = await db
        .select({ count: count() })
        .from(payments)
        .where(
          and(
            eq(payments.billingGroupId, billingGroupId),
            eq(payments.status, 'succeeded')
          )
        )

      if (successfulPayments[0]?.count > 0) {
        blockers.push({
          type: 'payment',
          count: successfulPayments[0].count,
          message: `Cannot delete billing group with ${successfulPayments[0].count} successful payment(s). These must be preserved for financial records.`
        })
      }

      // Check 3: Line items with payments
      const lineItemsWithPayments = await db.query.lineItems.findMany({
        where: eq(lineItems.billingGroupId, billingGroupId),
        with: {
          tab: {
            with: {
              payments: {
                where: eq(payments.status, 'succeeded')
              }
            }
          }
        }
      })

      const paidLineItems = lineItemsWithPayments.filter(item => 
        item.tab?.payments && item.tab.payments.length > 0
      )

      if (paidLineItems.length > 0) {
        const totalPaidAmount = paidLineItems.reduce((sum, item) => 
          sum + parseFloat(item.amount), 0
        )
        
        blockers.push({
          type: 'line_items',
          count: paidLineItems.length,
          message: `Cannot delete billing group with ${paidLineItems.length} paid line item(s) totaling $${totalPaidAmount.toFixed(2)}. These must be preserved for audit purposes.`
        })
      }

      // Warnings for unpaid line items
      const unpaidLineItems = billingGroup.lineItems?.filter(item => 
        !paidLineItems.find(paid => paid.id === item.id)
      ) || []

      if (unpaidLineItems.length > 0) {
        const totalAmount = unpaidLineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0)
        warnings.push(`${unpaidLineItems.length} unpaid line item(s) totaling $${totalAmount.toFixed(2)} will be moved to the default billing group.`)
      }

      return {
        canDelete: blockers.length === 0,
        blockers,
        warnings,
        billingGroup: {
          id: billingGroup.id,
          name: billingGroup.name,
          groupType: billingGroup.groupType,
          status: billingGroup.status,
          invoiceId: billingGroup.invoiceId
        }
      }
    } catch (error) {
      logger.error('Failed to validate billing group deletion', error as Error, {
        billingGroupId,
        organizationId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to validate billing group deletion', error)
    }
  }

  /**
   * Delete a billing group after validation
   */
  static async deleteBillingGroup(
    billingGroupId: string,
    organizationId: string,
    userId: string,
    options: {
      skipValidation?: boolean
      moveLineItemsToGroupId?: string
    } = {}
  ): Promise<void> {
    try {
      // Validate deletion unless explicitly skipped
      if (!options.skipValidation) {
        const validation = await this.validateDeletion(billingGroupId, organizationId)
        
        if (!validation.canDelete) {
          const blockerMessages = validation.blockers.map(b => b.message).join('; ')
          throw new ValidationError(`Cannot delete billing group: ${blockerMessages}`)
        }
      }

      await db.transaction(async (tx) => {
        // Get billing group details
        const billingGroup = await tx.query.billingGroups.findFirst({
          where: eq(billingGroups.id, billingGroupId),
          with: {
            invoice: true,
            lineItems: true,
            tab: true
          }
        })

        if (!billingGroup) {
          throw new ValidationError('Billing group not found')
        }

        // Handle line items - move to another group or default
        if (billingGroup.lineItems && billingGroup.lineItems.length > 0) {
          const targetGroupId = options.moveLineItemsToGroupId || null

          await tx
            .update(lineItems)
            .set({ 
              billingGroupId: targetGroupId,
              updatedAt: new Date()
            })
            .where(eq(lineItems.billingGroupId, billingGroupId))

          logger.info('Moved line items from deleted billing group', {
            billingGroupId,
            lineItemCount: billingGroup.lineItems.length,
            targetGroupId
          })
        }

        // Delete associated draft invoice if it exists
        if (billingGroup.invoice && billingGroup.invoice.status === 'draft') {
          // Delete invoice line items first (cascade should handle this, but be explicit)
          await tx
            .delete(invoiceLineItems)
            .where(eq(invoiceLineItems.invoiceId, billingGroup.invoice.id))

          // Delete the invoice
          await tx
            .delete(invoices)
            .where(eq(invoices.id, billingGroup.invoice.id))

          logger.info('Deleted draft invoice with billing group', {
            billingGroupId,
            invoiceId: billingGroup.invoice.id,
            invoiceNumber: billingGroup.invoice.invoiceNumber
          })
        }

        // Finally, delete the billing group
        await tx
          .delete(billingGroups)
          .where(eq(billingGroups.id, billingGroupId))

        logger.info('Billing group deleted successfully', {
          billingGroupId,
          organizationId,
          userId,
          groupName: billingGroup.name
        })
      })
    } catch (error) {
      logger.error('Failed to delete billing group', error as Error, {
        billingGroupId,
        organizationId,
        userId
      })
      
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error
      }
      
      throw new DatabaseError('Failed to delete billing group', error)
    }
  }

  /**
   * Get the default billing group for a tab (creates one if needed)
   */
  static async getOrCreateDefaultBillingGroup(
    tabId: string,
    organizationId: string
  ): Promise<string> {
    try {
      // Look for existing default billing group
      const defaultGroup = await db.query.billingGroups.findFirst({
        where: and(
          eq(billingGroups.tabId, tabId),
          eq(billingGroups.groupType, 'default')
        )
      })

      if (defaultGroup) {
        return defaultGroup.id
      }

      // Create a new default billing group
      const [newGroup] = await db
        .insert(billingGroups)
        .values({
          tabId,
          groupNumber: 'DEFAULT',
          name: 'Default Group',
          groupType: 'default',
          status: 'active'
        })
        .returning({ id: billingGroups.id })

      logger.info('Created default billing group', {
        tabId,
        organizationId,
        billingGroupId: newGroup.id
      })

      return newGroup.id
    } catch (error) {
      logger.error('Failed to get or create default billing group', error as Error, {
        tabId,
        organizationId
      })
      
      throw new DatabaseError('Failed to get or create default billing group', error)
    }
  }
}