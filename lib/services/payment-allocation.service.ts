import { db } from '@/lib/db'
import {
  invoices,
  invoiceLineItems,
  paymentAllocations,
  payments,
  type Invoice,
  type InvoiceLineItem,
  type Payment,
  type NewPaymentAllocation,
} from '@/lib/db/schema'
import { eq, and, desc, asc, sql, gt } from 'drizzle-orm'

export type AllocationMethod = 'fifo' | 'proportional' | 'manual' | 'priority'

export interface PaymentAllocationResult {
  allocations: {
    lineItemId: string
    amount: number
  }[]
  totalAllocated: number
  unallocatedAmount: number
}

export interface ManualAllocation {
  lineItemId: string
  amount: number
}

export class PaymentAllocationService {
  /**
   * Allocate a payment to an invoice using the specified method
   */
  static async allocatePayment(
    paymentId: string,
    invoiceId: string,
    amount: number,
    method: AllocationMethod = 'fifo',
    manualAllocations?: ManualAllocation[]
  ): Promise<PaymentAllocationResult> {
    // Validate payment exists
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)
    
    if (!payment) {
      throw new Error('Payment not found')
    }
    
    // Get invoice and line items
    const invoiceData = await this.getInvoiceWithLineItems(invoiceId)
    if (!invoiceData) {
      throw new Error('Invoice not found')
    }
    
    // Perform allocation based on method
    let result: PaymentAllocationResult
    
    switch (method) {
      case 'fifo':
        result = await this.allocateFIFO(paymentId, invoiceId, amount, invoiceData.lineItems)
        break
      case 'proportional':
        result = await this.allocateProportional(paymentId, invoiceId, amount, invoiceData.lineItems)
        break
      case 'manual':
        if (!manualAllocations) {
          throw new Error('Manual allocations required for manual method')
        }
        result = await this.allocateManual(paymentId, invoiceId, manualAllocations, invoiceData.lineItems)
        break
      case 'priority':
        result = await this.allocatePriority(paymentId, invoiceId, amount, invoiceData.lineItems)
        break
      default:
        throw new Error(`Unknown allocation method: ${method}`)
    }
    
    // Update invoice paid amount and status
    await this.updateInvoicePaymentStatus(invoiceId)
    
