import { db } from '@/lib/db'
import {
  invoices,
  invoiceLineItems,
  paymentAllocations,
  invoiceAuditLog,
  tabs,
  lineItems,
  organizations,
  type NewInvoice,
  type NewInvoiceLineItem,
  type Invoice,
  type Tab,
} from '@/lib/db/schema'
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import { Resend } from 'resend'
import { CustomerTargetingService } from '@/lib/services/customer-targeting.service'
import { logger } from '@/lib/logger'

// Generate secure random strings for public URLs
const generatePublicId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21)

export interface CreateInvoiceFromTabOptions {
  tabId: string
  organizationId: string
  lineItemIds?: string[] // If not provided, invoice all items
  dueDate: Date
  paymentTerms?: string
  notes?: string
  billingAddress?: any
  shippingAddress?: any
}

export interface CreateManualInvoiceOptions {
  organizationId: string
  customerEmail: string
  customerName?: string
  customerId?: string
  lineItems: Omit<NewInvoiceLineItem, 'id' | 'invoiceId' | 'lineNumber' | 'createdAt'>[]
  dueDate: Date
  paymentTerms?: string
  notes?: string
  billingAddress?: any
  shippingAddress?: any
}

export class InvoiceService {
  // Generate invoice number for organization
  static async generateInvoiceNumber(organizationId: string): Promise<string> {
    const currentYear = new Date().getFullYear()
    
    // Get the last invoice number for this organization this year
    const lastInvoice = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          sql`${invoices.invoiceNumber} LIKE ${'INV-' + currentYear + '-%'}`
        )
      )
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1)
    
    if (lastInvoice.length === 0) {
      return `INV-${currentYear}-0001`
    }
    
    // Extract the number and increment
    const lastNumber = parseInt(lastInvoice[0].invoiceNumber.split('-')[2])
    return `INV-${currentYear}-${String(lastNumber + 1).padStart(4, '0')}`
  }

  // Create invoice from tab
  static async createInvoiceFromTab(options: CreateInvoiceFromTabOptions): Promise<Invoice> {
    const { tabId, organizationId, lineItemIds, dueDate, paymentTerms, notes, billingAddress, shippingAddress } = options
    
    // Get tab with line items and customer targeting info
    const tabQuery = await db.query.tabs.findFirst({
      where: eq(tabs.id, tabId),
      with: {
        lineItems: true,
        customerOrganization: {
          columns: {
            id: true,
            name: true,
            billingEmail: true,
          }
        }
      }
    })
    
    if (!tabQuery) {
      throw new Error('Tab not found')
    }
    
    const tab = tabQuery
    
    // Filter line items if specific ones requested
    let tabLineItems = tab.lineItems || []
    if (lineItemIds && lineItemIds.length > 0) {
      tabLineItems = tabLineItems.filter(item => lineItemIds.includes(item.id))
    }
    
    if (tabLineItems.length === 0) {
      throw new Error('No line items to invoice')
    }
    
    // Get customer targeting info for effective billing email
    const customerTargeting = await CustomerTargetingService.getCustomerTargeting(tab)
    const billingContext = CustomerTargetingService.getBillingContext(customerTargeting)
    
    // Generate invoice number and public URL
    const invoiceNumber = await this.generateInvoiceNumber(organizationId)
    const publicUrl = `inv_${generatePublicId()}`
    
    // Create invoice with effective billing info
    const [invoice] = await db
      .insert(invoices)
      .values({
        organizationId,
        tabId,
        invoiceNumber,
        customerEmail: customerTargeting.effectiveBillingEmail,
        customerName: customerTargeting.customerName,
        customerId: tab.corporateAccountId,
        dueDate,
        issueDate: new Date(),
        currency: tab.currency,
        paymentTerms,
        publicUrl,
        purchaseOrderNumber: tab.purchaseOrderNumber,
        metadata: {
          notes,
          department: tab.department,
          costCenter: tab.costCenter,
          customerTargeting: billingContext, // Store targeting context for reference
        },
        billingAddress,
        shippingAddress,
      })
      .returning()
    
    // Create invoice line items
    const invoiceLineItemsData: NewInvoiceLineItem[] = tabLineItems.map((item, index) => ({
      invoiceId: invoice.id,
      lineNumber: index + 1,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice,
      sourceType: 'tab_item' as const,
      sourceId: item.id,
      metadata: item.metadata || {},
    }))
    
    await db.insert(invoiceLineItems).values(invoiceLineItemsData)
    
    // Log creation
    await this.logAudit({
      invoiceId: invoice.id,
      action: 'created',
      changedBy: organizationId,
      changedByType: 'organization',
      newData: { invoice, lineItems: invoiceLineItemsData },
    })
    
    return invoice
  }

  // Create manual invoice
  static async createManualInvoice(options: CreateManualInvoiceOptions): Promise<Invoice> {
    const {
      organizationId,
      customerEmail,
      customerName,
      customerId,
      lineItems: lineItemsData,
      dueDate,
      paymentTerms,
      notes,
      billingAddress,
      shippingAddress,
    } = options
    
    // Generate invoice number and public URL
    const invoiceNumber = await this.generateInvoiceNumber(organizationId)
    const publicUrl = `inv_${generatePublicId()}`
    
    // Create invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        organizationId,
        invoiceNumber,
        customerEmail,
        customerName,
        customerId,
        dueDate,
        issueDate: new Date(),
        paymentTerms,
        publicUrl,
        metadata: { notes },
        billingAddress,
        shippingAddress,
      })
      .returning()
    
    // Create line items
    const invoiceLineItemsData: NewInvoiceLineItem[] = lineItemsData.map((item, index) => ({
      ...item,
      invoiceId: invoice.id,
      lineNumber: index + 1,
      sourceType: 'manual' as const,
    }))
    
    await db.insert(invoiceLineItems).values(invoiceLineItemsData)
    
    // Log creation
    await this.logAudit({
      invoiceId: invoice.id,
      action: 'created',
      changedBy: organizationId,
      changedByType: 'organization',
      newData: { invoice, lineItems: invoiceLineItemsData },
    })
    
    return invoice
  }

  // Update invoice status
  static async updateInvoiceStatus(
    invoiceId: string,
    newStatus: Invoice['status'],
    changedBy?: string
  ): Promise<Invoice> {
    // Get current invoice
    const [currentInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    
    if (!currentInvoice) {
      throw new Error('Invoice not found')
    }
    
    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      draft: ['sent', 'void'],
      sent: ['viewed', 'partial', 'paid', 'void'],
      viewed: ['partial', 'paid', 'void', 'uncollectible'],
      partial: ['paid', 'void', 'uncollectible'],
      paid: ['void'],
      void: [],
      uncollectible: [],
    }
    
    if (!validTransitions[currentInvoice.status]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentInvoice.status} to ${newStatus}`)
    }
    
    // Update status with appropriate timestamps
    const updates: Partial<Invoice> = { status: newStatus }
    
    if (newStatus === 'sent' && !currentInvoice.sentAt) {
      updates.sentAt = new Date()
    } else if (newStatus === 'viewed' && !currentInvoice.firstViewedAt) {
      updates.firstViewedAt = new Date()
    } else if (newStatus === 'paid') {
      updates.paidAt = new Date()
    } else if (newStatus === 'void') {
      updates.voidedAt = new Date()
    }
    
    const [updatedInvoice] = await db
      .update(invoices)
      .set(updates)
      .where(eq(invoices.id, invoiceId))
      .returning()
    
    // Log status change
    await this.logAudit({
      invoiceId,
      action: `status_changed_to_${newStatus}`,
      changedBy,
      changedByType: changedBy ? 'organization' : 'system',
      previousData: { status: currentInvoice.status },
      newData: { status: newStatus },
    })
    
    return updatedInvoice
  }

  // Send invoice via email
  static async sendInvoice(
    invoiceId: string,
    organizationId: string,
    recipientEmail?: string,
    ccEmails?: string[]
  ): Promise<{ emailId: string }> {
    // Get invoice with organization and tab details (for customer targeting)
    const invoiceData = await db
      .select({
        invoice: invoices,
        organization: organizations,
        tab: tabs,
      })
      .from(invoices)
      .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
      .leftJoin(tabs, eq(invoices.tabId, tabs.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)))
      .limit(1)
    
    if (invoiceData.length === 0) {
      throw new Error('Invoice not found')
    }
    
    const { invoice, organization, tab } = invoiceData[0]
    
    // Get line items
    const lineItemsData = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.lineNumber)
    
    // Use provided email or determine effective billing email
    let toEmail = recipientEmail || invoice.customerEmail
    
    // If we have a tab with customer organization targeting, ensure we use correct email
    if (tab && tab.customerOrganizationId && !recipientEmail) {
      try {
        const customerTargeting = await CustomerTargetingService.getCustomerTargeting(tab)
        toEmail = customerTargeting.effectiveBillingEmail
      } catch (error) {
        // Fallback to invoice customer email if targeting service fails
        logger.warn('Failed to get customer targeting for invoice email', {
          error: error instanceof Error ? error.message : String(error),
          tabId: tab.id,
          invoiceId: invoice.id
        })
        toEmail = invoice.customerEmail
      }
    }
    
    // Generate email HTML
    const emailHtml = await this.generateInvoiceEmailHtml(invoice, organization, lineItemsData)
    
    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }
    
    const resend = new Resend(resendApiKey)
    const publicInvoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoice.publicUrl}`
    
    const emailResult = await resend.emails.send({
      from: 'Tab Invoices <invoices@notifications.usetab.com>',
      to: toEmail,
      cc: ccEmails,
      subject: `Invoice ${invoice.invoiceNumber} from ${organization.name}`,
      html: emailHtml,
      text: `You have received an invoice from ${organization.name}.\n\nInvoice Number: ${invoice.invoiceNumber}\nAmount Due: $${invoice.totalAmount}\nDue Date: ${invoice.dueDate}\n\nView and pay your invoice: ${publicInvoiceUrl}`,
    })
    
    // Update invoice status to sent
    if (invoice.status === 'draft') {
      await this.updateInvoiceStatus(invoiceId, 'sent', organizationId)
    }
    
    return { emailId: emailResult.data?.id || 'unknown' }
  }

  // Generate invoice email HTML
  private static async generateInvoiceEmailHtml(
    invoice: Invoice,
    organization: any,
    lineItems: any[]
  ): Promise<string> {
    const publicInvoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoice.publicUrl}`
    
    const lineItemsHtml = lineItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unitPrice}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.totalAmount}</td>
      </tr>
    `).join('')
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); padding: 32px;">
      <!-- Header -->
      <div style="margin-bottom: 32px;">
        <h1 style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0;">${organization.name}</h1>
        <p style="color: #6b7280; margin-top: 4px;">Invoice ${invoice.invoiceNumber}</p>
      </div>

      <!-- Customer Info -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #374151; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Bill To:</h2>
        <p style="margin: 0;">${invoice.customerName || invoice.customerEmail}</p>
        <p style="margin: 0; color: #6b7280;">${invoice.customerEmail}</p>
      </div>

      <!-- Invoice Details -->
      <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Issue Date:</span>
          <span style="color: #1f2937; font-weight: 500;">${new Date(invoice.issueDate).toLocaleDateString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280;">Due Date:</span>
          <span style="color: #1f2937; font-weight: 500;">${new Date(invoice.dueDate).toLocaleDateString()}</span>
        </div>
        ${invoice.paymentTerms ? `
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span style="color: #6b7280;">Payment Terms:</span>
          <span style="color: #1f2937; font-weight: 500;">${invoice.paymentTerms}</span>
        </div>
        ` : ''}
      </div>

      <!-- Line Items -->
      <table style="width: 100%; margin-bottom: 32px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 8px; text-align: left; font-weight: 600; color: #374151;">Description</th>
            <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">Qty</th>
            <th style="padding: 8px; text-align: right; font-weight: 600; color: #374151;">Price</th>
            <th style="padding: 8px; text-align: right; font-weight: 600; color: #374151;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="border-top: 2px solid #e5e7eb; padding-top: 16px; margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Subtotal:</span>
          <span style="color: #1f2937;">$${invoice.subtotal}</span>
        </div>
        ${invoice.taxAmount && parseFloat(invoice.taxAmount) > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Tax:</span>
          <span style="color: #1f2937;">$${invoice.taxAmount}</span>
        </div>
        ` : ''}
        ${invoice.discountAmount && parseFloat(invoice.discountAmount) > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Discount:</span>
          <span style="color: #1f2937;">-$${invoice.discountAmount}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <span style="color: #1f2937; font-size: 18px; font-weight: 600;">Total Due:</span>
          <span style="color: #1f2937; font-size: 18px; font-weight: 600;">$${invoice.totalAmount}</span>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${publicInvoiceUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View & Pay Invoice</a>
      </div>

      <!-- Footer -->
      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
        <p style="margin: 0;">This invoice was sent via Tab</p>
        <p style="margin: 4px 0;">Questions? Contact ${organization.supportEmail || organization.primaryEmail || 'support@tab.com'}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `
  }

  // Log audit trail
  private static async logAudit(data: {
    invoiceId: string
    action: string
    changedBy?: string
    changedByType?: string
    previousData?: any
    newData?: any
  }): Promise<void> {
    await db.insert(invoiceAuditLog).values({
      invoiceId: data.invoiceId,
      action: data.action,
      changedBy: data.changedBy,
      changedByType: data.changedByType,
      previousData: data.previousData,
      newData: data.newData,
    })
  }

  // Get invoice with line items
  static async getInvoiceWithDetails(invoiceId: string): Promise<{
    invoice: Invoice
    lineItems: any[]
    organization: any
  } | null> {
    const invoiceData = await db
      .select({
        invoice: invoices,
        organization: organizations,
      })
      .from(invoices)
      .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    
    if (invoiceData.length === 0) {
      return null
    }
    
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.lineNumber)
    
    return {
      invoice: invoiceData[0].invoice,
      organization: invoiceData[0].organization,
      lineItems,
    }
  }

  // Get invoice by public URL
  static async getInvoiceByPublicUrl(publicUrl: string): Promise<{
    invoice: Invoice
    lineItems: any[]
    organization: any
  } | null> {
    const invoiceData = await db
      .select({
        invoice: invoices,
        organization: organizations,
      })
      .from(invoices)
      .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
      .where(eq(invoices.publicUrl, publicUrl))
      .limit(1)
    
    if (invoiceData.length === 0) {
      return null
    }
    
    const invoice = invoiceData[0].invoice
    
    // Mark as viewed if first time
    if (invoice.status === 'sent' && !invoice.firstViewedAt) {
      await this.updateInvoiceStatus(invoice.id, 'viewed')
    }
    
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoice.id))
      .orderBy(invoiceLineItems.lineNumber)
    
    return {
      invoice,
      organization: invoiceData[0].organization,
      lineItems,
    }
  }
}