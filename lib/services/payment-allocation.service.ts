import { db } from '@/lib/db'
import {
  payments,
  billingGroups,
  lineItems,
  tabs,
  type Payment,
  type BillingGroup,
  type LineItem,
} from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface PaymentAllocation {
  billingGroupId: string
  amount: number
  lineItemAllocations?: Array<{
    lineItemId: string
    amount: number
  }>
}

export interface AllocationResult {
  payment: Payment
  allocations: PaymentAllocation[]
  updatedGroups: BillingGroup[]
}

export class PaymentAllocationService {
  /**
   * Allocate a payment to specific billing groups
   */
  static async allocatePaymentToBillingGroups(
    paymentId: string,
    billingGroupIds: string[],
    allocationMethod: 'proportional' | 'fifo' | 'equal' = 'proportional'
  ): Promise<AllocationResult> {
    return await db.transaction(async (tx) => {
      // Get payment details
      const payment = await tx.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      })

      if (!payment) {
        throw new Error('Payment not found')
      }

      // Get billing groups with their line items
      const groups = await tx.query.billingGroups.findMany({
        where: inArray(billingGroups.id, billingGroupIds),
        with: {
          lineItems: true,
        },
      })

      if (groups.length === 0) {
        throw new Error('No billing groups found')
      }

      // Calculate allocations based on method
      const allocations = await this.calculateAllocations(
        payment,
        groups,
        allocationMethod
      )

      // Update billing group balances
      const updatedGroups: BillingGroup[] = []
      
      for (const allocation of allocations) {
        const group = groups.find(g => g.id === allocation.billingGroupId)
        if (!group) continue

        const newBalance = parseFloat(group.currentBalance) - allocation.amount

        const [updatedGroup] = await tx
          .update(billingGroups)
          .set({
            currentBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(billingGroups.id, allocation.billingGroupId))
          .returning()

        updatedGroups.push(updatedGroup)

        // Update line item allocations if provided
        if (allocation.lineItemAllocations) {
          for (const itemAllocation of allocation.lineItemAllocations) {
            await tx
              .update(lineItems)
              .set({
                metadata: sql`
                  COALESCE(metadata, '{}'::jsonb) || 
                  jsonb_build_object(
                    'allocations', 
                    COALESCE(metadata->'allocations', '[]'::jsonb) || 
                    ${JSON.stringify([{
                      paymentId,
                      amount: itemAllocation.amount,
                      date: new Date().toISOString(),
                    }])}::jsonb
                  )
                `,
              })
              .where(eq(lineItems.id, itemAllocation.lineItemId))
          }
        }
      }

      // Store allocation details in payment metadata
      await tx
        .update(payments)
        .set({
          metadata: {
            ...payment.metadata,
            billingGroupAllocations: allocations,
            allocationMethod,
            allocatedAt: new Date().toISOString(),
          },
        })
        .where(eq(payments.id, paymentId))

      logger.info('Payment allocated to billing groups', {
        paymentId,
        billingGroupIds,
        allocations,
        method: allocationMethod,
      })

      return {
        payment,
        allocations,
        updatedGroups,
      }
    })
  }

  /**
   * Calculate payment allocations based on method
   */
  private static async calculateAllocations(
    payment: Payment,
    groups: Array<BillingGroup & { lineItems: LineItem[] }>,
    method: 'proportional' | 'fifo' | 'equal'
  ): Promise<PaymentAllocation[]> {
    const paymentAmount = parseFloat(payment.amount)
    const allocations: PaymentAllocation[] = []

    switch (method) {
      case 'proportional': {
        // Calculate total balance across all groups
        const totalBalance = groups.reduce(
          (sum, g) => sum + parseFloat(g.currentBalance),
          0
        )

        if (totalBalance === 0) {
          throw new Error('No balance to allocate payment to')
        }

        // Allocate proportionally based on balance
        let remainingAmount = paymentAmount
        
        for (const group of groups) {
          const groupBalance = parseFloat(group.currentBalance)
          const proportion = groupBalance / totalBalance
          const allocationAmount = Math.min(
            Math.round(paymentAmount * proportion * 100) / 100,
            groupBalance,
            remainingAmount
          )

          if (allocationAmount > 0) {
            allocations.push({
              billingGroupId: group.id,
              amount: allocationAmount,
            })
            remainingAmount -= allocationAmount
          }
        }

        // Allocate any remaining cents to the first group with balance
        if (remainingAmount > 0.01) {
          const firstGroup = allocations[0]
          if (firstGroup) {
            firstGroup.amount += remainingAmount
          }
        }
        break
      }

      case 'fifo': {
        // Allocate to groups in order until payment is exhausted
        let remainingAmount = paymentAmount

        for (const group of groups) {
          if (remainingAmount <= 0) break

          const groupBalance = parseFloat(group.currentBalance)
          const allocationAmount = Math.min(groupBalance, remainingAmount)

          if (allocationAmount > 0) {
            allocations.push({
              billingGroupId: group.id,
              amount: allocationAmount,
            })
            remainingAmount -= allocationAmount
          }
        }
        break
      }

      case 'equal': {
        // Split payment equally among groups
        const equalAmount = Math.floor(paymentAmount / groups.length * 100) / 100
        let remainingAmount = paymentAmount

        for (const group of groups) {
          const groupBalance = parseFloat(group.currentBalance)
          const allocationAmount = Math.min(equalAmount, groupBalance, remainingAmount)

          if (allocationAmount > 0) {
            allocations.push({
              billingGroupId: group.id,
              amount: allocationAmount,
            })
            remainingAmount -= allocationAmount
          }
        }

        // Allocate any remaining cents
        if (remainingAmount > 0.01 && allocations.length > 0) {
          allocations[0].amount += remainingAmount
        }
        break
      }
    }

    return allocations
  }

  /**
   * Allocate payment based on billing group IDs from checkout metadata
   */
  static async allocatePaymentFromCheckout(
    paymentId: string,
    metadata: Record<string, any>
  ): Promise<AllocationResult | null> {
    const billingGroupIds = metadata.billingGroupIds?.split(',').filter(Boolean) || []
    
    if (billingGroupIds.length === 0) {
      // No specific billing groups - payment applies to full tab
      return null
    }

    // Default to proportional allocation from checkout
    return await this.allocatePaymentToBillingGroups(
      paymentId,
      billingGroupIds,
      'proportional'
    )
  }

  /**
   * Get payment allocation summary for a tab
   */
  static async getTabPaymentAllocations(tabId: string) {
    const tabPayments = await db.query.payments.findMany({
      where: eq(payments.tabId, tabId),
      orderBy: (payments, { desc }) => [desc(payments.createdAt)],
    })

    const allocations = tabPayments
      .filter(p => p.metadata?.billingGroupAllocations)
      .map(p => ({
        paymentId: p.id,
        amount: p.amount,
        createdAt: p.createdAt,
        allocations: p.metadata.billingGroupAllocations as PaymentAllocation[],
        method: p.metadata.allocationMethod as string,
      }))

    return allocations
  }

  /**
   * Reverse a payment allocation (for refunds)
   */
  static async reversePaymentAllocation(paymentId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const payment = await tx.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      })

      if (!payment || !payment.metadata?.billingGroupAllocations) {
        throw new Error('Payment or allocations not found')
      }

      const allocations = payment.metadata.billingGroupAllocations as PaymentAllocation[]

      // Reverse each allocation
      for (const allocation of allocations) {
        const [group] = await tx
          .select()
          .from(billingGroups)
          .where(eq(billingGroups.id, allocation.billingGroupId))
          .limit(1)

        if (group) {
          const newBalance = parseFloat(group.currentBalance) + allocation.amount

          await tx
            .update(billingGroups)
            .set({
              currentBalance: newBalance.toString(),
              updatedAt: new Date(),
            })
            .where(eq(billingGroups.id, allocation.billingGroupId))
        }
      }

      // Update payment metadata
      await tx
        .update(payments)
        .set({
          metadata: {
            ...payment.metadata,
            reversed: true,
            reversedAt: new Date().toISOString(),
          },
        })
        .where(eq(payments.id, paymentId))

      logger.info('Payment allocation reversed', {
        paymentId,
        allocations,
      })
    })
  }
}