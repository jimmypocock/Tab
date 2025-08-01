/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST, PUT, GET } from '@/app/api/v1/tabs/[id]/void/route'
import { GET as ValidateVoiding } from '@/app/api/v1/tabs/[id]/validate-voiding/route'
import { GET as GetVoidedTabs } from '@/app/api/v1/tabs/voided/route'
import { POST as BulkVoid } from '@/app/api/v1/tabs/bulk-void/route'
import { TabVoidingService } from '@/lib/services/tab-voiding.service'
import { db } from '@/lib/db'

// Mock dependencies
jest.mock('@/lib/services/tab-voiding.service')
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    query: {
      apiKeys: {
        findFirst: jest.fn()
      }
    }
  }
}))

const mockTabVoidingService = TabVoidingService as jest.Mocked<typeof TabVoidingService>
const mockDb = db as jest.Mocked<typeof db>

// Mock withApiAuth middleware
const mockContext = {
  organizationId: 'org_123',
  apiKeyId: 'key_456',
  requestId: 'req_789',
  environment: 'test' as const
}

jest.mock('@/lib/api/middleware', () => ({
  withApiAuth: (handler: any) => (req: any, context: any, extra: any) => {
    return handler(req, mockContext, extra)
  }
}))

describe('Tab Voiding Endpoints', () => {
  const tabId = 'tab_123'
  const userId = 'user_456'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock database select chain for API key validation
    ;(mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              apiKey: { createdBy: userId },
              organization: { id: mockContext.organizationId }
            }])
          })
        })
      })
    })
    
    // Mock database update for lastUsedAt
    ;(mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({})
      })
    })
  })

  describe('GET /api/v1/tabs/[id]/validate-voiding', () => {
    it('should return validation result when voiding is allowed', async () => {
      const mockValidation = {
        canVoid: true,
        blockers: [],
        warnings: [
          '3 unpaid line items totaling $125.00 will become uncollectible when voided',
          '1 active billing group(s) will be closed when tab is voided'
        ],
        tab: {
          id: tabId,
          externalReference: 'REF-001',
          customerEmail: 'customer@example.com',
          customerName: 'John Doe',
          status: 'open',
          totalAmount: '125.00',
          paidAmount: '0.00',
          createdAt: new Date('2024-01-01')
        }
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/validate-voiding`)
      const response = await ValidateVoiding(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockValidation)
      expect(mockTabVoidingService.validateVoiding).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId
      )
    })

    it('should return validation result when voiding is blocked', async () => {
      const mockValidation = {
        canVoid: false,
        blockers: [
          {
            type: 'payment',
            count: 2,
            message: 'Cannot void tab with 2 successful payment(s) totaling $200.00. Payments must be refunded first.',
            details: [
              { id: 'pay_1', amount: '100.00', processor: 'stripe', processorPaymentId: 'pi_123' },
              { id: 'pay_2', amount: '100.00', processor: 'stripe', processorPaymentId: 'pi_456' }
            ]
          },
          {
            type: 'invoice',
            count: 1,
            message: 'Cannot void tab with 1 paid invoice(s) totaling $200.00. Invoice payments must be handled first.',
            details: [
              { invoiceId: 'inv_1', invoiceNumber: 'INV-001', paidAmount: '200.00' }
            ]
          }
        ],
        warnings: [],
        tab: {
          id: tabId,
          externalReference: 'REF-002',
          customerEmail: 'business@example.com',
          customerName: 'Business Corp',
          status: 'partial',
          totalAmount: '500.00',
          paidAmount: '200.00',
          createdAt: new Date('2024-01-01')
        }
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/validate-voiding`)
      const response = await ValidateVoiding(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockValidation)
      expect(data.canVoid).toBe(false)
      expect(data.blockers).toHaveLength(2)
    })

    it('should handle tab not found', async () => {
      mockTabVoidingService.validateVoiding.mockRejectedValue(
        new Error('Tab not found')
      )

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/validate-voiding`)
      const response = await ValidateVoiding(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tab not found')
    })

    it('should handle already voided tab', async () => {
      mockTabVoidingService.validateVoiding.mockRejectedValue(
        new Error('Tab is already voided')
      )

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/validate-voiding`)
      const response = await ValidateVoiding(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Tab is already voided')
    })
  })

  describe('POST /api/v1/tabs/[id]/void', () => {
    it('should void tab when validation passes', async () => {
      const voidData = {
        reason: 'Customer request cancellation',
        closeActiveBillingGroups: true,
        voidDraftInvoices: true,
        skipValidation: false
      }

      const mockValidation = {
        canVoid: true,
        blockers: [],
        warnings: ['2 unpaid line items will become uncollectible'],
        tab: {
          id: tabId,
          externalReference: 'REF-001',
          customerEmail: 'customer@example.com',
          customerName: 'John Doe',
          status: 'open',
          totalAmount: '75.00',
          paidAmount: '0.00',
          createdAt: new Date('2024-01-01')
        }
      }

      const mockAuditEntry = {
        tabId,
        voidedBy: userId,
        voidedAt: new Date(),
        reason: 'Customer request cancellation',
        previousStatus: 'open',
        paymentRefunds: [],
        invoiceActions: [
          {
            invoiceId: 'inv_1',
            invoiceNumber: 'INV-001',
            action: 'voided',
            previousStatus: 'draft'
          }
        ]
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)
      mockTabVoidingService.voidTab.mockResolvedValue(mockAuditEntry)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'POST',
        body: JSON.stringify(voidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Tab voided successfully')
      expect(data.auditEntry).toEqual(mockAuditEntry)
      
      expect(mockTabVoidingService.validateVoiding).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId
      )
      expect(mockTabVoidingService.voidTab).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId,
        userId,
        'Customer request cancellation',
        {
          skipValidation: false,
          closeActiveBillingGroups: true,
          voidDraftInvoices: true
        }
      )
    })

    it('should reject voiding when blocked by payments', async () => {
      const voidData = {
        reason: 'Cancel order',
        skipValidation: false
      }

      const mockValidation = {
        canVoid: false,
        blockers: [
          {
            type: 'payment',
            count: 1,
            message: 'Cannot void tab with 1 successful payment(s) totaling $100.00. Payments must be refunded first.'
          }
        ],
        warnings: [],
        tab: {
          id: tabId,
          externalReference: 'REF-002',
          customerEmail: 'customer@example.com',
          customerName: 'Jane Smith',
          status: 'paid',
          totalAmount: '100.00',
          paidAmount: '100.00',
          createdAt: new Date('2024-01-01')
        }
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'POST',
        body: JSON.stringify(voidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Cannot void tab')
      expect(data.blockers).toEqual(mockValidation.blockers)
      expect(data.tab).toEqual(mockValidation.tab)
      
      // Should not call void when blocked
      expect(mockTabVoidingService.voidTab).not.toHaveBeenCalled()
    })

    it('should allow forced voiding with skipValidation', async () => {
      const voidData = {
        reason: 'Emergency void - refund processed separately',
        skipValidation: true,
        closeActiveBillingGroups: true,
        voidDraftInvoices: true
      }

      const mockAuditEntry = {
        tabId,
        voidedBy: userId,
        voidedAt: new Date(),
        reason: 'Emergency void - refund processed separately',
        previousStatus: 'paid',
        paymentRefunds: [],
        invoiceActions: []
      }

      // Skip validation when forced
      mockTabVoidingService.voidTab.mockResolvedValue(mockAuditEntry)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'POST',
        body: JSON.stringify(voidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Tab voided successfully')
      expect(data.auditEntry).toEqual(mockAuditEntry)
      
      // Should not validate when skipping validation
      expect(mockTabVoidingService.validateVoiding).not.toHaveBeenCalled()
      expect(mockTabVoidingService.voidTab).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId,
        userId,
        'Emergency void - refund processed separately',
        {
          skipValidation: true,
          closeActiveBillingGroups: true,
          voidDraftInvoices: true
        }
      )
    })

    it('should validate request data', async () => {
      const invalidData = {
        reason: '', // Empty reason
        closeActiveBillingGroups: 'invalid' as any,
        skipValidation: 'not-boolean' as any
      }

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
      expect(data.details).toBeDefined()
    })

    it('should handle service errors', async () => {
      const voidData = {
        reason: 'Test void',
        skipValidation: false
      }

      const mockValidation = {
        canVoid: true,
        blockers: [],
        warnings: [],
        tab: { id: tabId, status: 'open' } as any
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)
      mockTabVoidingService.voidTab.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'POST',
        body: JSON.stringify(voidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to void tab')
    })
  })

  describe('PUT /api/v1/tabs/[id]/void', () => {
    it('should restore voided tab', async () => {
      const restoreData = {
        reason: 'Customer changed mind - reactivate order'
      }

      mockTabVoidingService.restoreVoidedTab.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'PUT',
        body: JSON.stringify(restoreData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Tab restored successfully')
      expect(mockTabVoidingService.restoreVoidedTab).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId,
        userId,
        'Customer changed mind - reactivate order'
      )
    })

    it('should handle tab not voided', async () => {
      const restoreData = {
        reason: 'Restore tab'
      }

      mockTabVoidingService.restoreVoidedTab.mockRejectedValue(
        new Error('Tab is not voided')
      )

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'PUT',
        body: JSON.stringify(restoreData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Tab is not voided')
    })

    it('should validate restore data', async () => {
      const invalidData = {
        reason: '' // Empty reason
      }

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'PUT',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })
  })

  describe('GET /api/v1/tabs/[id]/void', () => {
    it('should return voiding history for voided tab', async () => {
      const mockHistory = {
        isVoided: true,
        voidedAt: new Date('2024-01-15T10:30:00Z'),
        voidedBy: userId,
        voidReason: 'Customer cancellation',
        previousStatus: 'open'
      }

      mockTabVoidingService.getVoidingHistory.mockResolvedValue(mockHistory)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`)
      const response = await GET(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockHistory)
      expect(mockTabVoidingService.getVoidingHistory).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId
      )
    })

    it('should return empty history for non-voided tab', async () => {
      const mockHistory = {
        isVoided: false,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        previousStatus: null
      }

      mockTabVoidingService.getVoidingHistory.mockResolvedValue(mockHistory)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`)
      const response = await GET(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockHistory)
    })
  })

  describe('GET /api/v1/tabs/voided', () => {
    it('should return voided tabs with pagination', async () => {
      const mockVoidedTabs = {
        tabs: [
          {
            id: 'tab_1',
            externalReference: 'REF-001',
            customerEmail: 'customer1@example.com',
            customerName: 'Customer One',
            totalAmount: '100.00',
            lineItemsCount: 3,
            createdAt: new Date('2024-01-01'),
            voidedAt: new Date('2024-01-15'),
            voidedBy: userId,
            voidReason: 'Customer cancellation',
            previousStatus: 'open'
          },
          {
            id: 'tab_2',
            externalReference: 'REF-002',
            customerEmail: 'customer2@example.com',
            customerName: 'Customer Two',
            totalAmount: '250.00',
            lineItemsCount: 5,
            createdAt: new Date('2024-01-02'),
            voidedAt: new Date('2024-01-16'),
            voidedBy: userId,
            voidReason: 'Order error',
            previousStatus: 'partial'
          }
        ],
        total: 15
      }

      mockTabVoidingService.getVoidedTabs.mockResolvedValue(mockVoidedTabs)

      const request = new NextRequest('http://localhost/api/v1/tabs/voided?limit=2&offset=0')
      const response = await GetVoidedTabs(request, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockVoidedTabs.tabs)
      expect(data.pagination).toEqual({
        total: 15,
        limit: 2,
        offset: 0,
        hasMore: true
      })
      expect(data.summary).toEqual({
        totalVoidedTabs: 15,
        totalVoidedAmount: 350.00,
        averageTabAmount: 175.00,
        totalLineItems: 8
      })
      expect(mockTabVoidingService.getVoidedTabs).toHaveBeenCalledWith(
        mockContext.organizationId,
        { limit: 2, offset: 0 }
      )
    })

    it('should handle date filtering', async () => {
      const mockVoidedTabs = { tabs: [], total: 0 }
      mockTabVoidingService.getVoidedTabs.mockResolvedValue(mockVoidedTabs)

      const dateFrom = '2024-01-01T00:00:00Z'
      const dateTo = '2024-01-31T23:59:59Z'
      const request = new NextRequest(`http://localhost/api/v1/tabs/voided?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      const response = await GetVoidedTabs(request, { params: {} })

      expect(response.status).toBe(200)
      expect(mockTabVoidingService.getVoidedTabs).toHaveBeenCalledWith(
        mockContext.organizationId,
        {
          dateFrom: new Date(dateFrom),
          dateTo: new Date(dateTo)
        }
      )
    })

    it('should validate query parameters', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs/voided?limit=invalid&offset=-1')
      const response = await GetVoidedTabs(request, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid query parameters')
    })
  })

  describe('POST /api/v1/tabs/bulk-void', () => {
    it('should perform bulk voiding operation', async () => {
      const bulkVoidData = {
        tabIds: ['tab_1', 'tab_2', 'tab_3'],
        reason: 'Bulk cancellation - system migration',
        closeActiveBillingGroups: true,
        voidDraftInvoices: true,
        skipValidation: false
      }

      const mockValidations = [
        { canVoid: true, blockers: [], warnings: [] },
        { canVoid: true, blockers: [], warnings: [] },
        { canVoid: false, blockers: [{ type: 'payment', count: 1, message: 'Payment exists' }], warnings: [] }
      ]

      const mockAuditEntries = [
        { tabId: 'tab_1', voidedBy: userId, voidedAt: new Date(), reason: bulkVoidData.reason, previousStatus: 'open', paymentRefunds: [], invoiceActions: [] },
        { tabId: 'tab_2', voidedBy: userId, voidedAt: new Date(), reason: bulkVoidData.reason, previousStatus: 'open', paymentRefunds: [], invoiceActions: [] }
      ]

      mockTabVoidingService.validateVoiding
        .mockResolvedValueOnce(mockValidations[0] as any)
        .mockResolvedValueOnce(mockValidations[1] as any)
        .mockResolvedValueOnce(mockValidations[2] as any)

      mockTabVoidingService.voidTab
        .mockResolvedValueOnce(mockAuditEntries[0])
        .mockResolvedValueOnce(mockAuditEntries[1])

      const request = new NextRequest('http://localhost/api/v1/tabs/bulk-void', {
        method: 'POST',
        body: JSON.stringify(bulkVoidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkVoid(request, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Bulk void completed. 2 succeeded, 1 failed.')
      expect(data.summary).toEqual({
        total: 3,
        succeeded: 2,
        failed: 1,
        blocked: 1
      })
      expect(data.results).toHaveLength(2)
      expect(data.errors).toHaveLength(1)
      expect(data.errors[0].status).toBe('blocked')
    })

    it('should handle mixed success and failure cases', async () => {
      const bulkVoidData = {
        tabIds: ['tab_success', 'tab_blocked', 'tab_error'],
        reason: 'Test bulk void',
        skipValidation: false
      }

      mockTabVoidingService.validateVoiding
        .mockResolvedValueOnce({ canVoid: true, blockers: [], warnings: [] } as any)
        .mockResolvedValueOnce({ canVoid: false, blockers: [{ type: 'payment', count: 1, message: 'Has payments' }], warnings: [] } as any)
        .mockResolvedValueOnce({ canVoid: true, blockers: [], warnings: [] } as any)

      mockTabVoidingService.voidTab
        .mockResolvedValueOnce({ tabId: 'tab_success' } as any)
        .mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/v1/tabs/bulk-void', {
        method: 'POST',
        body: JSON.stringify(bulkVoidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkVoid(request, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.succeeded).toBe(1)
      expect(data.summary.failed).toBe(2)
      expect(data.summary.blocked).toBe(1)
    })

    it('should validate bulk void data', async () => {
      const invalidData = {
        tabIds: [], // Empty array
        reason: '' // Empty reason
      }

      const request = new NextRequest('http://localhost/api/v1/tabs/bulk-void', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkVoid(request, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })

    it('should enforce tab count limits', async () => {
      const tooManyTabsData = {
        tabIds: Array.from({ length: 21 }, (_, i) => `tab_${i}`), // 21 tabs, over limit
        reason: 'Too many tabs'
      }

      const request = new NextRequest('http://localhost/api/v1/tabs/bulk-void', {
        method: 'POST',
        body: JSON.stringify(tooManyTabsData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkVoid(request, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })
  })

  describe('Data Integrity and Edge Cases', () => {
    it('should handle concurrent voiding attempts', async () => {
      // Test case where tab is voided between validation and voiding
      const voidData = {
        reason: 'Concurrent test',
        skipValidation: false
      }

      const mockValidation = {
        canVoid: true,
        blockers: [],
        warnings: [],
        tab: { id: tabId, status: 'open' } as any
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)
      mockTabVoidingService.voidTab.mockRejectedValue(
        new Error('Tab is already voided')
      )

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'POST',
        body: JSON.stringify(voidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Tab is already voided')
    })

    it('should preserve financial audit trails', async () => {
      // Test that voided tabs preserve payment and invoice history
      const mockValidation = {
        canVoid: false,
        blockers: [
          {
            type: 'payment',
            count: 2,
            message: 'Cannot void tab with 2 successful payment(s) totaling $300.00',
            details: [
              { id: 'pay_1', amount: '150.00', processor: 'stripe' },
              { id: 'pay_2', amount: '150.00', processor: 'stripe' }
            ]
          }
        ],
        warnings: [],
        tab: { id: tabId, status: 'paid' } as any
      }

      mockTabVoidingService.validateVoiding.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/validate-voiding`)
      const response = await ValidateVoiding(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.canVoid).toBe(false)
      expect(data.blockers[0].details).toHaveLength(2)
      expect(data.blockers[0].details[0]).toHaveProperty('id')
      expect(data.blockers[0].details[0]).toHaveProperty('amount')
    })

    it('should handle restoration of complex voided tabs', async () => {
      const restoreData = {
        reason: 'Restore complex tab with billing groups'
      }

      mockTabVoidingService.restoreVoidedTab.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/tabs/${tabId}/void`, {
        method: 'PUT',
        body: JSON.stringify(restoreData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: tabId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Tab restored successfully')
      expect(mockTabVoidingService.restoreVoidedTab).toHaveBeenCalledWith(
        tabId,
        mockContext.organizationId,
        userId,
        'Restore complex tab with billing groups'
      )
    })
  })
})