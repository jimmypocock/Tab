/**
 * Tab State Management Tests
 * 
 * Tests critical tab state transitions and business rules
 * without complex DI setup - focuses on pure business logic.
 */

import { TabManagementService } from '@/lib/services/tab-management.service'
import { BusinessRuleError, ValidationError, NotFoundError } from '@/lib/errors'

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}))

describe('Tab State Management Business Logic', () => {
  let mockContainer: any
  let mockTabRepo: any
  let mockBillingGroupRepo: any
  let tabService: TabManagementService

  beforeEach(() => {
    // Create minimal mocks focused on business logic
    mockTabRepo = {
      findById: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    }

    mockBillingGroupRepo = {
      findDefault: jest.fn()
    }

    mockContainer = {
      resolve: jest.fn((token) => {
        if (token.description === 'TabRepository') return mockTabRepo
        if (token.description === 'BillingGroupRepository') return mockBillingGroupRepo
        return null
      })
    }

    tabService = new TabManagementService(mockContainer)
  })

  describe('Tab Creation Validation', () => {
    it('should reject tabs without line items', async () => {
      const invalidTabData = {
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        currency: 'USD',
        lineItems: [] // Empty - should fail
      }

      await expect(
        tabService.createTab('org-123', invalidTabData)
      ).rejects.toThrow(ValidationError)
      
      await expect(
        tabService.createTab('org-123', invalidTabData)
      ).rejects.toThrow('At least one line item is required')
    })

    it('should reject invalid email formats', async () => {
      const invalidEmailData = {
        customerName: 'Test Customer',
        customerEmail: 'not-an-email',
        currency: 'USD',
        lineItems: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
      }

      await expect(
        tabService.createTab('org-123', invalidEmailData)
      ).rejects.toThrow(ValidationError)
      
      await expect(
        tabService.createTab('org-123', invalidEmailData)
      ).rejects.toThrow('Invalid email format')
    })

    it('should accept valid email formats', async () => {
      const validData = {
        customerName: 'Test Customer',
        customerEmail: 'valid@example.com',
        currency: 'USD',
        lineItems: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
      }

      const mockCreatedTab = {
        id: 'tab-123',
        organizationId: 'org-123',
        ...validData,
        totalAmount: '11.00', // 10 + 10% tax
        status: 'open'
      }

      mockTabRepo.create.mockResolvedValue(mockCreatedTab)
      mockBillingGroupRepo.findDefault.mockResolvedValue(null)

      const result = await tabService.createTab('org-123', validData)
      
      expect(result.customerEmail).toBe('valid@example.com')
      expect(mockTabRepo.create).toHaveBeenCalled()
    })
  })

  describe('Tab Update Business Rules', () => {
    it('should prevent updating paid tabs', async () => {
      const paidTab = {
        id: 'paid-tab',
        organizationId: 'org-123',
        status: 'paid',
        customerName: 'Existing Customer'
      }

      mockTabRepo.findById.mockResolvedValue(paidTab)

      await expect(
        tabService.updateTab('paid-tab', 'org-123', {
          customerName: 'New Name'
        })
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.updateTab('paid-tab', 'org-123', {
          customerName: 'New Name'
        })
      ).rejects.toThrow('Cannot update a paid tab')
    })

    it('should prevent updating voided tabs', async () => {
      const voidedTab = {
        id: 'void-tab',
        organizationId: 'org-123',
        status: 'void',
        customerName: 'Existing Customer'
      }

      mockTabRepo.findById.mockResolvedValue(voidedTab)

      await expect(
        tabService.updateTab('void-tab', 'org-123', {
          customerName: 'New Name'
        })
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.updateTab('void-tab', 'org-123', {
          customerName: 'New Name'
        })
      ).rejects.toThrow('Cannot update a voided tab')
    })

    it('should allow updating open tabs', async () => {
      const openTab = {
        id: 'open-tab',
        organizationId: 'org-123',
        status: 'open',
        customerName: 'Existing Customer'
      }

      const updatedTab = {
        ...openTab,
        customerName: 'Updated Customer'
      }

      mockTabRepo.findById.mockResolvedValue(openTab)
      mockTabRepo.update.mockResolvedValue(updatedTab)

      const result = await tabService.updateTab('open-tab', 'org-123', {
        customerName: 'Updated Customer'
      })

      expect(result.customerName).toBe('Updated Customer')
      expect(mockTabRepo.update).toHaveBeenCalledWith(
        'open-tab',
        'org-123',
        { customerName: 'Updated Customer' }
      )
    })
  })

  describe('Tab Voiding Business Rules', () => {
    it('should prevent voiding paid tabs', async () => {
      const paidTab = {
        id: 'paid-tab',
        organizationId: 'org-123',
        status: 'paid',
        paidAmount: '100.00'
      }

      mockTabRepo.findById.mockResolvedValue(paidTab)

      await expect(
        tabService.voidTab('paid-tab', 'org-123', 'Test void')
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.voidTab('paid-tab', 'org-123', 'Test void')
      ).rejects.toThrow('Cannot void a paid tab')
    })

    it('should prevent voiding already voided tabs', async () => {
      const voidedTab = {
        id: 'void-tab',
        organizationId: 'org-123',
        status: 'void',
        paidAmount: '0.00'
      }

      mockTabRepo.findById.mockResolvedValue(voidedTab)

      await expect(
        tabService.voidTab('void-tab', 'org-123', 'Double void')
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.voidTab('void-tab', 'org-123', 'Double void')
      ).rejects.toThrow('Tab is already voided')
    })

    it('should prevent voiding tabs with payments', async () => {
      const tabWithPayments = {
        id: 'tab-with-payments',
        organizationId: 'org-123',
        status: 'open',
        paidAmount: '50.00' // Has payments
      }

      mockTabRepo.findById.mockResolvedValue(tabWithPayments)

      await expect(
        tabService.voidTab('tab-with-payments', 'org-123', 'Void attempt')
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.voidTab('tab-with-payments', 'org-123', 'Void attempt')
      ).rejects.toThrow('Cannot void a tab with payments')
    })

    it('should successfully void open tabs without payments', async () => {
      const openTab = {
        id: 'open-tab',
        organizationId: 'org-123',
        status: 'open',
        paidAmount: '0.00',
        metadata: {}
      }

      const voidedTab = {
        ...openTab,
        status: 'void',
        metadata: {
          voidedAt: expect.any(String),
          voidReason: 'Business decision'
        }
      }

      mockTabRepo.findById.mockResolvedValue(openTab)
      mockTabRepo.update.mockResolvedValue(voidedTab)

      const result = await tabService.voidTab('open-tab', 'org-123', 'Business decision')

      expect(result.status).toBe('void')
      expect(result.metadata.voidReason).toBe('Business decision')
      expect(mockTabRepo.update).toHaveBeenCalledWith(
        'open-tab',
        'org-123',
        expect.objectContaining({
          status: 'void',
          metadata: expect.objectContaining({
            voidReason: 'Business decision'
          })
        })
      )
    })
  })

  describe('Tab Deletion Business Rules', () => {
    it('should prevent deleting tabs with payments (by payment objects)', async () => {
      const tabWithPayments = {
        id: 'tab-with-payments',
        organizationId: 'org-123',
        payments: [{ id: 'payment-1', amount: '50.00' }],
        paidAmount: '50.00'
      }

      mockTabRepo.findById.mockResolvedValue(tabWithPayments)

      await expect(
        tabService.deleteTab('tab-with-payments', 'org-123')
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.deleteTab('tab-with-payments', 'org-123')
      ).rejects.toThrow('Cannot delete a tab with payments')
    })

    it('should prevent deleting tabs with paid amount', async () => {
      const tabWithPaidAmount = {
        id: 'tab-paid-amount',
        organizationId: 'org-123',
        payments: [],
        paidAmount: '25.00' // Has paid amount
      }

      mockTabRepo.findById.mockResolvedValue(tabWithPaidAmount)

      await expect(
        tabService.deleteTab('tab-paid-amount', 'org-123')
      ).rejects.toThrow(BusinessRuleError)
      
      await expect(
        tabService.deleteTab('tab-paid-amount', 'org-123')
      ).rejects.toThrow('Cannot delete a tab with payments')
    })

    it('should delete clean tabs by voiding them', async () => {
      const cleanTab = {
        id: 'clean-tab',
        organizationId: 'org-123',
        payments: [],
        paidAmount: '0.00',
        status: 'open'
      }

      const voidedTab = {
        ...cleanTab,
        status: 'void',
        metadata: {
          voidedAt: expect.any(String),
          voidReason: 'Deleted by user'
        }
      }

      mockTabRepo.findById.mockResolvedValue(cleanTab)
      mockTabRepo.update.mockResolvedValue(voidedTab)

      await tabService.deleteTab('clean-tab', 'org-123')

      // Should void the tab (soft delete)
      expect(mockTabRepo.update).toHaveBeenCalledWith(
        'clean-tab',
        'org-123',
        expect.objectContaining({
          status: 'void',
          metadata: expect.objectContaining({
            voidReason: 'Deleted by user'
          })
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw NotFoundError when tab does not exist', async () => {
      mockTabRepo.findById.mockResolvedValue(null)

      await expect(
        tabService.getTab('non-existent', 'org-123')
      ).rejects.toThrow(NotFoundError)
      
      await expect(
        tabService.getTab('non-existent', 'org-123')
      ).rejects.toThrow('Tab not found')
    })

    it('should propagate repository errors', async () => {
      mockTabRepo.findById.mockRejectedValue(new Error('Database error'))

      await expect(
        tabService.getTab('error-tab', 'org-123')
      ).rejects.toThrow('Database error')
    })
  })

  describe('Totals Calculation', () => {
    it('should calculate correct totals for line items', () => {
      const lineItems = [
        { quantity: 2, unitPrice: 25.00 }, // 50.00
        { quantity: 1, unitPrice: 30.00 }, // 30.00
        { quantity: 3, unitPrice: 10.00 }  // 30.00
      ]

      const totals = tabService.calculateTotals(lineItems)

      expect(totals.subtotal).toBe('110.00') // 50 + 30 + 30
      expect(totals.taxAmount).toBe('11.00')  // 10% of 110
      expect(totals.totalAmount).toBe('121.00') // 110 + 11
    })

    it('should handle decimal precision in calculations', () => {
      const lineItems = [
        { quantity: 3, unitPrice: 33.33 } // 99.99
      ]

      const totals = tabService.calculateTotals(lineItems)

      expect(totals.subtotal).toBe('99.99')
      expect(parseFloat(totals.totalAmount)).toBeCloseTo(109.99, 2)
    })

    it('should handle zero amounts', () => {
      const lineItems = [
        { quantity: 0, unitPrice: 100.00 },
        { quantity: 1, unitPrice: 0.00 }
      ]

      const totals = tabService.calculateTotals(lineItems)

      expect(totals.subtotal).toBe('0.00')
      expect(totals.taxAmount).toBe('0.00')
      expect(totals.totalAmount).toBe('0.00')
    })
  })
})