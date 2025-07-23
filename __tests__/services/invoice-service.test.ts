/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock dependencies
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  query: {
    invoices: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    tabs: {
      findFirst: jest.fn(),
    },
    merchants: {
      findFirst: jest.fn(),
    },
    lineItems: {
      findMany: jest.fn(),
    },
  },
  transaction: jest.fn(),
}

// Mock email service
const mockEmailService = {
  sendInvoice: jest.fn(),
  sendInvoiceReminder: jest.fn(),
  sendPaymentConfirmation: jest.fn(),
}

// Mock PDF generator
const mockPdfGenerator = {
  generateInvoicePdf: jest.fn(),
}

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}

// Invoice service under test
class InvoiceService {
  constructor(
    private db: any,
    private emailService: any,
    private pdfGenerator: any,
    private logger: any
  ) {}

  async createAndSendInvoice(tabId: string, options?: {
    dueDate?: Date
    notes?: string
    sendEmail?: boolean
  }) {
    try {
      // Get tab with merchant and line items
      const tab = await this.db.query.tabs.findFirst({
        where: { id: tabId },
        with: { merchant: true, lineItems: true }
      })

      if (!tab) {
        throw new Error('Tab not found')
      }

      if (tab.status !== 'open') {
        throw new Error('Can only create invoice for open tabs')
      }

      // Generate invoice number
      const invoiceNumber = this.generateInvoiceNumber(tab.merchantId)

      // Create invoice record
      const invoice = await this.db.insert('invoices').values({
        tabId,
        merchantId: tab.merchantId,
        invoiceNumber,
        customerName: tab.customerName,
        customerEmail: tab.customerEmail,
        amount: tab.totalAmount,
        currency: tab.currency,
        status: 'sent',
        dueDate: options?.dueDate || this.getDefaultDueDate(),
        notes: options?.notes,
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()

      // Generate PDF
      const pdfBuffer = await this.pdfGenerator.generateInvoicePdf({
        invoice: invoice[0],
        merchant: tab.merchant,
        lineItems: tab.lineItems,
      })

      // Update invoice with PDF URL
      const pdfUrl = await this.uploadPdf(pdfBuffer, invoice[0].id)
      await this.db.update('invoices')
        .set({ pdfUrl })
        .where({ id: invoice[0].id })

      // Send email if requested
      if (options?.sendEmail !== false) {
        await this.emailService.sendInvoice({
          to: tab.customerEmail,
          invoice: invoice[0],
          merchant: tab.merchant,
          pdfUrl,
        })
      }

      this.logger.info(`Created and sent invoice ${invoiceNumber} for tab ${tabId}`)

      return {
        ...invoice[0],
        pdfUrl,
      }
    } catch (error) {
      this.logger.error(`Failed to create invoice: ${error.message}`)
      throw error
    }
  }

  async getInvoice(invoiceId: string, merchantId?: string) {
    try {
      const invoice = await this.db.query.invoices.findFirst({
        where: merchantId 
          ? { id: invoiceId, merchantId }
          : { id: invoiceId },
        with: { 
          tab: { 
            include: { lineItems: true } 
          },
          merchant: true 
        }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      return invoice
    } catch (error) {
      this.logger.error(`Failed to get invoice: ${error.message}`)
      throw error
    }
  }

  async listInvoices(merchantId: string, options?: {
    status?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }) {
    try {
      const query = {
        where: {
          merchantId,
          ...(options?.status && { status: options.status }),
          ...(options?.startDate && { 
            createdAt: { gte: options.startDate } 
          }),
          ...(options?.endDate && { 
            createdAt: { lte: options.endDate } 
          }),
        },
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        orderBy: { createdAt: 'desc' }
      }

      const invoices = await this.db.query.invoices.findMany(query)
      
      return {
        invoices,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: await this.countInvoices(query.where)
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list invoices: ${error.message}`)
      throw error
    }
  }

  async markInvoicePaid(invoiceId: string, paymentDetails?: {
    paymentMethod?: string
    transactionId?: string
    paidAt?: Date
  }) {
    try {
      const invoice = await this.db.query.invoices.findFirst({
        where: { id: invoiceId }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (invoice.status === 'paid') {
        throw new Error('Invoice already paid')
      }

      await this.db.transaction(async (trx) => {
        // Update invoice status
        await trx.update('invoices')
          .set({
            status: 'paid',
            paidAt: paymentDetails?.paidAt || new Date(),
            paymentMethod: paymentDetails?.paymentMethod,
            paymentTransactionId: paymentDetails?.transactionId,
            updatedAt: new Date(),
          })
          .where({ id: invoiceId })

        // Update associated tab status
        await trx.update('tabs')
          .set({
            status: 'paid',
            updatedAt: new Date(),
          })
          .where({ id: invoice.tabId })
      })

      // Send payment confirmation
      if (invoice.customerEmail) {
        await this.emailService.sendPaymentConfirmation({
          to: invoice.customerEmail,
          invoice,
          paymentDetails,
        })
      }

      this.logger.info(`Marked invoice ${invoice.invoiceNumber} as paid`)

      return true
    } catch (error) {
      this.logger.error(`Failed to mark invoice paid: ${error.message}`)
      throw error
    }
  }

  async sendReminder(invoiceId: string) {
    try {
      const invoice = await this.getInvoice(invoiceId)

      if (invoice.status === 'paid') {
        throw new Error('Cannot send reminder for paid invoice')
      }

      // Send reminder email
      await this.emailService.sendInvoiceReminder({
        to: invoice.customerEmail,
        invoice,
        merchant: invoice.merchant,
        pdfUrl: invoice.pdfUrl,
      })

      // Update reminder count and timestamp
      await this.db.update('invoices')
        .set({
          reminderCount: (invoice.reminderCount || 0) + 1,
          lastReminderAt: new Date(),
          updatedAt: new Date(),
        })
        .where({ id: invoiceId })

      this.logger.info(`Sent reminder for invoice ${invoice.invoiceNumber}`)

      return true
    } catch (error) {
      this.logger.error(`Failed to send invoice reminder: ${error.message}`)
      throw error
    }
  }

  async voidInvoice(invoiceId: string, reason?: string) {
    try {
      const invoice = await this.db.query.invoices.findFirst({
        where: { id: invoiceId }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (invoice.status === 'paid') {
        throw new Error('Cannot void paid invoice')
      }

      if (invoice.status === 'void') {
        throw new Error('Invoice already void')
      }

      await this.db.update('invoices')
        .set({
          status: 'void',
          voidedAt: new Date(),
          voidReason: reason,
          updatedAt: new Date(),
        })
        .where({ id: invoiceId })

      this.logger.info(`Voided invoice ${invoice.invoiceNumber}`)

      return true
    } catch (error) {
      this.logger.error(`Failed to void invoice: ${error.message}`)
      throw error
    }
  }

  async getInvoiceStats(merchantId: string, period?: {
    startDate: Date
    endDate: Date
  }) {
    try {
      const dateFilter = period ? {
        createdAt: {
          gte: period.startDate,
          lte: period.endDate,
        }
      } : {}

      const invoices = await this.db.query.invoices.findMany({
        where: {
          merchantId,
          ...dateFilter,
        }
      })

      const stats = {
        total: invoices.length,
        totalAmount: 0,
        paid: 0,
        paidAmount: 0,
        outstanding: 0,
        outstandingAmount: 0,
        overdue: 0,
        overdueAmount: 0,
        void: 0,
      }

      const now = new Date()

      invoices.forEach(invoice => {
        stats.totalAmount += invoice.amount

        if (invoice.status === 'paid') {
          stats.paid++
          stats.paidAmount += invoice.amount
        } else if (invoice.status === 'void') {
          stats.void++
        } else {
          stats.outstanding++
          stats.outstandingAmount += invoice.amount

          if (invoice.dueDate && invoice.dueDate < now) {
            stats.overdue++
            stats.overdueAmount += invoice.amount
          }
        }
      })

      return stats
    } catch (error) {
      this.logger.error(`Failed to get invoice stats: ${error.message}`)
      throw error
    }
  }

  // Private helper methods
  private generateInvoiceNumber(merchantId: string): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `INV-${year}${month}-${random}`
  }

  private getDefaultDueDate(): Date {
    const date = new Date()
    date.setDate(date.getDate() + 30) // 30 days from now
    return date
  }

  private async uploadPdf(buffer: Buffer, invoiceId: string): Promise<string> {
    // In real implementation, this would upload to S3/storage
    return `https://storage.example.com/invoices/${invoiceId}.pdf`
  }

  private async countInvoices(where: any): Promise<number> {
    // In real implementation, this would do a count query
    const all = await this.db.query.invoices.findMany({ where })
    return all.length
  }
}

describe('InvoiceService', () => {
  let service: InvoiceService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new InvoiceService(mockDb, mockEmailService, mockPdfGenerator, mockLogger)
  })

  describe('createAndSendInvoice', () => {
    const mockTab = {
      id: 'tab_123',
      merchantId: 'merchant_123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      totalAmount: 10000,
      currency: 'USD',
      status: 'open',
      merchant: {
        id: 'merchant_123',
        businessName: 'Test Business',
      },
      lineItems: [
        { name: 'Item 1', unitPrice: 5000, quantity: 2 }
      ]
    }

    beforeEach(() => {
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'invoice_123',
            invoiceNumber: 'INV-202401-ABCD',
            amount: 10000,
          }])
        })
      })
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
      mockPdfGenerator.generateInvoicePdf.mockResolvedValue(Buffer.from('mock pdf'))
    })

