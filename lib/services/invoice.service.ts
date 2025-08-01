/**
 * Invoice Service - Compatibility Layer
 * This provides backwards compatibility while we migrate to the new DI pattern
 * TODO: Remove this file after all clients are updated to use InvoiceManagementService directly
 */

import { getServerDI } from '@/lib/di/server'

export class InvoiceService {
  /**
   * Get invoice by public URL with full details
   * @deprecated Use InvoiceManagementService directly
   */
  static async getInvoiceByPublicUrl(publicUrl: string) {
    const di = getServerDI()
    return di.invoiceService.getInvoiceByPublicUrlWithDetails(publicUrl)
  }

  /**
   * Get invoice with full details
   * @deprecated Use InvoiceManagementService directly
   */
  static async getInvoiceWithDetails(invoiceId: string, organizationId: string) {
    const di = getServerDI()
    return di.invoiceService.getInvoiceWithDetails(invoiceId, organizationId)
  }

  /**
   * Send invoice
   * @deprecated Use InvoiceManagementService directly
   */
  static async sendInvoice(
    invoiceId: string,
    organizationId: string,
    recipientEmail?: string,
    ccEmails?: string[]
  ) {
    const di = getServerDI()
    return di.invoiceService.sendInvoice(invoiceId, organizationId, {
      recipientEmail: recipientEmail || '',
      ccEmails,
    })
  }

  /**
   * Create invoice from tab
   * @deprecated Use InvoiceManagementService directly
   */
  static async createInvoiceFromTab(options: any) {
    const di = getServerDI()
    return di.invoiceService.createInvoice(options.organizationId, {
      tabId: options.tabId,
      billingGroupId: options.billingGroupId,
      dueDate: options.dueDate,
      notes: options.notes,
      metadata: options.metadata,
    })
  }

  /**
   * Create billing group invoice
   * @deprecated Use InvoiceManagementService directly
   */
  static async createBillingGroupInvoice(options: any) {
    const di = getServerDI()
    return di.invoiceService.createInvoice(options.organizationId, {
      tabId: options.tabId,
      billingGroupId: options.billingGroupId,
      dueDate: options.dueDate,
      notes: options.notes,
      metadata: options.metadata,
    })
  }

  /**
   * Get invoicable billing groups
   * @deprecated Use BillingGroupService directly
   */
  static async getInvoicableBillingGroups(tabId: string, organizationId: string) {
    const di = getServerDI()
    return di.billingGroupService.getInvoicableBillingGroups(organizationId, tabId)
  }
}