    return result
  }

  /**
   * FIFO Allocation - Pay oldest line items first
   */
  private static async allocateFIFO(
    paymentId: string,
    invoiceId: string,
    amount: number,
    lineItems: InvoiceLineItem[]
  ): Promise<PaymentAllocationResult> {
    let remainingAmount = amount
    const allocations: { lineItemId: string; amount: number }[] = []
    
    // Sort by line number (oldest first)
    const sortedItems = lineItems.sort((a, b) => a.lineNumber - b.lineNumber)
    
    for (const item of sortedItems) {
      if (remainingAmount <= 0) break
      
      const remainingOnItem = parseFloat(item.remainingAmount)
      if (remainingOnItem <= 0) continue
      
      const allocationAmount = Math.min(remainingAmount, remainingOnItem)
      
      // Create allocation record
      await db.insert(paymentAllocations).values({
        paymentId,
        invoiceId,
        invoiceLineItemId: item.id,
        amount: allocationAmount.toFixed(2),
        allocationMethod: 'fifo',
      })
      
      // Update line item allocated amount
      await db
        .update(invoiceLineItems)
        .set({
          allocatedAmount: sql`${invoiceLineItems.allocatedAmount} + ${allocationAmount}`,
        })
        .where(eq(invoiceLineItems.id, item.id))
      
      allocations.push({
        lineItemId: item.id,
        amount: allocationAmount,
      })
      
      remainingAmount -= allocationAmount
    }
    
    return {
      allocations,
      totalAllocated: amount - remainingAmount,
      unallocatedAmount: remainingAmount,
    }
  }

  /**
   * Proportional Allocation - Distribute payment proportionally across all items
   */
  private static async allocateProportional(
    paymentId: string,
    invoiceId: string,
    amount: number,
    lineItems: InvoiceLineItem[]
  ): Promise<PaymentAllocationResult> {
    const allocations: { lineItemId: string; amount: number }[] = []
    
    // Calculate total remaining amount across all items
    const totalRemaining = lineItems.reduce(
      (sum, item) => sum + parseFloat(item.remainingAmount),
      0
    )
    
    if (totalRemaining === 0) {
      return {
        allocations: [],
        totalAllocated: 0,
        unallocatedAmount: amount,
      }
    }
    
    let totalAllocated = 0
    
    for (const item of lineItems) {
      const remainingOnItem = parseFloat(item.remainingAmount)
      if (remainingOnItem <= 0) continue
      
      // Calculate proportional amount
      const proportion = remainingOnItem / totalRemaining
      const proportionalAmount = amount * proportion
      const allocationAmount = Math.min(proportionalAmount, remainingOnItem)
      
      // Create allocation record
      await db.insert(paymentAllocations).values({
        paymentId,
        invoiceId,
        invoiceLineItemId: item.id,
        amount: allocationAmount.toFixed(2),
        allocationMethod: 'proportional',
      })
      
      // Update line item allocated amount
      await db
        .update(invoiceLineItems)
        .set({
          allocatedAmount: sql`${invoiceLineItems.allocatedAmount} + ${allocationAmount}`,
        })
        .where(eq(invoiceLineItems.id, item.id))
      
      allocations.push({
        lineItemId: item.id,
        amount: allocationAmount,
      })
      
      totalAllocated += allocationAmount
    }
    
    return {
      allocations,
      totalAllocated,
      unallocatedAmount: amount - totalAllocated,
    }
  }

  /**
   * Manual Allocation - Allocate specific amounts to specific line items
   */
  private static async allocateManual(
    paymentId: string,
    invoiceId: string,
    manualAllocations: ManualAllocation[],
    lineItems: InvoiceLineItem[]
  ): Promise<PaymentAllocationResult> {
    const allocations: { lineItemId: string; amount: number }[] = []
    let totalAllocated = 0
    
    for (const allocation of manualAllocations) {
      const lineItem = lineItems.find(item => item.id === allocation.lineItemId)
      if (!lineItem) {
        throw new Error(`Line item ${allocation.lineItemId} not found`)
      }
      
      const remainingOnItem = parseFloat(lineItem.remainingAmount)
      if (allocation.amount > remainingOnItem) {
        throw new Error(
          `Cannot allocate ${allocation.amount} to line item ${lineItem.id}. ` +
          `Only ${remainingOnItem} remaining.`
        )
      }
      
      // Create allocation record
      await db.insert(paymentAllocations).values({
        paymentId,
        invoiceId,
        invoiceLineItemId: lineItem.id,
        amount: allocation.amount.toFixed(2),
        allocationMethod: 'manual',
      })
      
      // Update line item allocated amount
      await db
        .update(invoiceLineItems)
        .set({
          allocatedAmount: sql`${invoiceLineItems.allocatedAmount} + ${allocation.amount}`,
        })
        .where(eq(invoiceLineItems.id, lineItem.id))
      
      allocations.push({
        lineItemId: lineItem.id,
        amount: allocation.amount,
      })
      
      totalAllocated += allocation.amount
    }
    
    const totalRequested = manualAllocations.reduce((sum, a) => sum + a.amount, 0)
    
    return {
      allocations,
      totalAllocated,
      unallocatedAmount: totalRequested - totalAllocated,
    }
  }

  /**
   * Priority Allocation - Allocate based on priority rules (e.g., taxes first)
   */
  private static async allocatePriority(
    paymentId: string,
    invoiceId: string,
    amount: number,
    lineItems: InvoiceLineItem[]
  ): Promise<PaymentAllocationResult> {
    let remainingAmount = amount
    const allocations: { lineItemId: string; amount: number }[] = []
    
    // Define priority order
    const priorityOrder = ['tax', 'fee', 'service', 'product']
    
    // Sort items by priority
    const sortedItems = lineItems.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.category || 'product')
      const bPriority = priorityOrder.indexOf(b.category || 'product')
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // Within same priority, use line number
      return a.lineNumber - b.lineNumber
    })
    
    for (const item of sortedItems) {
      if (remainingAmount <= 0) break
      
      const remainingOnItem = parseFloat(item.remainingAmount)
      if (remainingOnItem <= 0) continue
      
      const allocationAmount = Math.min(remainingAmount, remainingOnItem)
      
      // Create allocation record
      await db.insert(paymentAllocations).values({
        paymentId,
        invoiceId,
        invoiceLineItemId: item.id,
        amount: allocationAmount.toFixed(2),
        allocationMethod: 'priority',
      })
      
      // Update line item allocated amount
      await db
        .update(invoiceLineItems)
        .set({
          allocatedAmount: sql`${invoiceLineItems.allocatedAmount} + ${allocationAmount}`,
        })
        .where(eq(invoiceLineItems.id, item.id))
      
      allocations.push({
        lineItemId: item.id,
        amount: allocationAmount,
      })
      
      remainingAmount -= allocationAmount
    }
    
    return {
      allocations,
      totalAllocated: amount - remainingAmount,
      unallocatedAmount: remainingAmount,
    }
  }

  /**
   * Get invoice with line items
   */
  private static async getInvoiceWithLineItems(invoiceId: string): Promise<{
    invoice: Invoice
    lineItems: InvoiceLineItem[]
  } | null> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    
    if (!invoice) {
      return null
    }
    
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.lineNumber)
    
    return { invoice, lineItems }
  }

  /**
   * Update invoice payment status based on allocations
   */
  private static async updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
    // Get updated invoice totals
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    
    if (!invoice) return
    
    // Calculate total allocated
    const allocationsResult = await db
      .select({
        totalAllocated: sql<number>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
      })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId))
    
    const totalAllocated = parseFloat(allocationsResult[0]?.totalAllocated.toString() || '0')
    const totalAmount = parseFloat(invoice.totalAmount)
    
    // Update invoice paid amount
    await db
      .update(invoices)
      .set({
        paidAmount: totalAllocated.toFixed(2),
      })
      .where(eq(invoices.id, invoiceId))
    
    // Update status if needed
    if (totalAllocated >= totalAmount) {
      await db
        .update(invoices)
        .set({
          status: 'paid',
          paidAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
    } else if (totalAllocated > 0 && invoice.status !== 'partial') {
      await db
        .update(invoices)
        .set({
          status: 'partial',
        })
        .where(eq(invoices.id, invoiceId))
    }
  }

  /**
   * Reverse a payment allocation (for refunds)
   */
  static async reversePaymentAllocations(paymentId: string): Promise<void> {
    // Get all allocations for this payment
    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId))
    
    // Reverse each allocation
    for (const allocation of allocations) {
      // Update line item allocated amount
      await db
        .update(invoiceLineItems)
        .set({
          allocatedAmount: sql`${invoiceLineItems.allocatedAmount} - ${allocation.amount}`,
        })
        .where(eq(invoiceLineItems.id, allocation.invoiceLineItemId!))
      
      // Delete allocation record
      await db
        .delete(paymentAllocations)
        .where(eq(paymentAllocations.id, allocation.id))
    }
    
    // Update invoice status for affected invoices
    const invoiceIds = [...new Set(allocations.map(a => a.invoiceId))]
    for (const invoiceId of invoiceIds) {
      await this.updateInvoicePaymentStatus(invoiceId)
    }
  }

  /**
   * Get allocation details for a payment
   */
  static async getPaymentAllocations(paymentId: string): Promise<{
    payment: Payment
    allocations: {
      allocation: typeof paymentAllocations.$inferSelect
      lineItem: InvoiceLineItem
      invoice: Invoice
    }[]
  } | null> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)
    
    if (!payment) {
      return null
    }
    
    const allocationsData = await db
      .select({
        allocation: paymentAllocations,
        lineItem: invoiceLineItems,
        invoice: invoices,
      })
      .from(paymentAllocations)
      .innerJoin(
        invoiceLineItems,
        eq(paymentAllocations.invoiceLineItemId, invoiceLineItems.id)
      )
      .innerJoin(
        invoices,
        eq(paymentAllocations.invoiceId, invoices.id)
      )
      .where(eq(paymentAllocations.paymentId, paymentId))
    
    return {
      payment,
      allocations: allocationsData,
    }
  }
}