    it('should create and send invoice successfully', async () => {
      const result = await service.createAndSendInvoice('tab_123', {
        notes: 'Thank you for your business'
      })

      expect(result).toMatchObject({
        id: 'invoice_123',
        invoiceNumber: 'INV-202401-ABCD',
        amount: 10000,
        pdfUrl: expect.stringContaining('https://storage.example.com/invoices/')
      })

      expect(mockPdfGenerator.generateInvoicePdf).toHaveBeenCalledWith({
        invoice: expect.objectContaining({ amount: 10000 }),
        merchant: mockTab.merchant,
        lineItems: mockTab.lineItems,
      })

      expect(mockEmailService.sendInvoice).toHaveBeenCalledWith({
        to: 'john@example.com',
        invoice: expect.objectContaining({ amount: 10000 }),
        merchant: mockTab.merchant,
        pdfUrl: expect.stringContaining('https://storage.example.com/invoices/')
      })
    })

    it('should throw error if tab not found', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)

      await expect(
        service.createAndSendInvoice('invalid_tab')
      ).rejects.toThrow('Tab not found')
    })

    it('should throw error if tab not open', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        status: 'paid'
      })

      await expect(
        service.createAndSendInvoice('tab_123')
      ).rejects.toThrow('Can only create invoice for open tabs')
    })

    it('should skip email if sendEmail is false', async () => {
      await service.createAndSendInvoice('tab_123', {
        sendEmail: false
      })

      expect(mockEmailService.sendInvoice).not.toHaveBeenCalled()
    })

    it('should use custom due date', async () => {
      const customDueDate = new Date('2024-12-31')
      
      await service.createAndSendInvoice('tab_123', {
        dueDate: customDueDate
      })

      expect(mockDb.insert).toHaveBeenCalledWith('invoices')
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: customDueDate
        })
      )
    })
  })

  describe('markInvoicePaid', () => {
    const mockInvoice = {
      id: 'invoice_123',
      tabId: 'tab_123',
      invoiceNumber: 'INV-202401-ABCD',
      customerEmail: 'john@example.com',
      status: 'sent',
      amount: 10000,
    }

    beforeEach(() => {
      mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice)
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue({ success: true })
            })
          })
        })
      })
    })

    it('should mark invoice as paid', async () => {
      const paymentDetails = {
        paymentMethod: 'credit_card',
        transactionId: 'txn_123',
        paidAt: new Date('2024-01-15')
      }

      const result = await service.markInvoicePaid('invoice_123', paymentDetails)

      expect(result).toBe(true)
      expect(mockEmailService.sendPaymentConfirmation).toHaveBeenCalledWith({
        to: 'john@example.com',
        invoice: mockInvoice,
        paymentDetails,
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Marked invoice INV-202401-ABCD as paid'
      )
    })

    it('should throw error if invoice not found', async () => {
      mockDb.query.invoices.findFirst.mockResolvedValue(null)

      await expect(
        service.markInvoicePaid('invalid_invoice')
      ).rejects.toThrow('Invoice not found')
    })

    it('should throw error if invoice already paid', async () => {
      mockDb.query.invoices.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: 'paid'
      })

      await expect(
        service.markInvoicePaid('invoice_123')
      ).rejects.toThrow('Invoice already paid')
    })

    it('should handle transaction errors', async () => {
      mockDb.transaction.mockRejectedValue(new Error('Database error'))

      await expect(
        service.markInvoicePaid('invoice_123')
      ).rejects.toThrow('Database error')
    })
  })

  describe('sendReminder', () => {
    const mockInvoice = {
      id: 'invoice_123',
      invoiceNumber: 'INV-202401-ABCD',
      customerEmail: 'john@example.com',
      status: 'sent',
      reminderCount: 0,
      merchant: { businessName: 'Test Business' },
      pdfUrl: 'https://storage.example.com/invoices/invoice_123.pdf'
    }

    beforeEach(() => {
      // Mock getInvoice to use findFirst
      jest.spyOn(service, 'getInvoice').mockResolvedValue(mockInvoice)
      
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should send reminder successfully', async () => {
      const result = await service.sendReminder('invoice_123')

      expect(result).toBe(true)
      expect(mockEmailService.sendInvoiceReminder).toHaveBeenCalledWith({
        to: 'john@example.com',
        invoice: mockInvoice,
        merchant: mockInvoice.merchant,
        pdfUrl: mockInvoice.pdfUrl,
      })
      expect(mockDb.update().set).toHaveBeenCalledWith({
        reminderCount: 1,
        lastReminderAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    })

    it('should throw error for paid invoice', async () => {
      jest.spyOn(service, 'getInvoice').mockResolvedValue({
        ...mockInvoice,
        status: 'paid'
      })

      await expect(
        service.sendReminder('invoice_123')
      ).rejects.toThrow('Cannot send reminder for paid invoice')
    })

    it('should increment reminder count', async () => {
      jest.spyOn(service, 'getInvoice').mockResolvedValue({
        ...mockInvoice,
        reminderCount: 2
      })

      await service.sendReminder('invoice_123')

      expect(mockDb.update().set).toHaveBeenCalledWith({
        reminderCount: 3,
        lastReminderAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    })
  })

  describe('getInvoiceStats', () => {
    const mockInvoices = [
      {
        id: 'inv_1',
        amount: 10000,
        status: 'paid',
        dueDate: new Date('2024-01-01'),
      },
      {
        id: 'inv_2',
        amount: 5000,
        status: 'sent',
        dueDate: new Date('2024-02-01'),
      },
      {
        id: 'inv_3',
        amount: 7500,
        status: 'sent',
        dueDate: new Date('2023-12-01'), // Overdue
      },
      {
        id: 'inv_4',
        amount: 3000,
        status: 'void',
        dueDate: new Date('2024-01-15'),
      },
    ]

    beforeEach(() => {
      mockDb.query.invoices.findMany.mockResolvedValue(mockInvoices)
    })

    it('should calculate invoice statistics correctly', async () => {
      // Set the current date for consistent testing
      const mockDate = new Date('2024-01-15')
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)
      
      const stats = await service.getInvoiceStats('merchant_123')

      expect(stats).toEqual({
        total: 4,
        totalAmount: 25500,
        paid: 1,
        paidAmount: 10000,
        outstanding: 2,
        outstandingAmount: 12500,
        overdue: 1,
        overdueAmount: 7500,
        void: 1,
      })
      
      // Restore Date
      jest.restoreAllMocks()
    })

    it('should filter by date period', async () => {
      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      await service.getInvoiceStats('merchant_123', period)

      expect(mockDb.query.invoices.findMany).toHaveBeenCalledWith({
        where: {
          merchantId: 'merchant_123',
          createdAt: {
            gte: period.startDate,
            lte: period.endDate,
          }
        }
      })
    })

    it('should handle empty invoice list', async () => {
      mockDb.query.invoices.findMany.mockResolvedValue([])

      const stats = await service.getInvoiceStats('merchant_123')

      expect(stats).toEqual({
        total: 0,
        totalAmount: 0,
        paid: 0,
        paidAmount: 0,
        outstanding: 0,
        outstandingAmount: 0,
        overdue: 0,
        overdueAmount: 0,
        void: 0,
      })
    })
  })

  describe('voidInvoice', () => {
    const mockInvoice = {
      id: 'invoice_123',
      invoiceNumber: 'INV-202401-ABCD',
      status: 'sent',
    }

    beforeEach(() => {
      mockDb.query.invoices.findFirst.mockResolvedValue(mockInvoice)
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should void invoice successfully', async () => {
      const result = await service.voidInvoice('invoice_123', 'Customer cancelled order')

      expect(result).toBe(true)
      expect(mockDb.update().set).toHaveBeenCalledWith({
        status: 'void',
        voidedAt: expect.any(Date),
        voidReason: 'Customer cancelled order',
        updatedAt: expect.any(Date),
      })
    })

    it('should throw error if invoice not found', async () => {
      mockDb.query.invoices.findFirst.mockResolvedValue(null)

      await expect(
        service.voidInvoice('invalid_invoice')
      ).rejects.toThrow('Invoice not found')
    })

    it('should throw error if invoice already paid', async () => {
      mockDb.query.invoices.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: 'paid'
      })

      await expect(
        service.voidInvoice('invoice_123')
      ).rejects.toThrow('Cannot void paid invoice')
    })

    it('should throw error if invoice already void', async () => {
      mockDb.query.invoices.findFirst.mockResolvedValue({
        ...mockInvoice,
        status: 'void'
      })

      await expect(
        service.voidInvoice('invoice_123')
      ).rejects.toThrow('Invoice already void')
    })
  })
})