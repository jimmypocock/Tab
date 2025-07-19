import { db } from '@/lib/db/client'
import { tabs, lineItems, Tab, LineItem } from '@/lib/db/schema'
import { CreateTabInput, UpdateTabInput } from '@/lib/api/validation'
import { calculateTabBalance, getTabStatus, TAX_RATE } from '@/lib/utils'
import { DatabaseError, NotFoundError, ConflictError } from '@/lib/errors'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface TabWithItems extends Tab {
  lineItems: LineItem[]
  balance?: number
  computedStatus?: string
}

export class TabsService {
  async createTab(
    merchantId: string,
    data: CreateTabInput
  ): Promise<TabWithItems> {
    const taxRate = data.taxRate ?? TAX_RATE

    try {
      // Calculate totals
      let subtotal = 0
      const lineItemsData = data.lineItems.map(item => {
        const total = item.quantity * item.unitPrice
        subtotal += total
        return {
          ...item,
          total: total.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          metadata: item.metadata || null,
        }
      })

      // Calculate tax and total
      const taxAmount = subtotal * taxRate
      const totalAmount = subtotal + taxAmount

      // Create tab with line items in a transaction
      const result = await db.transaction(async (tx) => {
        // Create the tab
        const [newTab] = await tx.insert(tabs).values({
          merchantId,
          customerEmail: data.customerEmail,
          customerName: data.customerName || null,
          externalReference: data.externalReference || null,
          currency: data.currency,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          metadata: data.metadata || null,
        }).returning()

        if (!newTab) {
          throw new Error('Failed to create tab')
        }

        // Create line items
        if (lineItemsData.length > 0) {
          const insertedItems = await tx.insert(lineItems).values(
            lineItemsData.map(item => ({
              tabId: newTab.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              metadata: item.metadata,
            }))
          ).returning()

          return {
            ...newTab,
            lineItems: insertedItems,
          }
        }

        return {
          ...newTab,
          lineItems: [],
        }
      })

      logger.info('Tab created', {
        tabId: result.id,
        merchantId,
        totalAmount: totalAmount.toFixed(2),
      })

      return result
    } catch (error) {
      logger.error('Failed to create tab', error as Error, { merchantId })
      throw new DatabaseError('Failed to create tab', error)
    }
  }

  async getTab(
    tabId: string,
    merchantId: string
  ): Promise<TabWithItems | null> {
    try {
      const tab = await db.query.tabs.findFirst({
        where: and(
          eq(tabs.id, tabId),
          eq(tabs.merchantId, merchantId)
        ),
        with: {
          lineItems: {
            orderBy: (lineItems, { asc }) => [asc(lineItems.createdAt)],
          },
          payments: {
            where: (payments, { eq }) => eq(payments.status, 'succeeded'),
          },
        },
      })

      if (!tab) return null

      // Add computed fields
      return {
        ...tab,
        balance: calculateTabBalance(tab.totalAmount, tab.paidAmount),
        computedStatus: getTabStatus(tab.totalAmount, tab.paidAmount, tab.status),
      }
    } catch (error) {
      logger.error('Failed to fetch tab', error as Error, { tabId, merchantId })
      throw new DatabaseError('Failed to fetch tab', error)
    }
  }

  async updateTab(
    tabId: string,
    merchantId: string,
    data: UpdateTabInput
  ): Promise<TabWithItems> {
    try {
      // Check if tab exists and belongs to merchant
      const existingTab = await this.getTab(tabId, merchantId)
      if (!existingTab) {
        throw new NotFoundError('Tab')
      }

      // Validate status transitions
      if (data.status) {
        this.validateStatusTransition(existingTab.status, data.status)
      }

      // Update tab
      const [updatedTab] = await db
        .update(tabs)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tabs.id, tabId),
            eq(tabs.merchantId, merchantId)
          )
        )
        .returning()

      if (!updatedTab) {
        throw new DatabaseError('Failed to update tab')
      }

      // Fetch complete updated tab
      const completeTab = await this.getTab(updatedTab.id, merchantId)
      if (!completeTab) {
        throw new DatabaseError('Failed to fetch updated tab')
      }

      logger.info('Tab updated', {
        tabId,
        merchantId,
        updates: Object.keys(data),
      })

      return completeTab
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error
      }
      logger.error('Failed to update tab', error as Error, { tabId, merchantId })
      throw new DatabaseError('Failed to update tab', error)
    }
  }

  async deleteTab(
    tabId: string,
    merchantId: string
  ): Promise<void> {
    try {
      // Check if tab exists and can be deleted
      const tab = await this.getTab(tabId, merchantId)
      if (!tab) {
        throw new NotFoundError('Tab')
      }

      if (tab.status === 'paid' || tab.status === 'partial') {
        throw new ConflictError('Cannot delete a tab with payments')
      }

      // Delete tab (line items will cascade)
      await db
        .delete(tabs)
        .where(
          and(
            eq(tabs.id, tabId),
            eq(tabs.merchantId, merchantId)
          )
        )

      logger.info('Tab deleted', { tabId, merchantId })
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error
      }
      logger.error('Failed to delete tab', error as Error, { tabId, merchantId })
      throw new DatabaseError('Failed to delete tab', error)
    }
  }

  async updateTabPaymentStatus(
    tabId: string,
    paidAmount: number
  ): Promise<void> {
    try {
      const tab = await db.query.tabs.findFirst({
        where: eq(tabs.id, tabId),
      })

      if (!tab) {
        throw new NotFoundError('Tab')
      }

      const newPaidAmount = parseFloat(tab.paidAmount) + paidAmount
      const status = getTabStatus(tab.totalAmount, newPaidAmount.toString())

      await db
        .update(tabs)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status,
          updatedAt: new Date(),
        })
        .where(eq(tabs.id, tabId))

      logger.info('Tab payment status updated', {
        tabId,
        paidAmount,
        newStatus: status,
      })
    } catch (error) {
      logger.error('Failed to update tab payment status', error as Error, { tabId })
      throw new DatabaseError('Failed to update tab payment status', error)
    }
  }

  private validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): void {
    const validTransitions: Record<string, string[]> = {
      open: ['partial', 'paid', 'void'],
      partial: ['paid', 'void'],
      paid: ['void'],
      void: [],
    }

    const allowed = validTransitions[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      )
    }
  }
}

// Export singleton instance
export const tabsService = new TabsService()