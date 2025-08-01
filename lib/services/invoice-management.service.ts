/**
 * Invoice Management Service
 */

import { DITokens } from '@/lib/di/types'
import type { IDIContainer } from '@/lib/di/types'
import { InvoiceRepository } from '@/lib/repositories/invoice.repository'
import { TabRepository } from '@/lib/repositories/tab.repository'
import { BillingGroupRepository } from '@/lib/repositories/billing-group.repository'
import { OrganizationRepository } from '@/lib/repositories/organization.repository'
import { EmailService } from './email.service'
import { ValidationError, BusinessRuleError, NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface CreateInvoiceInput {
  tabId: string
  billingGroupId?: string
  dueDate?: Date
  notes?: string
  metadata?: any
}

export interface SendInvoiceInput {
  recipientEmail: string
  ccEmails?: string[]
  subject?: string
  message?: string
}

export class InvoiceManagementService {
  private invoiceRepo: InvoiceRepository
  private tabRepo: TabRepository
  private billingGroupRepo: BillingGroupRepository
  private organizationRepo: OrganizationRepository
  private emailService: EmailService
  private logger: typeof logger

  constructor(container: IDIContainer) {
    this.invoiceRepo = container.resolve(DITokens.InvoiceRepository)
    this.tabRepo = container.resolve(DITokens.TabRepository)
    this.billingGroupRepo = container.resolve(DITokens.BillingGroupRepository)
    this.organizationRepo = container.resolve(DITokens.OrganizationRepository)
    this.emailService = container.resolve(DITokens.EmailService)
    this.logger = container.resolve(DITokens.Logger)
  }

  /**
   * Create an invoice for a tab
   */
  async createInvoice(
    organizationId: string,
    input: CreateInvoiceInput
  ) {
    // Get the tab
    const tab = await this.tabRepo.findById(input.tabId, organizationId, true)
    if (!tab) {
      throw new NotFoundError('Tab not found')
    }

    // Validate tab can be invoiced
    if (tab.status === 'void') {
      throw new BusinessRuleError('Cannot create invoice for voided tab')
    }

    if (tab.status === 'paid') {
      throw new BusinessRuleError('Tab is already paid')
    }

    // If billing group specified, validate it
    if (input.billingGroupId) {
      const billingGroup = await this.billingGroupRepo.findById(
        input.billingGroupId,
        organizationId
      )
      if (!billingGroup) {
        throw new NotFoundError('Billing group not found')
      }
    }

    // Calculate invoice amount based on line items
    let invoiceAmount = '0.00'
    let lineItemCount = 0

    if (input.billingGroupId) {
      // Sum only line items in this billing group
      const groupItems = tab.lineItems.filter(
        item => item.billingGroupId === input.billingGroupId
      )
      invoiceAmount = groupItems
        .reduce((sum, item) => sum + parseFloat(item.totalPrice), 0)
        .toFixed(2)
      lineItemCount = groupItems.length
    } else {
      // Full tab amount
      invoiceAmount = tab.totalAmount
      lineItemCount = tab.lineItems.length
    }

    if (parseFloat(invoiceAmount) <= 0) {
      throw new BusinessRuleError('Invoice amount must be greater than zero')
    }

    // Create the invoice
    const invoice = await this.invoiceRepo.create({
      organizationId,
      tabId: input.tabId,
      billingGroupId: input.billingGroupId,
      amount: invoiceAmount,
      currency: tab.currency,
      status: 'draft',
      dueDate: input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      customerName: tab.customerName,
      customerEmail: tab.customerEmail,
      customerOrganizationId: tab.customerOrganizationId,
      notes: input.notes,
      metadata: {
        ...input.metadata,
        lineItemCount,
        tabTotal: tab.totalAmount,
      }
    })

    this.logger.info('Invoice created', {
      invoiceId: invoice.id,
      tabId: tab.id,
      amount: invoiceAmount,
      billingGroupId: input.billingGroupId,
    })

    return invoice
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string, organizationId: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId, organizationId)
    
    if (!invoice) {
      throw new NotFoundError('Invoice not found')
    }

    return invoice
  }

  /**
   * Get invoice by public URL (for customers)
   */
  async getInvoiceByPublicUrl(publicUrl: string) {
    const invoice = await this.invoiceRepo.findByPublicUrl(publicUrl)
    
    if (!invoice) {
      throw new NotFoundError('Invoice not found')
    }

    return invoice
  }

  /**
   * Get invoice with full details for compatibility with old service
   * TODO: Remove after all clients are updated to use new methods
   */
  async getInvoiceWithDetails(invoiceId: string, organizationId: string) {
    const invoice = await this.invoiceRepo.findById(invoiceId, organizationId)
    if (!invoice) {
      throw new NotFoundError('Invoice not found')
    }

    // Get organization details
    const organization = await this.organizationRepo.findById(invoice.organizationId)
    
    // Return in old format for compatibility
    return {
      invoice,
      lineItems: invoice.tab?.lineItems || [],
      organization
    }
  }

  /**
   * Get invoice by public URL with full details for compatibility
   * TODO: Remove after all clients are updated
   */
  async getInvoiceByPublicUrlWithDetails(publicUrl: string) {
    const invoice = await this.invoiceRepo.findByPublicUrl(publicUrl)
    
    if (!invoice) {
      throw new NotFoundError('Invoice not found')
    }

    // Get organization details
    const organization = await this.organizationRepo.findById(invoice.organizationId)
    
    // Return in old format for compatibility
    return {
      invoice,
      lineItems: invoice.tab?.lineItems || [],
      organization
    }
  }

  /**
   * List invoices
   */
  async listInvoices(
    organizationId: string,
    filters?: {
      status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
      tabId?: string
      billingGroupId?: string
    },
    pagination?: {
      page?: number
      pageSize?: number
    }
  ) {
    const page = pagination?.page || 1
    const pageSize = Math.min(pagination?.pageSize || 20, 100)
    const offset = (page - 1) * pageSize

    const invoices = await this.invoiceRepo.findMany(
      organizationId,
      filters,
      {
        limit: pageSize,
        offset,
        includeRelations: true,
      }
    )

    // TODO: Add count query for proper pagination
    return {
      data: invoices,
      pagination: {
        page,
        pageSize,
        totalPages: 1, // TODO: Calculate from count
        totalItems: invoices.length, // TODO: Get from count
      }
    }
  }

  /**
   * Send invoice via email
   */
  async sendInvoice(
    invoiceId: string,
    organizationId: string,
    input: SendInvoiceInput
  ) {
    const invoice = await this.getInvoice(invoiceId, organizationId)

    // Only draft invoices can be sent
    if (invoice.status !== 'draft' && invoice.status !== 'sent') {
      throw new BusinessRuleError(`Cannot send invoice with status: ${invoice.status}`)
    }

    // Generate invoice HTML
    const invoiceHtml = this.generateInvoiceHtml(invoice)

    // Send email
    await this.emailService.send({
      to: input.recipientEmail,
      subject: input.subject || `Invoice #${invoice.invoiceNumber}`,
      html: invoiceHtml,
      replyTo: 'billing@tabapp.com',
    })

    // Send CC emails if provided
    if (input.ccEmails && input.ccEmails.length > 0) {
      await Promise.all(
        input.ccEmails.map(email =>
          this.emailService.send({
            to: email,
            subject: `CC: ${input.subject || `Invoice #${invoice.invoiceNumber}`}`,
            html: invoiceHtml,
            replyTo: 'billing@tabapp.com',
          })
        )
      )
    }

    // Update invoice status
    await this.invoiceRepo.markAsSent(invoiceId, organizationId)

    this.logger.info('Invoice sent', {
      invoiceId,
      recipientEmail: input.recipientEmail,
      ccCount: input.ccEmails?.length || 0,
    })
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    organizationId: string,
    paymentDetails?: {
      paymentMethod?: string
      paymentReference?: string
      paidAt?: Date
    }
  ) {
    const invoice = await this.getInvoice(invoiceId, organizationId)

    if (invoice.status === 'paid') {
      throw new BusinessRuleError('Invoice is already paid')
    }

    if (invoice.status === 'cancelled') {
      throw new BusinessRuleError('Cannot mark cancelled invoice as paid')
    }

    await this.invoiceRepo.update(invoiceId, organizationId, {
      status: 'paid',
      paidAt: paymentDetails?.paidAt || new Date(),
      metadata: {
        ...invoice.metadata,
        paymentMethod: paymentDetails?.paymentMethod,
        paymentReference: paymentDetails?.paymentReference,
      }
    })

    this.logger.info('Invoice marked as paid', {
      invoiceId,
      paymentMethod: paymentDetails?.paymentMethod,
    })
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(
    invoiceId: string,
    organizationId: string,
    reason?: string
  ) {
    const invoice = await this.getInvoice(invoiceId, organizationId)

    if (invoice.status === 'paid') {
      throw new BusinessRuleError('Cannot cancel paid invoice')
    }

    if (invoice.status === 'cancelled') {
      throw new BusinessRuleError('Invoice is already cancelled')
    }

    await this.invoiceRepo.update(invoiceId, organizationId, {
      status: 'cancelled',
      metadata: {
        ...invoice.metadata,
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
      }
    })

    this.logger.info('Invoice cancelled', {
      invoiceId,
      reason,
    })
  }

  /**
   * Generate invoice HTML
   */
  private generateInvoiceHtml(invoice: any): string {
    const lineItems = invoice.tab?.lineItems || []
    const itemsToShow = invoice.billingGroupId
      ? lineItems.filter((item: any) => item.billingGroupId === invoice.billingGroupId)
      : lineItems

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .invoice-header { margin-bottom: 30px; }
          .invoice-details { margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          .total { font-weight: bold; font-size: 1.2em; }
          .payment-link { 
            display: inline-block; 
            padding: 10px 20px; 
            background: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <h1>Invoice #${invoice.invoiceNumber}</h1>
          <p>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</p>
          <p>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        </div>
        
        <div class="invoice-details">
          <h3>Bill To:</h3>
          <p>${invoice.customerName || 'Customer'}</p>
          ${invoice.customerEmail ? `<p>${invoice.customerEmail}</p>` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsToShow.map((item: any) => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${invoice.currency} ${item.unitPrice}</td>
                <td>${invoice.currency} ${item.totalPrice}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total">
              <td colspan="3">Total</td>
              <td>${invoice.currency} ${invoice.amount}</td>
            </tr>
          </tfoot>
        </table>
        
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
        
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoice.publicUrl}" class="payment-link">
          Pay Invoice
        </a>
      </body>
      </html>
    `
  }
}